import { parse } from "@bstruct/bqsql-parser";
import { BqsqlDocument, BqsqlDocumentItem } from "../language/bqsqlDocument";

export interface CteDefinition {
    name: string;                      // CTE name
    range: number[];                   // Parser position [line, start, end]
    sourceTables: string[];            // Physical tables referenced directly
    referencedCtes: string[];          // Other CTEs referenced
}

/**
 * Extract all CTE definitions from SQL query
 */
export function extractCtes(sql: string): CteDefinition[] {
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
 */
function extractDependencies(
    queryItem: BqsqlDocumentItem,
    sourceTables: string[],
    referencedCtes: string[],
    knownCteNames: Set<string>,
    sql: string
): void {
    for (const item of queryItem.items || []) {
        if (item.item_type === "TableIdentifier") {
            // Found a table reference
            const tableName = extractTableNameFromIdentifier(item, sql);
            if (tableName) {
                // Check if this is a CTE reference or a real table
                if (knownCteNames.has(tableName.toLowerCase())) {
                    referencedCtes.push(tableName);
                } else {
                    sourceTables.push(tableName);
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
