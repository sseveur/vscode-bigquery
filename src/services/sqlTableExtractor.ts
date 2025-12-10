import { parse, cstVisitor } from "sql-parser-cst";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CstNode = any;

export interface TableReference {
    name: string;
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

/**
 * Helper to get identifier name from member_expr (nested)
 */
function getMemberExprName(node: CstNode): string | null {
    if (!node) { return null; }

    if (node.type === 'member_expr') {
        const objName = getMemberExprName(node.object);
        const propName = node.property?.name || node.property?.text;
        return objName && propName ? `${objName}.${propName}` : propName;
    }

    if (node.type === 'identifier') {
        return node.name || node.text;
    }

    return null;
}

/**
 * Get table name from various node types
 */
function getTableName(node: CstNode): string | null {
    if (!node) { return null; }

    if (node.type === 'identifier') {
        return node.name || node.text;
    }

    if (node.type === 'member_expr') {
        return getMemberExprName(node);
    }

    // BigQuery backtick-quoted table reference
    if (node.type === 'bigquery_quoted_member_expr') {
        return getMemberExprName(node.expr);
    }

    // Aliased table - get the actual table
    if (node.type === 'alias') {
        return getTableName(node.expr);
    }

    return null;
}

/**
 * Get range from node (returns start offset)
 */
function getNodeRange(node: CstNode): number | undefined {
    if (node?.range && Array.isArray(node.range)) {
        return node.range[0];
    }
    // Try to get range from nested nodes
    if (node?.table?.range) {
        return node.table.range[0];
    }
    if (node?.expr?.range) {
        return node.expr.range[0];
    }
    return undefined;
}

/**
 * Recursively find table references in JOIN expressions
 */
function findTablesInExpr(node: CstNode, tables: TableReference[], source: string) {
    if (!node) { return; }

    if (node.type === 'join_expr') {
        findTablesInExpr(node.left, tables, source);
        findTablesInExpr(node.right, tables, source);
    } else if (node.type === 'list_expr') {
        for (const item of node.items || []) {
            findTablesInExpr(item, tables, source);
        }
    } else if (node.type === 'paren_expr') {
        findTablesInExpr(node.expr, tables, source);
    } else {
        const name = getTableName(node);
        if (name && !tables.some(t => t.name === name)) {
            const offset = getNodeRange(node);
            const position = offset !== undefined ? offsetToLineColumn(source, offset) : undefined;
            tables.push({
                name,
                line: position?.line,
                column: position?.column
            });
        }
    }
}

/**
 * Extract table references from SQL using sql-parser-cst
 * Handles: JOINs, comma-separated tables, backtick-quoted, 4-part identifiers
 */
export function extractTableReferences(sql: string): TableReference[] {
    try {
        const cst = parse(sql, { dialect: "bigquery", includeRange: true });
        const tables: TableReference[] = [];

        /* eslint-disable @typescript-eslint/naming-convention */
        const visitor = cstVisitor({
            from_clause: (node: CstNode) => {
                findTablesInExpr(node.expr, tables, sql);
            }
        });
        /* eslint-enable @typescript-eslint/naming-convention */

        visitor(cst);
        return tables;
    } catch {
        // Fallback: return empty if parsing fails
        return [];
    }
}

/**
 * CTE definition extracted from SQL
 */
export interface ExtractedCte {
    name: string;
    sourceTables: string[];
    referencedCtes: string[];
}

/**
 * Extract CTE definitions and their dependencies using sql-parser-cst
 * Returns CTE names, source tables, and referenced CTEs
 */
export function extractCtesWithDependencies(sql: string): ExtractedCte[] {
    try {
        const cst = parse(sql, { dialect: "bigquery" });
        const ctes: ExtractedCte[] = [];
        const cteNames = new Set<string>();

        // First pass: collect all CTE names
        /* eslint-disable @typescript-eslint/naming-convention */
        const nameCollector = cstVisitor({
            common_table_expr: (node: CstNode) => {
                const name = node.table?.name || node.table?.text;
                if (name) {
                    cteNames.add(name.toLowerCase());
                }
            }
        });
        /* eslint-enable @typescript-eslint/naming-convention */
        nameCollector(cst);

        // Second pass: extract CTEs with their dependencies
        /* eslint-disable @typescript-eslint/naming-convention */
        const cteExtractor = cstVisitor({
            common_table_expr: (node: CstNode) => {
                const name = node.table?.name || node.table?.text;
                if (!name) { return; }

                const tableRefs: TableReference[] = [];

                // Find tables in the CTE's query body (node.expr is the AS (...) part)
                const bodyVisitor = cstVisitor({
                    from_clause: (fromNode: CstNode) => {
                        findTablesInExpr(fromNode.expr, tableRefs, sql);
                    }
                });

                // The CTE body is typically in node.expr (the query inside parentheses)
                if (node.expr) {
                    bodyVisitor(node.expr);
                }

                // Separate source tables from CTE references
                const sourceTables: string[] = [];
                const referencedCtes: string[] = [];

                for (const tableRef of tableRefs) {
                    const table = tableRef.name;
                    if (cteNames.has(table.toLowerCase())) {
                        referencedCtes.push(table);
                    } else {
                        sourceTables.push(table);
                    }
                }

                ctes.push({
                    name,
                    sourceTables: [...new Set(sourceTables)],
                    referencedCtes: [...new Set(referencedCtes)]
                });
            }
        });
        /* eslint-enable @typescript-eslint/naming-convention */

        cteExtractor(cst);
        return ctes;
    } catch {
        // Fallback: return empty if parsing fails
        return [];
    }
}
