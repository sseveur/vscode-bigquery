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
            // Within QueryWith, find all CTE names
            // Parser may mark them as "TableCteId" or "Unknown" depending on context
            const children = item.items || [];
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                // Look for TableCteId items
                if (child.item_type === "TableCteId") {
                    const name = extractTextFromRange(sql, child.range);
                    if (name) {
                        cteNames.add(name.toLowerCase());
                    }
                }
                // Also look for Unknown items followed by AS keyword (likely CTE names)
                else if (child.item_type === "Unknown") {
                    const nextChild = children[i + 1];
                    if (nextChild && nextChild.item_type === "Keyword") {
                        const keyword = extractTextFromRange(sql, nextChild.range);
                        if (keyword && keyword.toUpperCase() === "AS") {
                            const name = extractTextFromRange(sql, child.range);
                            if (name && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
                                cteNames.add(name.toLowerCase());
                            }
                        }
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
 * Structure: QueryWith contains [Keyword(WITH), TableCteId/Unknown, Keyword(AS), Query, ...]
 * Note: Parser may mark CTE names as "Unknown" instead of "TableCteId" in some cases
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
        } else if (child.item_type === "Unknown") {
            // Check if this Unknown item is followed by AS keyword (likely a CTE name)
            const nextChild = children[i + 1];
            if (nextChild && nextChild.item_type === "Keyword") {
                const keyword = extractTextFromRange(sql, nextChild.range);
                if (keyword && keyword.toUpperCase() === "AS") {
                    const name = extractTextFromRange(sql, child.range);
                    if (name && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
                        currentCteName = name;
                        currentCteRange = child.range || [];
                    }
                }
            }
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
 * Extract the SQL text for a specific query item based on its range
 */
function extractSqlForQueryItem(queryItem: BqsqlDocumentItem, sql: string): string | null {
    // Get all ranges from the query item to determine bounds
    const ranges = getAllRanges(queryItem);
    if (ranges.length === 0) { return null; }

    const lines = sql.split('\n');

    // Find min and max line numbers covered by this query item
    let minLine = Infinity;
    let maxLine = -1;
    for (const range of ranges) {
        if (range[0] < minLine) { minLine = range[0]; }
        if (range[0] > maxLine) { maxLine = range[0]; }
    }

    if (minLine === Infinity || maxLine < 0 || minLine >= lines.length) {
        return null;
    }

    // Extract the lines containing the CTE body
    const relevantLines = lines.slice(minLine, maxLine + 1);
    return relevantLines.join('\n');
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
    // Try to extract just the SQL for this specific query item
    // This ensures we only find tables within this CTE body, not the entire SQL
    const cteSql = extractSqlForQueryItem(queryItem, sql);

    if (cteSql) {
        // Try to use sql-parser-cst to extract tables from just the CTE body
        // This handles JOINs and other cases @bstruct misses
        const allTables = extractTableReferences(cteSql);

        for (const tableRef of allTables) {
            const tableName = tableRef.name;
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

    if (ranges.length === 0) {return null;}

    const parts: string[] = [];
    for (const range of ranges) {
        try {
            const text = lines[range[0]].substring(range[1], range[2]);
            if (text) {
                // Stop if we hit an alias keyword (AS)
                if (/^\s*as\s*$/i.test(text)) {break;}
                parts.push(text);
            }
        } catch { }
    }

    if (parts.length === 0) {return null;}

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
    if (!range || range.length < 3) {return null;}

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

        /* eslint-disable @typescript-eslint/naming-convention */
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
        /* eslint-enable @typescript-eslint/naming-convention */

        visitor(cst);
        return columns;
    } catch (e) {
        // Fallback: use regex when parser fails (e.g., during typing with incomplete SQL)
        return extractCteColumnsRegex(sql, cteName);
    }
}

/**
 * Regex fallback for extracting CTE columns from incomplete SQL
 * Extracts columns from the SELECT clause of the specified CTE
 */
function extractCteColumnsRegex(sql: string, cteName: string): CteColumn[] {
    const columns: CteColumn[] = [];

    // Find the CTE definition start: cteName AS ( SELECT
    const cteStartPattern = new RegExp(
        `\\b${cteName}\\s+AS\\s*\\(\\s*SELECT\\s+`,
        'is'
    );

    const startMatch = cteStartPattern.exec(sql);
    if (!startMatch) {
        return columns;
    }

    // Find the SELECT columns by looking for FROM (respecting parentheses)
    const afterSelect = sql.substring(startMatch.index + startMatch[0].length);
    const selectClause = extractUntilFrom(afterSelect);

    if (!selectClause) {
        return columns;
    }

    // Parse individual column expressions
    // This is simplified - handles: col, col AS alias, table.col, table.col AS alias, func() AS alias
    const columnParts = splitSelectColumns(selectClause);

    for (const part of columnParts) {
        const trimmed = part.trim();
        if (!trimmed) { continue; }

        // Check for AS alias
        const asMatch = trimmed.match(/\bAS\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*$/i);
        if (asMatch) {
            columns.push({ name: asMatch[1] });
            continue;
        }

        // Check for table.column or just column
        const colMatch = trimmed.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*$/);
        if (colMatch) {
            columns.push({ name: colMatch[1] });
            continue;
        }

        // Check for * or table.*
        if (trimmed === '*' || trimmed.endsWith('.*')) {
            columns.push({ name: trimmed });
        }
    }

    return columns;
}

/**
 * Extract text until FROM keyword, respecting nested parentheses
 * This handles cases like: col1, IF(x, y, z), func(a, b) FROM table
 */
function extractUntilFrom(text: string): string | null {
    let parenDepth = 0;
    let i = 0;

    while (i < text.length) {
        const char = text[i];

        if (char === '(') {
            parenDepth++;
        } else if (char === ')') {
            parenDepth--;
            if (parenDepth < 0) {
                // We've hit the closing paren of the CTE itself
                return null;
            }
        } else if (parenDepth === 0) {
            // Check for FROM keyword (only at paren depth 0)
            const remaining = text.substring(i);
            if (/^\s*FROM\b/i.test(remaining)) {
                return text.substring(0, i).trim();
            }
        }

        i++;
    }

    return null;
}

/**
 * Split SELECT column list, respecting parentheses for function calls
 */
function splitSelectColumns(selectClause: string): string[] {
    const columns: string[] = [];
    let current = '';
    let parenDepth = 0;

    for (const char of selectClause) {
        if (char === '(') {
            parenDepth++;
            current += char;
        } else if (char === ')') {
            parenDepth--;
            current += char;
        } else if (char === ',' && parenDepth === 0) {
            columns.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    if (current.trim()) {
        columns.push(current.trim());
    }

    return columns;
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
 * Uses parser when possible, falls back to regex for incomplete SQL (during typing)
 */
export function getCteNames(sql: string): string[] {
    try {
        const cst = parseCst(sql, { dialect: "bigquery" });
        const names: string[] = [];

        /* eslint-disable @typescript-eslint/naming-convention */
        const visitor = cstVisitor({
            common_table_expr: (node: CstNode) => {
                const name = node.table?.name || node.table?.text;
                if (name) {
                    names.push(name);
                }
            }
        });
        /* eslint-enable @typescript-eslint/naming-convention */

        visitor(cst);
        return names;
    } catch {
        // Fallback: use regex when parser fails (e.g., during typing with incomplete SQL)
        return getCteNamesRegex(sql);
    }
}

/**
 * Regex fallback for extracting CTE names from incomplete SQL
 * Handles: WITH cte_name AS (...), cte_name2 AS (...)
 */
function getCteNamesRegex(sql: string): string[] {
    const names: string[] = [];

    // Match CTE definitions: WITH name AS or , name AS
    // Pattern: (WITH|,)\s*name\s+AS\s*\(
    const ctePattern = /(?:WITH|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s+AS\s*\(/gi;

    let match;
    while ((match = ctePattern.exec(sql)) !== null) {
        if (match[1] && !names.includes(match[1])) {
            names.push(match[1]);
        }
    }

    return names;
}
