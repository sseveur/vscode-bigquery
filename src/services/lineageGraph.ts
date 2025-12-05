import { extractCtes, CteDefinition } from "./cteExtractor";
import { extractLineage, LineageTable } from "./lineageService";

export type NodeType = 'SOURCE' | 'CTE' | 'TARGET';

export interface LineageNode {
    id: string;                    // Unique identifier
    name: string;                  // Display name (table or CTE name)
    fullName: string;              // Full qualified name
    nodeType: NodeType;
    statementType?: string;        // INSERT, CREATE, MERGE, etc.
    layer: number;                 // Horizontal position (0=sources, n=targets)
    x?: number;                    // Calculated by layout engine
    y?: number;                    // Calculated by layout engine
}

export interface LineageEdge {
    id: string;
    source: string;                // Source node id
    target: string;                // Target node id
}

export interface LineageGraph {
    nodes: LineageNode[];
    edges: LineageEdge[];
    queryPreview: string;
}

/**
 * Build a complete lineage graph from SQL including CTEs
 */
export function buildLineageGraph(sql: string): LineageGraph {
    const ctes = extractCtes(sql);
    const basicLineage = extractLineage(sql);

    const nodes: LineageNode[] = [];
    const edges: LineageEdge[] = [];
    const nodeMap = new Map<string, LineageNode>();

    // Track which tables are referenced by CTEs (to exclude from sources displayed)
    const cteReferencedTables = new Set<string>();
    const cteNames = new Set(ctes.map(c => c.name.toLowerCase()));

    // Collect all tables referenced within CTEs
    for (const cte of ctes) {
        for (const table of cte.sourceTables) {
            cteReferencedTables.add(table.toLowerCase());
        }
    }

    // 1. Add source table nodes (layer 0)
    // Only include tables that are NOT referenced only inside CTEs
    // or tables that appear in the main query
    const allSourceTables = new Set<string>();
    for (const source of basicLineage.sources) {
        allSourceTables.add(source.fullName.toLowerCase());
    }

    // Add CTE source tables
    for (const cte of ctes) {
        for (const table of cte.sourceTables) {
            allSourceTables.add(table.toLowerCase());
        }
    }

    // Create source nodes
    for (const tableName of allSourceTables) {
        // Skip if this is a CTE name
        if (cteNames.has(tableName)) continue;

        const id = `source_${tableName}`;
        const displayName = getDisplayName(tableName);
        const node: LineageNode = {
            id,
            name: displayName,
            fullName: tableName,
            nodeType: 'SOURCE',
            layer: 0
        };
        nodes.push(node);
        nodeMap.set(tableName, node);
    }

    // 2. Add CTE nodes with layer assignment based on dependencies
    const cteLayers = calculateCteLayers(ctes);
    for (const cte of ctes) {
        const id = `cte_${cte.name.toLowerCase()}`;
        const layer = cteLayers.get(cte.name.toLowerCase()) || 1;
        const node: LineageNode = {
            id,
            name: cte.name,
            fullName: cte.name,
            nodeType: 'CTE',
            layer
        };
        nodes.push(node);
        nodeMap.set(cte.name.toLowerCase(), node);
    }

    // 3. Add target table nodes (final layer)
    const maxCteLayer = Math.max(0, ...Array.from(cteLayers.values()));
    const targetLayer = maxCteLayer + 1;

    for (const target of basicLineage.targets) {
        const tableName = target.fullName.toLowerCase();
        // Skip if this is a CTE name (CTEs can appear in INSERT targets)
        if (cteNames.has(tableName)) continue;

        const id = `target_${tableName}`;
        const displayName = getDisplayName(target.fullName);
        const node: LineageNode = {
            id,
            name: displayName,
            fullName: target.fullName,
            nodeType: 'TARGET',
            statementType: target.statementType,
            layer: targetLayer
        };
        nodes.push(node);
        nodeMap.set(tableName, node);
    }

    // 4. Build edges

    // CTE edges: source tables -> CTEs
    for (const cte of ctes) {
        const cteNode = nodeMap.get(cte.name.toLowerCase());
        if (!cteNode) continue;

        // Edges from source tables to this CTE
        for (const sourceTable of cte.sourceTables) {
            const sourceNode = nodeMap.get(sourceTable.toLowerCase());
            if (sourceNode) {
                edges.push({
                    id: `edge_${sourceNode.id}_${cteNode.id}`,
                    source: sourceNode.id,
                    target: cteNode.id
                });
            }
        }

        // Edges from referenced CTEs to this CTE
        for (const refCte of cte.referencedCtes) {
            const refNode = nodeMap.get(refCte.toLowerCase());
            if (refNode) {
                edges.push({
                    id: `edge_${refNode.id}_${cteNode.id}`,
                    source: refNode.id,
                    target: cteNode.id
                });
            }
        }
    }

    // Target edges: find what feeds into targets
    if (basicLineage.targets.length > 0) {
        // Find CTEs referenced in main query
        const mainQueryCtes = ctes.length > 0 ? findMainQueryCteReferences(sql, ctes) : [];

        // Find source tables referenced directly in main query (not just in CTEs)
        const mainQuerySources = findMainQuerySourceReferences(sql, allSourceTables, cteNames);

        for (const target of basicLineage.targets) {
            const targetNode = nodeMap.get(target.fullName.toLowerCase());
            if (!targetNode) continue;

            // Connect CTEs that are used in main query to target
            for (const cteName of mainQueryCtes) {
                const cteNode = nodeMap.get(cteName.toLowerCase());
                if (cteNode) {
                    edges.push({
                        id: `edge_${cteNode.id}_${targetNode.id}`,
                        source: cteNode.id,
                        target: targetNode.id
                    });
                }
            }

            // Connect source tables that are used directly in main query to target
            for (const sourceName of mainQuerySources) {
                const sourceNode = nodeMap.get(sourceName.toLowerCase());
                if (sourceNode) {
                    edges.push({
                        id: `edge_${sourceNode.id}_${targetNode.id}`,
                        source: sourceNode.id,
                        target: targetNode.id
                    });
                }
            }

            // If no CTEs and no main query sources found, connect all sources
            if (mainQueryCtes.length === 0 && mainQuerySources.length === 0 && ctes.length === 0) {
                for (const source of basicLineage.sources) {
                    const sourceNode = nodeMap.get(source.fullName.toLowerCase());
                    if (sourceNode) {
                        edges.push({
                            id: `edge_${sourceNode.id}_${targetNode.id}`,
                            source: sourceNode.id,
                            target: targetNode.id
                        });
                    }
                }
            }
        }
    }

    // For SELECT-only queries (no targets), connect last layer to a virtual "result" if needed
    // We'll skip this for now - just show sources and CTEs

    return {
        nodes,
        edges,
        queryPreview: basicLineage.queryPreview
    };
}

/**
 * Calculate layer for each CTE based on dependencies
 * CTEs that only reference source tables get layer 1
 * CTEs that reference layer 1 CTEs get layer 2, etc.
 */
function calculateCteLayers(ctes: CteDefinition[]): Map<string, number> {
    const layers = new Map<string, number>();
    const cteNames = new Set(ctes.map(c => c.name.toLowerCase()));

    // Initialize: CTEs with no CTE dependencies get layer 1
    for (const cte of ctes) {
        const hasCteDependency = cte.referencedCtes.some(ref =>
            cteNames.has(ref.toLowerCase())
        );
        if (!hasCteDependency) {
            layers.set(cte.name.toLowerCase(), 1);
        }
    }

    // Iteratively assign layers based on dependencies
    let changed = true;
    let iterations = 0;
    const maxIterations = ctes.length + 1; // Prevent infinite loops

    while (changed && iterations < maxIterations) {
        changed = false;
        iterations++;

        for (const cte of ctes) {
            const cteName = cte.name.toLowerCase();
            if (layers.has(cteName)) continue;

            // Check if all referenced CTEs have layers assigned
            const refLayers: number[] = [];
            let allResolved = true;

            for (const ref of cte.referencedCtes) {
                const refLower = ref.toLowerCase();
                if (cteNames.has(refLower)) {
                    const refLayer = layers.get(refLower);
                    if (refLayer !== undefined) {
                        refLayers.push(refLayer);
                    } else {
                        allResolved = false;
                        break;
                    }
                }
            }

            if (allResolved) {
                const maxRefLayer = refLayers.length > 0 ? Math.max(...refLayers) : 0;
                layers.set(cteName, maxRefLayer + 1);
                changed = true;
            }
        }
    }

    // Assign remaining CTEs (circular dependencies) to layer 1
    for (const cte of ctes) {
        const cteName = cte.name.toLowerCase();
        if (!layers.has(cteName)) {
            layers.set(cteName, 1);
        }
    }

    return layers;
}

/**
 * Find CTEs that are referenced in the main query (after the WITH block)
 */
function findMainQueryCteReferences(sql: string, ctes: CteDefinition[]): string[] {
    const cteNames = ctes.map(c => c.name.toLowerCase());
    const referenced: string[] = [];

    // Find the main query part (after the last CTE definition)
    // Look for SELECT/INSERT/UPDATE/DELETE/MERGE after the WITH block
    const mainQueryMatch = sql.match(/\)\s*(SELECT|INSERT|UPDATE|DELETE|MERGE)\s/i);
    if (!mainQueryMatch) return cteNames; // Return all CTEs if we can't find main query

    const mainQueryStart = mainQueryMatch.index || 0;
    const mainQuery = sql.substring(mainQueryStart).toLowerCase();

    // Check which CTEs are mentioned in the main query
    for (const cteName of cteNames) {
        // Use word boundary check
        const regex = new RegExp(`\\b${escapeRegex(cteName)}\\b`, 'i');
        if (regex.test(mainQuery)) {
            referenced.push(cteName);
        }
    }

    return referenced.length > 0 ? referenced : cteNames;
}

/**
 * Find source tables that are referenced directly in the main query (not just in CTEs)
 */
function findMainQuerySourceReferences(
    sql: string,
    allSourceTables: Set<string>,
    cteNames: Set<string>
): string[] {
    const referenced: string[] = [];

    // Find the main query part (after the WITH block if present)
    let mainQuery = sql;
    const mainQueryMatch = sql.match(/\)\s*(SELECT|INSERT|UPDATE|DELETE|MERGE)\s/i);
    if (mainQueryMatch && mainQueryMatch.index) {
        mainQuery = sql.substring(mainQueryMatch.index);
    }

    mainQuery = mainQuery.toLowerCase();

    // Check which source tables are mentioned in the main query
    for (const tableName of allSourceTables) {
        // Skip CTE names
        if (cteNames.has(tableName)) continue;

        // Get just the table name part for matching (last part of qualified name)
        const parts = tableName.split('.');
        const shortName = parts[parts.length - 1];

        // Use word boundary check for the short name
        const regex = new RegExp(`\\b${escapeRegex(shortName)}\\b`, 'i');
        if (regex.test(mainQuery)) {
            referenced.push(tableName);
        }
    }

    return referenced;
}

/**
 * Get display name (last part of qualified name)
 */
function getDisplayName(fullName: string): string {
    const parts = fullName.split('.');
    return parts[parts.length - 1];
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
