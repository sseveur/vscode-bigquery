import { parse, cstVisitor } from "sql-parser-cst";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CstNode = any;

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
 * Recursively find table references in JOIN expressions
 */
function findTablesInExpr(node: CstNode, tables: string[]) {
    if (!node) { return; }

    if (node.type === 'join_expr') {
        findTablesInExpr(node.left, tables);
        findTablesInExpr(node.right, tables);
    } else if (node.type === 'list_expr') {
        for (const item of node.items || []) {
            findTablesInExpr(item, tables);
        }
    } else if (node.type === 'paren_expr') {
        findTablesInExpr(node.expr, tables);
    } else {
        const name = getTableName(node);
        if (name && !tables.includes(name)) {
            tables.push(name);
        }
    }
}

/**
 * Extract table references from SQL using sql-parser-cst
 * Handles: JOINs, comma-separated tables, backtick-quoted, 4-part identifiers
 */
export function extractTableReferences(sql: string): string[] {
    try {
        const cst = parse(sql, { dialect: "bigquery" });
        const tables: string[] = [];

        const visitor = cstVisitor({
            from_clause: (node: CstNode) => {
                findTablesInExpr(node.expr, tables);
            }
        });

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
        const nameCollector = cstVisitor({
            common_table_expr: (node: CstNode) => {
                const name = node.table?.name || node.table?.text;
                if (name) {
                    cteNames.add(name.toLowerCase());
                }
            }
        });
        nameCollector(cst);

        // Second pass: extract CTEs with their dependencies
        const cteExtractor = cstVisitor({
            common_table_expr: (node: CstNode) => {
                const name = node.table?.name || node.table?.text;
                if (!name) { return; }

                const tables: string[] = [];

                // Find tables in the CTE's query body (node.expr is the AS (...) part)
                const bodyVisitor = cstVisitor({
                    from_clause: (fromNode: CstNode) => {
                        findTablesInExpr(fromNode.expr, tables);
                    }
                });

                // The CTE body is typically in node.expr (the query inside parentheses)
                if (node.expr) {
                    bodyVisitor(node.expr);
                }

                // Separate source tables from CTE references
                const sourceTables: string[] = [];
                const referencedCtes: string[] = [];

                for (const table of tables) {
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

        cteExtractor(cst);
        return ctes;
    } catch {
        // Fallback: return empty if parsing fails
        return [];
    }
}
