import { extractTableReferences, TableReference } from "./sqlTableExtractor";

export interface LineageTable {
    fullName: string;           // project.dataset.table or dataset.table or table
    projectId?: string;
    datasetId?: string;
    tableId: string;
    role: 'source' | 'target';
    statementType?: string;     // INSERT, CREATE, MERGE, UPDATE, DELETE
    line?: number;              // Source line number for navigation
    column?: number;            // Source column number for navigation
}

export interface LineageData {
    sources: LineageTable[];    // Tables read from
    targets: LineageTable[];    // Tables written to
    queryPreview: string;       // First 100 chars of query
}

export function extractLineage(sql: string): LineageData {
    const sources: LineageTable[] = [];
    const targets: LineageTable[] = [];
    const seenSources = new Set<string>();  // Track by table name only (deduplicate physical tables)
    const seenTargets = new Set<string>();

    // Extract source tables using sql-parser-cst (handles JOINs, comma-separated, etc.)
    const tableRefs = extractTableReferences(sql);
    for (const tableRef of tableRefs) {
        if (tableRef.name) {
            // Deduplicate by table name only (ignore aliases - one node per physical table)
            const uniqueKey = tableRef.name.toLowerCase();
            if (!seenSources.has(uniqueKey)) {
                seenSources.add(uniqueKey);
                const table = parseTableName(tableRef.name, 'source');
                table.line = tableRef.line;
                table.column = tableRef.column;
                sources.push(table);
            }
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
            table.line = match.line;
            table.column = match.column;
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
    line?: number;
    column?: number;
}

/**
 * Convert offset in source string to line/column
 */
function offsetToLineColumn(source: string, offset: number): { line: number; column: number } {
    let line = 1;
    let column = 1;
    for (let i = 0; i < offset && i < source.length; i++) {
        if (source[i] === '\n') {
            line++;
            column = 1;
        } else {
            column++;
        }
    }
    return { line, column };
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
                // Calculate position - find where the table name starts in the match
                const tableNameStart = match.index + match[0].indexOf(match[1]);
                const position = offsetToLineColumn(sql, tableNameStart);
                results.push({
                    tableName,
                    statementType: type,
                    line: position.line,
                    column: position.column
                });
            }
        }
    }

    return results;
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
