import { parse } from "@bstruct/bqsql-parser";
import { parse as parseCst, cstVisitor } from "sql-parser-cst";
import { BqsqlDocument, BqsqlDocumentItem } from "../language/bqsqlDocument";
import { extractTableReferences, extractCtesWithDependencies } from "./sqlTableExtractor";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CstNode = any;

export interface CteDefinition {
    name: string;                      // CTE name
    range: number[];                   // Parser position [line, start, end]
    sourceTables: string[];            // Physical tables referenced directly
    referencedCtes: string[];          // Other CTEs referenced
}

/**
 * Extract all CTE definitions from SQL query
 * Uses sql-parser-cst for better JOIN/table extraction, with @bstruct/bqsql-parser as fallback
 */
export function extractCtes(sql: string): CteDefinition[] {
    // Try sql-parser-cst first (better table extraction for JOINs etc)
    const cstCtes = extractCtesWithDependencies(sql);
    if (cstCtes.length > 0) {
        // Convert to CteDefinition format (without range, which isn't needed for lineage)
        return cstCtes.map(cte => ({
            name: cte.name,
            range: [],  // sql-parser-cst doesn't provide range in same format
            sourceTables: cte.sourceTables,
            referencedCtes: cte.referencedCtes
        }));
    }

    // Fallback to @bstruct/bqsql-parser for cases sql-parser-cst doesn't support
    // (e.g., CREATE VIEW after WITH)
    const parsed = parse(sql) as BqsqlDocument;
    const ctes: CteDefinition[] = [];
    const cteNames = new Set<string>();

    // First pass: collect all CTE names
    findAllCteNames(parsed.items, cteNames, sql);

    // Second pass: extract full CTE definitions
    extractCteDefinitions(parsed.items, ctes, cteNames, sql);

    return ctes;
}

/**
 * First pass: collect all CTE names so we can identify CTE references
 */
function findAllCteNames(items: BqsqlDocumentItem[], cteNames: Set<string>, sql: string): void {
    for (const item of items) {
        if (item.item_type === "QueryWith") {
            // Within QueryWith, find all TableCteId items
            for (const child of item.items || []) {
                if (child.item_type === "TableCteId") {
                    const name = extractTextFromRange(sql, child.range);
                    if (name) {
                        cteNames.add(name.toLowerCase());
                    }
                }
            }
        }

        // Recursively search
        if (item.items && item.items.length > 0) {
            findAllCteNames(item.items, cteNames, sql);
        }
    }
}

/**
 * Second pass: extract full CTE definitions with their dependencies
 */
function extractCteDefinitions(
    items: BqsqlDocumentItem[],
    ctes: CteDefinition[],
    knownCteNames: Set<string>,
    sql: string
): void {
    for (const item of items) {
        if (item.item_type === "QueryWith") {
            // Parse the QueryWith structure to extract individual CTEs
            parseCteBlock(item, ctes, knownCteNames, sql);
        }

        // Recursively search for nested QueryWith (subqueries with CTEs)
        if (item.items && item.items.length > 0) {
            extractCteDefinitions(item.items, ctes, knownCteNames, sql);
        }
    }
}

/**
 * Parse a QueryWith block to extract individual CTE definitions
 * Structure: QueryWith contains [Keyword(WITH), TableCteId, Keyword(AS), Query, ...]
 */
function parseCteBlock(
    queryWith: BqsqlDocumentItem,
    ctes: CteDefinition[],
    knownCteNames: Set<string>,
    sql: string
): void {
    const children = queryWith.items || [];
    let currentCteName: string | null = null;
    let currentCteRange: number[] = [];

    for (let i = 0; i < children.length; i++) {
        const child = children[i];

        if (child.item_type === "TableCteId") {
            // Found a CTE name
            currentCteName = extractTextFromRange(sql, child.range);
            currentCteRange = child.range || [];
        } else if (child.item_type === "Query" && currentCteName) {
            // Found the CTE's query body - extract its dependencies
            const sourceTables: string[] = [];
            const referencedCtes: string[] = [];

            extractDependencies(child, sourceTables, referencedCtes, knownCteNames, sql);

            ctes.push({
                name: currentCteName,
                range: currentCteRange,
                sourceTables: [...new Set(sourceTables)], // Deduplicate
                referencedCtes: [...new Set(referencedCtes)] // Deduplicate
            });

            currentCteName = null;
            currentCteRange = [];
        }
    }
}

/**
 * Extract table and CTE references from a query item
 * Uses sql-parser-cst for better extraction, with fallback to @bstruct/bqsql-parser
 */
function extractDependencies(
    queryItem: BqsqlDocumentItem,
    sourceTables: string[],
    referencedCtes: string[],
    knownCteNames: Set<string>,
    sql: string
): void {
    // Try to use sql-parser-cst to extract all tables from the SQL
    // This handles JOINs and other cases @bstruct misses
    const allTables = extractTableReferences(sql);

    for (const tableName of allTables) {
        if (knownCteNames.has(tableName.toLowerCase())) {
            if (!referencedCtes.includes(tableName)) {
                referencedCtes.push(tableName);
            }
        } else {
            if (!sourceTables.includes(tableName)) {
                sourceTables.push(tableName);
            }
        }
    }

    // Also use the original @bstruct approach for any tables it might find
    for (const item of queryItem.items || []) {
        if (item.item_type === "TableIdentifier") {
            const tableName = extractTableNameFromIdentifier(item, sql);
            if (tableName) {
                if (knownCteNames.has(tableName.toLowerCase())) {
                    if (!referencedCtes.includes(tableName)) {
                        referencedCtes.push(tableName);
                    }
                } else {
                    if (!sourceTables.includes(tableName)) {
                        sourceTables.push(tableName);
                    }
                }
            }
        }

        // Recursively search nested items
        if (item.items && item.items.length > 0) {
            extractDependencies(item, sourceTables, referencedCtes, knownCteNames, sql);
        }
    }
}

/**
 * Extract table name from a TableIdentifier item
 */
function extractTableNameFromIdentifier(tableIdentifier: BqsqlDocumentItem, sql: string): string | null {
    const lines = sql.split('\n');
    const ranges = getAllRanges(tableIdentifier);

    if (ranges.length === 0) return null;

    const parts: string[] = [];
    for (const range of ranges) {
        try {
            const text = lines[range[0]].substring(range[1], range[2]);
            if (text) {
                // Stop if we hit an alias keyword (AS)
                if (/^\s*as\s*$/i.test(text)) break;
                parts.push(text);
            }
        } catch { }
    }

    if (parts.length === 0) return null;

    // Join and clean up - remove backticks and any trailing alias
    let tableName = parts.join('').replace(/`/g, '');
    tableName = tableName.replace(/\s+as\s+\w+$/i, '').trim();
    return tableName;
}

/**
 * Get all ranges from an item recursively
 */
function getAllRanges(item: BqsqlDocumentItem): number[][] {
    const ranges: number[][] = [];

    if (item.range && item.range.length >= 3) {
        ranges.push(item.range);
    }

    if (item.items) {
        for (const child of item.items) {
            ranges.push(...getAllRanges(child));
        }
    }

    return ranges;
}

/**
 * Extract text from a parser range [line, start, end]
 */
function extractTextFromRange(sql: string, range: number[] | undefined): string | null {
    if (!range || range.length < 3) return null;

    const lines = sql.split('\n');
    const [line, start, end] = range;

    try {
        return lines[line].substring(start, end);
    } catch {
        return null;
    }
}

/**
 * CTE column information
 */
export interface CteColumn {
    name: string;
}

/**
 * Extract column names from a CTE definition
 * Handles:
 * - Explicit column list: WITH my_cte (col1, col2) AS (...)
 * - SELECT columns: WITH my_cte AS (SELECT a, b AS c FROM ...)
 * - SELECT *: Returns ["*"]
 */
export function extractCteColumns(sql: string, cteName: string): CteColumn[] {
    try {
        const cst = parseCst(sql, { dialect: "bigquery" });
        const columns: CteColumn[] = [];

        const visitor = cstVisitor({
            common_table_expr: (node: CstNode) => {
                const name = node.table?.name || node.table?.text;
                if (!name || name.toLowerCase() !== cteName.toLowerCase()) {
                    return;
                }

                // Check for explicit column list: WITH my_cte (col1, col2) AS
                if (node.columns && node.columns.items) {
                    for (const col of node.columns.items) {
                        const colName = col.name || col.text;
                        if (colName) {
                            columns.push({ name: colName });
                        }
                    }
                    return;
                }

                // Otherwise, extract from SELECT clause
                const selectVisitor = cstVisitor({
                    select_clause: (selectNode: CstNode) => {
                        if (!selectNode.columns) { return; }

                        const items = selectNode.columns.items || selectNode.columns;
                        for (const col of (Array.isArray(items) ? items : [items])) {
                            const colName = extractColumnName(col);
                            if (colName && !columns.some(c => c.name === colName)) {
                                columns.push({ name: colName });
                            }
                        }
                    }
                });

                // The CTE body is in node.expr
                if (node.expr) {
                    selectVisitor(node.expr);
                }
            }
        });

        visitor(cst);
        return columns;
    } catch {
        return [];
    }
}

/**
 * Extract column name from a SELECT clause item
 */
function extractColumnName(node: CstNode): string | null {
    if (!node) { return null; }

    // Handle aliased columns: expr AS alias
    if (node.type === 'alias') {
        const alias = node.alias?.name || node.alias?.text;
        if (alias) { return alias; }
        // Fall through to get name from expr
        return extractColumnName(node.expr);
    }

    // Handle star: SELECT *
    if (node.type === 'all_columns') {
        return '*';
    }

    // Handle qualified star: SELECT t.*
    if (node.type === 'member_expr' && node.property?.type === 'all_columns') {
        const table = node.object?.name || node.object?.text || '';
        return `${table}.*`;
    }

    // Handle simple identifier: SELECT col
    if (node.type === 'identifier') {
        return node.name || node.text;
    }

    // Handle member expression: SELECT t.col
    if (node.type === 'member_expr') {
        return node.property?.name || node.property?.text;
    }

    // Handle function calls: SELECT func(x) - use function name if no alias
    if (node.type === 'func_call') {
        const funcName = node.name?.name || node.name?.text;
        if (funcName) { return funcName; }
    }

    return null;
}

/**
 * Get all CTE names defined in the SQL
 */
export function getCteNames(sql: string): string[] {
    try {
        const cst = parseCst(sql, { dialect: "bigquery" });
        const names: string[] = [];

        const visitor = cstVisitor({
            common_table_expr: (node: CstNode) => {
                const name = node.table?.name || node.table?.text;
                if (name) {
                    names.push(name);
                }
            }
        });

        visitor(cst);
        return names;
    } catch {
        return [];
    }
}
