import { LineageGraph, LineageNode } from '../services/lineageGraph';
import { extractCteColumns, finalSelectColumns } from '../services/cteExtractor';
import { ColumnLookup, ResolvedTable } from '../services/columnResolver';

type Column = { name: string; type?: string };

/**
 * Fills `node.columns` for the "Columns" view of one query's lineage graph:
 *  - source and target tables from the catalog (`lookup`), a target's INSERT column list first;
 *  - CTEs and the query result from their SELECT lists, `*` expanded from the single input it
 *    reads, and a type carried over when exactly one input has a column of that name.
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
            n.columns = inherit(extractCteColumns(sql, n.name), inputs);
        } else if (n.nodeType === 'RESULT') {
            n.columns = inherit(finalSelectColumns(sql), inputs);
        } else {
            // TARGET: what the statement writes, typed from the table itself when readable
            let written = inherit(finalSelectColumns(sql), inputs);
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
function inherit(names: Array<{ name: string }>, inputs: LineageNode[]): Column[] {
    const out: Column[] = [];
    const seen = new Set<string>();
    const add = (c: Column) => {
        const key = c.name.toLowerCase();
        if (!seen.has(key)) { seen.add(key); out.push(c); }
    };
    for (const { name } of names) {
        if (name === '*' || name.endsWith('.*')) {
            const qualifier = name === '*' ? null : name.slice(0, -2).toLowerCase();
            const from = qualifier
                ? inputs.filter(i => i.name.toLowerCase() === qualifier || i.fullName.toLowerCase().endsWith('.' + qualifier))
                : inputs;
            if (from.length === 1 && from[0].columns?.length) {
                from[0].columns.forEach(add);
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
