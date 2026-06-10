import { parse, cstVisitor } from "sql-parser-cst";
import { BigQueryClient } from "./bigqueryClient";
import { Authentication } from "./authentication";
import { BigqueryTableSchema } from "./bigqueryTableSchema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CstNode = any;

export interface ResolvedColumn {
    projectId: string;
    datasetId: string;
    tableId: string;
    columnName: string;
    /** BigQuery data type (INT64, STRING, etc.). */
    columnType: string;
    /** REPEATED / NULLABLE / REQUIRED. Optional — only present when known. */
    mode?: string;
}

interface TableInScope {
    fullyQualified: string;
    projectId: string | null;
    datasetId: string | null;
    tableId: string;
    /** Alias if present, otherwise the table's short name. Used for `t.col` lookup. */
    alias: string;
    /** Range of the table-ref in the SQL (offset, end). */
    range?: [number, number];
}

/**
 * Resolves a column reference at the cursor to a concrete (project, dataset, table, column)
 * by parsing the surrounding statement, building the alias map, and matching the column
 * against cached/fetched schemas.
 *
 * Supports:
 *   - `column` (unqualified, single-table) — picks the only table in scope.
 *   - `alias.column` — looks up `alias` in the FROM/JOIN list.
 *   - `column` (unqualified, multi-table) — searches all schemas; ambiguous matches
 *     raise an error so the caller can surface a meaningful message.
 *
 * Returns null when no column word is at the cursor.
 */
export async function resolveColumnAtPosition(
    bqClient: BigQueryClient,
    sql: string,
    offset: number,
    defaultProjectId: string | null
): Promise<ResolvedColumn | null> {

    const word = extractColumnWordAt(sql, offset);
    if (!word) { return null; }

    const projectId = defaultProjectId || await Authentication.getDefaultProjectId();

    const statement = findStatementContaining(sql, offset);
    const tables = collectTablesInScope(statement ?? sql, projectId);

    if (tables.length === 0) {
        throw new Error('No source tables found in the surrounding SELECT — cannot resolve the column.');
    }

    // Qualified reference: alias.column
    if (word.alias) {
        const target = tables.find(t =>
            t.alias.toLowerCase() === word.alias!.toLowerCase()
            || t.tableId.toLowerCase() === word.alias!.toLowerCase()
        );
        if (!target) {
            throw new Error(`Could not find a table/alias named "${word.alias}" in the surrounding query.`);
        }
        if (!target.projectId || !target.datasetId) {
            throw new Error(`Table "${target.tableId}" has no resolvable project/dataset — fully-qualify it as project.dataset.table.`);
        }
        const schema = await bqClient.getTableSchema(target.projectId, target.datasetId, target.tableId);
        const col = findColumn(schema, word.column);
        if (!col) {
            throw new Error(`Column "${word.column}" not found in ${target.projectId}.${target.datasetId}.${target.tableId}.`);
        }
        return {
            projectId: target.projectId,
            datasetId: target.datasetId,
            tableId: target.tableId,
            columnName: col.column_name,
            columnType: col.data_type
        };
    }

    // Unqualified — search all tables, must be unambiguous.
    const matches: ResolvedColumn[] = [];
    for (const t of tables) {
        if (!t.projectId || !t.datasetId) { continue; }
        try {
            const schema = await bqClient.getTableSchema(t.projectId, t.datasetId, t.tableId);
            const col = findColumn(schema, word.column);
            if (col) {
                matches.push({
                    projectId: t.projectId,
                    datasetId: t.datasetId,
                    tableId: t.tableId,
                    columnName: col.column_name,
                    columnType: col.data_type
                });
            }
        } catch { /* skip unreachable tables */ }
    }

    if (matches.length === 0) {
        throw new Error(`Column "${word.column}" not found in any source table of the surrounding query.`);
    }
    if (matches.length > 1) {
        const list = matches.map(m => `${m.datasetId}.${m.tableId}`).join(', ');
        throw new Error(`Column "${word.column}" is ambiguous — present in: ${list}. Qualify it with an alias.`);
    }
    return matches[0];
}

export interface ResolvedTable {
    projectId: string;
    datasetId: string;
    tableId: string;
}

/**
 * Resolves the table reference at the cursor to a concrete (project, dataset, table).
 * Handles:
 *   - fully-qualified `project.dataset.table` (backticked or not, hyphenated projects ok)
 *   - `dataset.table` — project from `defaultProjectId`
 *   - bare table name or alias — matched against the FROM/JOIN tables of the
 *     surrounding statement (same scope walk Profile Column uses).
 * Returns null when the cursor isn't on an identifier.
 */
export async function resolveTableAtPosition(
    sql: string,
    offset: number,
    defaultProjectId: string | null
): Promise<ResolvedTable | null> {

    const token = extractTablePathAt(sql, offset);
    if (!token) { return null; }

    const projectId = defaultProjectId || await Authentication.getDefaultProjectId();

    const parts = token.split('.').map(p => p.trim()).filter(p => p.length > 0);
    if (parts.length >= 3) {
        return { projectId: parts[parts.length - 3], datasetId: parts[parts.length - 2], tableId: parts[parts.length - 1] };
    }

    const statement = findStatementContaining(sql, offset);
    const tables = collectTablesInScope(statement ?? sql, projectId);

    if (parts.length === 2) {
        const [ds, tbl] = parts;
        const match = tables.find(t =>
            t.datasetId?.toLowerCase() === ds.toLowerCase()
            && t.tableId.toLowerCase() === tbl.toLowerCase());
        if (match && match.projectId && match.datasetId) {
            return { projectId: match.projectId, datasetId: match.datasetId, tableId: match.tableId };
        }
        if (projectId) {
            return { projectId, datasetId: ds, tableId: tbl };
        }
        return null;
    }

    // Single word — table short name or alias from the surrounding statement.
    const word = parts[0].toLowerCase();
    const match = tables.find(t =>
        t.tableId.toLowerCase() === word || t.alias.toLowerCase() === word);
    if (match && match.projectId && match.datasetId) {
        return { projectId: match.projectId, datasetId: match.datasetId, tableId: match.tableId };
    }
    return null;
}

/**
 * Extracts the dotted table path the cursor sits on. Inside a backtick span the
 * whole quoted content is taken; otherwise the token expands over identifier
 * characters, dots, and hyphens (hyphenated GCP project ids).
 */
export function extractTablePathAt(sql: string, offset: number): string | null {
    if (offset < 0 || offset > sql.length) { return null; }

    // Backtick span containing the cursor?
    let tickStart = -1;
    for (let i = 0; i < sql.length; i++) {
        if (sql[i] !== '`') { continue; }
        if (tickStart < 0) {
            tickStart = i;
        } else {
            if (offset > tickStart && offset <= i) {
                const inner = sql.slice(tickStart + 1, i);
                return inner.length > 0 ? inner : null;
            }
            tickStart = -1;
        }
    }

    const isPathChar = (c: string) => /[A-Za-z0-9_.\-`]/.test(c);
    let start = offset;
    while (start > 0 && isPathChar(sql[start - 1])) { start--; }
    let end = offset;
    while (end < sql.length && isPathChar(sql[end])) { end++; }
    if (start === end) { return null; }

    const token = sql.slice(start, end).replace(/`/g, '').replace(/^[.\-]+|[.\-]+$/g, '');
    return token.length > 0 ? token : null;
}

interface ColumnWord {
    column: string;
    alias?: string;
}

/**
 * Extracts the identifier-ish token at `offset`, plus an optional `alias.` prefix.
 * Tolerates backtick-quoting on either side. Returns null when the position is
 * not inside an identifier.
 */
export function extractColumnWordAt(sql: string, offset: number): ColumnWord | null {
    if (offset < 0 || offset > sql.length) { return null; }

    // Walk left to find token start, accept word chars and backticks.
    const isWordChar = (c: string) => /[A-Za-z0-9_`]/.test(c);
    let start = offset;
    while (start > 0 && isWordChar(sql[start - 1])) { start--; }
    let end = offset;
    while (end < sql.length && isWordChar(sql[end])) { end++; }
    if (start === end) {
        // Cursor between characters — try right side
        if (end < sql.length && isWordChar(sql[end])) {
            // Already handled above.
        }
        return null;
    }
    const token = sql.slice(start, end).replace(/`/g, '');
    if (!token) { return null; }

    // Check for "alias." immediately to the left.
    let alias: string | undefined;
    let scan = start;
    while (scan > 0 && /\s/.test(sql[scan - 1])) { scan--; }
    if (scan > 0 && sql[scan - 1] === '.') {
        let aliasEnd = scan - 1;
        while (aliasEnd > 0 && /\s/.test(sql[aliasEnd - 1])) { aliasEnd--; }
        let aliasStart = aliasEnd;
        while (aliasStart > 0 && isWordChar(sql[aliasStart - 1])) { aliasStart--; }
        if (aliasStart < aliasEnd) {
            alias = sql.slice(aliasStart, aliasEnd).replace(/`/g, '');
        }
    }

    return { column: token, alias };
}

/**
 * Returns the substring corresponding to the top-level statement that contains
 * `offset`. Statements are split on semicolons that live outside string/comment/
 * backtick contexts. Falls back to the full SQL if scanning fails.
 */
function findStatementContaining(sql: string, offset: number): string | null {
    const len = sql.length;
    let i = 0;
    let stmtStart = 0;
    while (i < len) {
        const c = sql[i];
        // Line comment
        if (c === '-' && sql[i + 1] === '-') {
            while (i < len && sql[i] !== '\n') { i++; }
            continue;
        }
        // Block comment
        if (c === '/' && sql[i + 1] === '*') {
            i += 2;
            while (i < len - 1 && !(sql[i] === '*' && sql[i + 1] === '/')) { i++; }
            i += 2;
            continue;
        }
        // Strings (single, double, backtick)
        if (c === '\'' || c === '"' || c === '`') {
            const quote = c;
            i++;
            while (i < len && sql[i] !== quote) {
                if (sql[i] === '\\') { i += 2; } else { i++; }
            }
            i++;
            continue;
        }
        if (c === ';') {
            if (offset <= i) {
                return sql.slice(stmtStart, i);
            }
            stmtStart = i + 1;
        }
        i++;
    }
    return sql.slice(stmtStart);
}

/**
 * Walks the AST of `stmtSql` and collects every table reference under any
 * `from_clause`, including aliases. Falls back to a regex scan when parsing fails.
 */
function collectTablesInScope(stmtSql: string, defaultProjectId: string | null): TableInScope[] {
    const tables: TableInScope[] = [];
    const cteNames = new Set<string>();

    try {
        const cst = parse(stmtSql, { dialect: "bigquery", includeRange: true });

        /* eslint-disable @typescript-eslint/naming-convention */
        const cteCollector = cstVisitor({
            common_table_expr: (node: CstNode) => {
                const name = node.table?.name || node.table?.text;
                if (name) { cteNames.add(name.toLowerCase()); }
            }
        });
        cteCollector(cst);

        const visitor = cstVisitor({
            from_clause: (node: CstNode) => {
                walkFromExpr(node.expr, tables, defaultProjectId, cteNames);
            },
            // Subqueries can declare their own FROM — we still surface them, the caller's
            // search loop will simply skip unreachable tables.
            join_expr: (node: CstNode) => {
                walkFromExpr(node, tables, defaultProjectId, cteNames);
            }
        });
        /* eslint-enable @typescript-eslint/naming-convention */
        visitor(cst);

        if (tables.length > 0) { return dedupe(tables); }
    } catch { /* fall through to regex */ }

    // Regex fallback — handles hyphenated project ids and unusual identifiers
    // that sql-parser-cst sometimes rejects.
    return dedupe(regexScanTables(stmtSql, defaultProjectId));
}

function walkFromExpr(node: CstNode, out: TableInScope[], defaultProjectId: string | null, cteNames: Set<string>) {
    if (!node) { return; }

    if (node.type === 'join_expr') {
        walkFromExpr(node.left, out, defaultProjectId, cteNames);
        walkFromExpr(node.right, out, defaultProjectId, cteNames);
        return;
    }
    if (node.type === 'paren_expr') {
        walkFromExpr(node.expr, out, defaultProjectId, cteNames);
        return;
    }
    if (node.type === 'list_expr' && Array.isArray(node.items)) {
        for (const item of node.items) { walkFromExpr(item, out, defaultProjectId, cteNames); }
        return;
    }
    if (node.type === 'alias') {
        const aliasName = node.alias?.name || node.alias?.text;
        const target = parseTableTarget(node.expr);
        if (target) {
            const aliasStr = aliasName || target.tableId;
            // Skip if it's a CTE reference, not a real table.
            if (!cteNames.has(target.tableId.toLowerCase())) {
                out.push(assemble(target, aliasStr, defaultProjectId, node.range));
            }
        }
        return;
    }

    const target = parseTableTarget(node);
    if (target && !cteNames.has(target.tableId.toLowerCase())) {
        out.push(assemble(target, target.tableId, defaultProjectId, node.range));
    }
}

interface TableTarget {
    parts: string[];
    tableId: string;
}

function parseTableTarget(node: CstNode): TableTarget | null {
    if (!node) { return null; }
    const flat = flattenMember(node);
    if (!flat || flat.length === 0) { return null; }
    return { parts: flat, tableId: flat[flat.length - 1] };
}

function flattenMember(node: CstNode): string[] | null {
    if (!node) { return null; }
    if (node.type === 'identifier') {
        const n = node.name || node.text;
        return n ? [n] : null;
    }
    if (node.type === 'member_expr') {
        const left = flattenMember(node.object);
        const right = node.property?.name || node.property?.text;
        if (left && right) { return [...left, right]; }
        if (right) { return [right]; }
        return left;
    }
    if (node.type === 'bigquery_quoted_member_expr') {
        return flattenMember(node.expr);
    }
    if (node.type === 'alias') {
        return flattenMember(node.expr);
    }
    return null;
}

function assemble(target: TableTarget, alias: string, defaultProjectId: string | null, range?: [number, number]): TableInScope {
    const parts = target.parts.map(p => p.replace(/`/g, ''));
    let projectId: string | null = null;
    let datasetId: string | null = null;
    let tableId = parts[parts.length - 1];

    if (parts.length >= 3) {
        projectId = parts[parts.length - 3];
        datasetId = parts[parts.length - 2];
    } else if (parts.length === 2) {
        projectId = defaultProjectId;
        datasetId = parts[0];
    } else {
        projectId = defaultProjectId;
    }

    return {
        fullyQualified: `${projectId ?? '?'}.${datasetId ?? '?'}.${tableId}`,
        projectId,
        datasetId,
        tableId,
        alias,
        range
    };
}

function dedupe(tables: TableInScope[]): TableInScope[] {
    const seen = new Set<string>();
    const out: TableInScope[] = [];
    for (const t of tables) {
        const key = `${t.fullyQualified}|${t.alias}`;
        if (seen.has(key)) { continue; }
        seen.add(key);
        out.push(t);
    }
    return out;
}

function regexScanTables(sql: string, defaultProjectId: string | null): TableInScope[] {
    const out: TableInScope[] = [];
    const tablePattern = '(`[^`]+`|[A-Za-z0-9_-]+(?:\\.[A-Za-z0-9_-]+)*)';
    const aliasPart = '(?:\\s+(?:AS\\s+)?([A-Za-z_][A-Za-z0-9_]*))?';
    const re = new RegExp(`\\b(?:FROM|JOIN)\\s+${tablePattern}${aliasPart}`, 'gi');

    let m: RegExpExecArray | null;
    while ((m = re.exec(sql)) !== null) {
        const raw = m[1].replace(/`/g, '');
        const parts = raw.split('.');
        const aliasName = m[2] || parts[parts.length - 1];
        out.push(assemble({ parts, tableId: parts[parts.length - 1] }, aliasName, defaultProjectId, [m.index, re.lastIndex]));
    }
    return out;
}

function findColumn(schema: BigqueryTableSchema[], name: string): BigqueryTableSchema | null {
    const lower = name.toLowerCase();
    return schema.find(c => c.column_name.toLowerCase() === lower) || null;
}
