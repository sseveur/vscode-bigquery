import { LineageGraph, LineageNode } from '../services/lineageGraph';
import { extractCteColumns, finalSelectColumns, maskCommentsAndLiterals } from '../services/cteExtractor';
import { ColumnLookup, ResolvedTable } from '../services/columnResolver';

type Column = { name: string; type?: string };

/**
 * Fills `node.columns` for the "Columns" view of one query's lineage graph:
 *  - source and target tables from the catalog (`lookup`), a target's INSERT column list first;
 *  - CTEs and the query result from their SELECT lists, `*` / `x.*` expanded from the inputs they
 *    read, and a type carried over when exactly one input has a column of that name.
 * Nodes are visited in layer order so every input is resolved before the nodes that read it.
 * Catalog failures are kept per node in `columnsNote`; the rest of the graph still resolves.
 */
export async function resolveLineageColumns(
    graph: LineageGraph,
    sql: string,
    lookup: ColumnLookup,
    defaultProjectId?: string
): Promise<void> {
    const byId = new Map(graph.nodes.map(n => [n.id, n] as const));
    const inputsOf = (n: LineageNode) => graph.edges.filter(e => e.target === n.id).map(e => byId.get(e.source)!).filter(Boolean);

    // Catalog reads in parallel, one per distinct table
    const catalog = new Map<string, Promise<Column[]>>();
    const fromCatalog = (n: LineageNode): Promise<Column[]> => {
        const table = tableOf(n.fullName, defaultProjectId);
        if (!table) { return Promise.reject(new Error('no dataset: qualify it as dataset.table')); }
        const key = `${table.projectId}.${table.datasetId}.${table.tableId}`.toLowerCase();
        if (!catalog.has(key)) { catalog.set(key, lookup(table)); }
        return catalog.get(key)!;
    };
    await Promise.all(graph.nodes.filter(n => n.nodeType === 'SOURCE').map(async n => {
        try {
            n.columns = await fromCatalog(n);
            if (!n.columns.length) { n.columnsNote = 'not found in the catalog'; }
        } catch (e: any) {
            n.columnsNote = `columns unavailable: ${e?.message ?? e}`;
        }
    }));

    for (const n of graph.nodes.filter(n => n.nodeType !== 'SOURCE').sort((a, b) => a.layer - b.layer)) {
        const inputs = inputsOf(n);
        if (n.nodeType === 'CTE') {
            n.columns = inherit(extractCteColumns(sql, n.name), inputs, sql);
        } else if (n.nodeType === 'RESULT') {
            n.columns = inherit(finalSelectColumns(sql), inputs, sql);
        } else {
            // TARGET: what the statement writes, typed from the table itself when readable
            let written = inherit(finalSelectColumns(sql), inputs, sql);
            try {
                const table = await fromCatalog(n);
                if (table.length) {
                    const typeOf = new Map(table.map(c => [c.name.toLowerCase(), c.type]));
                    written = written.length && !written.some(c => c.name === '*')
                        ? written.map(c => ({ name: c.name, type: typeOf.get(c.name.toLowerCase()) ?? c.type }))
                        : table;
                }
            } catch { /* keep the SELECT-list columns */ }
            n.columns = written;
        }
        if (!n.columns.length) { n.columnsNote = 'columns not determined'; }
    }
}

/** `*` / `x.*` expands to the input's columns; other names pick up a type from a unique match. */
function inherit(names: Array<{ name: string }>, inputs: LineageNode[], sql: string): Column[] {
    const out: Column[] = [];
    const seen = new Set<string>();
    const add = (c: Column) => {
        const key = c.name.toLowerCase();
        if (!seen.has(key)) { seen.add(key); out.push(c); }
    };
    for (const { name } of names) {
        if (name === '*' || name.endsWith('.*')) {
            const qualifier = name === '*' ? null : name.slice(0, -2).toLowerCase();
            let from = qualifier
                ? inputs.filter(i => i.name.toLowerCase() === qualifier || i.fullName.toLowerCase().endsWith('.' + qualifier)
                    || tablesAliased(sql, qualifier).has(i.name.toLowerCase()))
                : inputs;
            // `x` may name a derived table `( SELECT ... ) x`: then x.* is the tables it reads
            let derived = false;
            if (qualifier && from.length === 0) {
                const inner = tablesInDerived(sql, qualifier);
                from = inputs.filter(i => inner.has(i.name.toLowerCase()));
                derived = from.length > 0;
            }
            // One input: its columns. Several (a JOIN, or UNION branches of a derived table): all of
            // them, repeated names once, provided every input is resolved (else a partial list lies).
            const resolved = (i: LineageNode) => !!i.columns?.length && !i.columns.some(c => c.name.includes('*'));
            if (from.length === 1 && from[0].columns?.length) {
                from[0].columns.forEach(add);
            } else if ((!qualifier || derived) && from.length > 1 && from.every(resolved)) {
                from.forEach(i => i.columns!.forEach(add));
            } else {
                add({ name });
            }
            continue;
        }
        const matches = inputs.flatMap(i => i.columns ?? []).filter(c => c.name.toLowerCase() === name.toLowerCase() && c.type);
        const types = new Set(matches.map(c => c.type!.toLowerCase()));
        add({ name, type: types.size === 1 ? matches[0].type : undefined });
    }
    return out;
}

/** A table path part: a backticked name (may hold dots) or a plain one (project ids have `-`). */
const PART = String.raw`(?:\x60[^\x60]+\x60|[\w-]+)`;

/**
 * Last name part (lower-cased) of every table the SQL introduces with `alias`:
 * `FROM p.d.t f` / `JOIN d.t AS f` (backticks optional) -> `t`. Lets `f.*` find its input.
 * Whole-text scan, so an alias reused for two of the same node's inputs stays ambiguous
 * (and `f.*` unexpanded); scope to the CTE body if that shows up.
 */
function tablesAliased(sql: string, alias: string): Set<string> {
    sql = maskCommentsAndLiterals(sql);   // a commented-out `-- FROM old_table f` must not count
    const a = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(String.raw`\b(?:FROM|JOIN)\s+(${PART}(?:\s*\.\s*${PART})*)\s+(?:AS\s+)?(?:\x60${a}\x60|${a})(?![\w.])`, 'gi');
    return namesFrom(sql, re);
}

/**
 * Last name part (lower-cased) of every table read inside a derived table aliased `alias`:
 * `( SELECT * FROM a UNION ALL SELECT * FROM b ) f` -> {a, b}.
 */
function tablesInDerived(sql: string, alias: string): Set<string> {
    sql = maskCommentsAndLiterals(sql);
    const a = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const out = new Set<string>();
    const close = new RegExp(String.raw`\)\s*(?:AS\s+)?(?:\x60${a}\x60|${a})(?![\w.])`, 'gi');
    let m: RegExpExecArray | null;
    while ((m = close.exec(sql)) !== null) {
        let depth = 0, open = -1;
        for (let i = m.index; i >= 0; i--) {      // walk back to the matching '('
            if (sql[i] === ')') { depth++; } else if (sql[i] === '(' && --depth === 0) { open = i; break; }
        }
        if (open < 0) { continue; }
        const body = sql.substring(open + 1, m.index);
        namesFrom(body, new RegExp(String.raw`\b(?:FROM|JOIN)\s+(${PART}(?:\s*\.\s*${PART})*)`, 'gi')).forEach(n => out.add(n));
    }
    return out;
}

function namesFrom(text: string, re: RegExp): Set<string> {
    const out = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        out.add(m[1].replace(/\x60/g, '').split('.').pop()!.trim().toLowerCase());
    }
    return out;
}

/**
 * `project.dataset.table` or `dataset.table` against the default project; backticks around the
 * whole path or each part are dropped. A bare table name has no dataset to look it up in.
 */
export function tableOf(fullName: string, defaultProjectId?: string): ResolvedTable | null {
    const parts = fullName.replace(/`/g, '').split('.');
    if (parts.length >= 3) {
        const [projectId, datasetId, tableId] = parts.slice(-3);
        return { projectId, datasetId, tableId };
    }
    if (parts.length === 2 && defaultProjectId) {
        return { projectId: defaultProjectId, datasetId: parts[0], tableId: parts[1] };
    }
    return null;
}
