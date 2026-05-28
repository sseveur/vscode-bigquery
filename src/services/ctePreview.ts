import { parse } from "sql-parser-cst";

export interface CtePreview {
    /** CTE name as written (unquoted). */
    name: string;
    /** Character offset of the CTE name in the source — used to place the CodeLens. */
    nameOffset: number;
    /**
     * Rewritten query that selects from this CTE. Keeps every CTE from the start
     * of the WITH clause through this one (positional truncation), which inherently
     * includes all of its dependencies — SQL forbids a CTE from referencing one
     * defined later, so everything the target needs is already above it.
     */
    previewSql: string;
}

/**
 * Builds a "preview this CTE" query for every CTE in each top-level WITH clause.
 *
 * For a CTE at position i, the preview keeps `WITH cte0 …, ctei` verbatim from the
 * source (preserving RECURSIVE, comments, formatting) and appends
 * `SELECT * FROM <ctei> LIMIT <rowLimit>`.
 *
 * Returns an empty array if the SQL fails to parse. Nested CTEs inside subqueries
 * are intentionally ignored — only the outermost WITH per statement is surfaced.
 */
export function extractCtePreviews(sql: string, rowLimit: number): CtePreview[] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cst: any;
    try {
        cst = parse(sql, { dialect: "bigquery", includeRange: true });
    } catch {
        return [];
    }

    if (!cst || cst.type !== "program" || !Array.isArray(cst.statements)) {
        return [];
    }

    const limit = Number.isFinite(rowLimit) && rowLimit > 0 ? Math.floor(rowLimit) : 100;
    const previews: CtePreview[] = [];

    for (const stmt of cst.statements) {
        const withClause = findOutermostWithClause(stmt);
        if (!withClause) { continue; }

        const startOffset: number | undefined = withClause.withKw?.range?.[0];
        const items: unknown[] | undefined = withClause.tables?.items;
        if (typeof startOffset !== "number" || !Array.isArray(items)) { continue; }

        for (const cte of items) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const node = cte as any;
            if (node?.type !== "common_table_expr") { continue; }

            const name: string | undefined = node.table?.name;
            const nameOffset: number | undefined = node.table?.range?.[0];
            const endOffset: number | undefined = node.range?.[1];
            if (!name || typeof nameOffset !== "number" || typeof endOffset !== "number") { continue; }

            const head = sql.slice(startOffset, endOffset);
            const previewSql = `${head}\nSELECT * FROM \`${name}\` LIMIT ${limit}`;
            previews.push({ name, nameOffset, previewSql });
        }
    }

    return previews;
}

/**
 * Returns the WITH clause with the smallest start offset within a statement — i.e.
 * the outermost one. Nested WITH clauses (inside subqueries) have larger offsets
 * and are skipped, so we only surface CTEs the user can reference at top level.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findOutermostWithClause(node: any): any | null {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let best: any = null;

    const walk = (n: unknown): void => {
        if (!n || typeof n !== "object") { return; }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const obj = n as any;
        if (obj.type === "with_clause") {
            const start = obj.range?.[0] ?? Number.POSITIVE_INFINITY;
            const bestStart = best?.range?.[0] ?? Number.POSITIVE_INFINITY;
            if (start < bestStart) { best = obj; }
        }
        for (const key of Object.keys(obj)) {
            const value = obj[key];
            if (Array.isArray(value)) {
                value.forEach(walk);
            } else if (value && typeof value === "object") {
                walk(value);
            }
        }
    };

    walk(node);
    return best;
}
