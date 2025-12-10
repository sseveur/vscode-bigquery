import { parse } from "sql-parser-cst";

export interface SplitQuery {
    sql: string;
    startOffset: number;
    endOffset: number;
    startLine: number;
    endLine: number;
}

/**
 * Split SQL text into individual queries using sql-parser-cst
 * Properly handles semicolons in strings and comments
 */
export function splitQueries(fullSql: string): SplitQuery[] {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cst: any = parse(fullSql, { dialect: "bigquery", includeRange: true });

        if (cst.type !== 'program' || !cst.statements) {
            return [singleQuery(fullSql)];
        }

        const queries: SplitQuery[] = [];
        for (const stmt of cst.statements) {
            if (!stmt.range) { continue; }
            const [startOffset, endOffset] = stmt.range;
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
    } catch {
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
