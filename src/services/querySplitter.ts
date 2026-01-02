import { parse } from "sql-parser-cst";

export interface SplitQuery {
    sql: string;
    startOffset: number;
    endOffset: number;
    startLine: number;
    endLine: number;
}

/**
 * Pre-process SQL to remove syntax that sql-parser-cst doesn't support
 * This allows the parser to work, while we extract from the original SQL
 * IMPORTANT: Replace with spaces to maintain offset alignment
 */
function preprocessForParser(sql: string): string {
    // Replace "NULLS LAST" and "NULLS FIRST" with spaces to maintain offsets
    // Pattern: match DESC/ASC followed by NULLS LAST/FIRST
    const nullsPattern = /\b(DESC|ASC)(\s+NULLS\s+(?:LAST|FIRST))\b/gi;
    return sql.replace(nullsPattern, (match, direction, nullsPart) => {
        // Keep DESC/ASC, replace "NULLS LAST/FIRST" with spaces
        return direction + ' '.repeat(nullsPart.length);
    });
}

/**
 * Split SQL text into individual queries using sql-parser-cst
 * Properly handles semicolons in strings and comments
 */
export function splitQueries(fullSql: string): SplitQuery[] {
    try {
        // Pre-process SQL to handle unsupported syntax (NULLS LAST/FIRST)
        const processedSql = preprocessForParser(fullSql);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cst: any = parse(processedSql, { dialect: "bigquery", includeRange: true });

        if (cst.type !== 'program' || !cst.statements) {
            return [singleQuery(fullSql)];
        }

        const queries: SplitQuery[] = [];
        for (const stmt of cst.statements) {
            if (!stmt.range) { continue; }
            const [startOffset, endOffset] = stmt.range;
            // IMPORTANT: Extract from ORIGINAL SQL to preserve all syntax
            const sql = fullSql.substring(startOffset, endOffset).trim();
            if (!sql) { continue; }

            queries.push({
                sql,
                startOffset,
                endOffset,
                startLine: offsetToLine(fullSql, startOffset),
                endLine: offsetToLine(fullSql, endOffset)
            });
        }
        return queries.length > 0 ? queries : [singleQuery(fullSql)];
    } catch (error) {
        // Log parse errors for debugging
        console.warn('[Lineage] Query splitting failed:', error instanceof Error ? error.message : String(error));
        return [singleQuery(fullSql)];
    }
}

function singleQuery(sql: string): SplitQuery {
    return {
        sql: sql.trim(),
        startOffset: 0,
        endOffset: sql.length,
        startLine: 1,
        endLine: countLines(sql)
    };
}

function offsetToLine(source: string, offset: number): number {
    let line = 1;
    for (let i = 0; i < offset && i < source.length; i++) {
        if (source[i] === '\n') { line++; }
    }
    return line;
}

function countLines(source: string): number {
    return (source.match(/\n/g) || []).length + 1;
}
