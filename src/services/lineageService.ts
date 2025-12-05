import { parse } from "@bstruct/bqsql-parser";
import { BqsqlDocument, BqsqlDocumentItem } from "../language/bqsqlDocument";

export interface LineageTable {
    fullName: string;           // project.dataset.table or dataset.table or table
    projectId?: string;
    datasetId?: string;
    tableId: string;
    role: 'source' | 'target';
    statementType?: string;     // INSERT, CREATE, MERGE, UPDATE, DELETE
}

export interface LineageData {
    sources: LineageTable[];    // Tables read from
    targets: LineageTable[];    // Tables written to
    queryPreview: string;       // First 100 chars of query
}

export function extractLineage(sql: string): LineageData {
    const parsed = parse(sql) as BqsqlDocument;
    const sources: LineageTable[] = [];
    const targets: LineageTable[] = [];
    const seenSources = new Set<string>();
    const seenTargets = new Set<string>();

    // Extract source tables using parser (FROM, JOIN clauses)
    const tableIdentifiers = findAllTableIdentifiers(parsed.items);
    for (const tableId of tableIdentifiers) {
        const tableName = extractTableName(sql, tableId);
        if (tableName && !seenSources.has(tableName.toLowerCase())) {
            seenSources.add(tableName.toLowerCase());
            sources.push(parseTableName(tableName, 'source'));
        }
    }

    // Extract target tables using regex patterns
    const targetMatches = extractTargetTables(sql);
    for (const match of targetMatches) {
        const normalizedName = match.tableName.toLowerCase();
        if (!seenTargets.has(normalizedName)) {
            seenTargets.add(normalizedName);
            const table = parseTableName(match.tableName, 'target');
            table.statementType = match.statementType;
            targets.push(table);
        }
    }

    // Remove targets from sources if they appear in both (a table being written to
    // might also appear in FROM clause for MERGE/UPDATE with self-reference)
    const filteredSources = sources.filter(s =>
        !seenTargets.has(s.fullName.toLowerCase())
    );

    // Create query preview (first 100 chars, normalized)
    const queryPreview = sql.replace(/\s+/g, ' ').trim().substring(0, 100);

    return {
        sources: filteredSources,
        targets,
        queryPreview: queryPreview + (sql.length > 100 ? '...' : '')
    };
}

interface TargetMatch {
    tableName: string;
    statementType: string;
}

function extractTargetTables(sql: string): TargetMatch[] {
    const results: TargetMatch[] = [];

    // Regex patterns for different DML/DDL statements
    // Pattern for table names: either backtick-quoted or unquoted identifiers with dots
    const tablePattern = '(`[^`]+`|[a-zA-Z_][a-zA-Z0-9_]*(?:\\.[a-zA-Z_][a-zA-Z0-9_]*)*)';

    // INSERT INTO table_name
    const insertPattern = new RegExp(
        `INSERT\\s+(?:INTO\\s+)?${tablePattern}`,
        'gi'
    );

    // CREATE [OR REPLACE] [TEMP|TEMPORARY] TABLE [IF NOT EXISTS] table_name
    const createPattern = new RegExp(
        `CREATE\\s+(?:OR\\s+REPLACE\\s+)?(?:TEMP(?:ORARY)?\\s+)?TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${tablePattern}`,
        'gi'
    );

    // CREATE [OR REPLACE] [MATERIALIZED] VIEW [IF NOT EXISTS] view_name
    const createViewPattern = new RegExp(
        `CREATE\\s+(?:OR\\s+REPLACE\\s+)?(?:MATERIALIZED\\s+)?VIEW\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${tablePattern}`,
        'gi'
    );

    // MERGE [INTO] table_name
    const mergePattern = new RegExp(
        `MERGE\\s+(?:INTO\\s+)?${tablePattern}`,
        'gi'
    );

    // UPDATE table_name SET
    const updatePattern = new RegExp(
        `UPDATE\\s+${tablePattern}\\s+(?:AS\\s+\\w+\\s+)?SET`,
        'gi'
    );

    // DELETE [FROM] table_name
    const deletePattern = new RegExp(
        `DELETE\\s+(?:FROM\\s+)?${tablePattern}`,
        'gi'
    );

    // TRUNCATE TABLE table_name
    const truncatePattern = new RegExp(
        `TRUNCATE\\s+TABLE\\s+${tablePattern}`,
        'gi'
    );

    // Process each pattern
    const patterns: Array<{ pattern: RegExp; type: string }> = [
        { pattern: insertPattern, type: 'INSERT' },
        { pattern: createPattern, type: 'CREATE TABLE' },
        { pattern: createViewPattern, type: 'CREATE VIEW' },
        { pattern: mergePattern, type: 'MERGE' },
        { pattern: updatePattern, type: 'UPDATE' },
        { pattern: deletePattern, type: 'DELETE' },
        { pattern: truncatePattern, type: 'TRUNCATE' },
    ];

    for (const { pattern, type } of patterns) {
        let match;
        while ((match = pattern.exec(sql)) !== null) {
            if (match[1]) {
                // Clean up the table name (remove backticks)
                const tableName = match[1].replace(/`/g, '');
                results.push({
                    tableName,
                    statementType: type
                });
            }
        }
    }

    return results;
}

function findAllTableIdentifiers(items: BqsqlDocumentItem[]): BqsqlDocumentItem[] {
    const result: BqsqlDocumentItem[] = [];

    for (const item of items) {
        if (item.item_type === "TableIdentifier") {
            result.push(item);
        }

        // Recursively search nested items
        if (item.items && item.items.length > 0) {
            result.push(...findAllTableIdentifiers(item.items));
        }
    }

    return result;
}

function extractTableName(documentContent: string, tableIdentifier: BqsqlDocumentItem): string | null {
    const lines = documentContent.split('\n');
    const ranges = getAllRanges(tableIdentifier);

    if (ranges.length === 0) return null;

    // Get text from the ranges
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

    // Join and clean up
    let tableName = parts.join('');
    // Remove backticks for display
    tableName = tableName.replace(/`/g, '');
    // Strip any trailing alias that might have been captured (e.g., "table AS alias")
    tableName = tableName.replace(/\s+as\s+\w+$/i, '').trim();
    return tableName;
}

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

function parseTableName(fullName: string, role: 'source' | 'target'): LineageTable {
    const parts = fullName.split('.');

    if (parts.length === 3) {
        return {
            fullName,
            projectId: parts[0],
            datasetId: parts[1],
            tableId: parts[2],
            role
        };
    } else if (parts.length === 2) {
        return {
            fullName,
            datasetId: parts[0],
            tableId: parts[1],
            role
        };
    } else {
        return {
            fullName,
            tableId: parts[0],
            role
        };
    }
}
