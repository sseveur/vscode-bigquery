import { LineageGraph, LineageNode } from "../services/lineageGraph";

export interface LayoutConfig {
    nodeWidth: number;
    nodeHeight: number;
    layerSpacing: number;      // Horizontal spacing between layers
    nodeSpacing: number;       // Vertical spacing between nodes
    paddingX: number;          // Horizontal padding
    paddingY: number;          // Vertical padding
}

export interface LayoutResult {
    graph: LineageGraph;
    width: number;
    height: number;
}

const DEFAULT_CONFIG: LayoutConfig = {
    nodeWidth: 160,
    nodeHeight: 50,
    layerSpacing: 220,
    nodeSpacing: 70,
    paddingX: 40,
    paddingY: 40
};

/**
 * Calculate positions for all nodes in the graph using layered DAG layout
 */
export function calculateLayout(graph: LineageGraph, config: Partial<LayoutConfig> = {}): LayoutResult {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    // Group nodes by layer
    const layers = groupNodesByLayer(graph.nodes);
    const numLayers = layers.size;

    if (numLayers === 0) {
        return {
            graph,
            width: cfg.paddingX * 2,
            height: cfg.paddingY * 2
        };
    }

    // Find max nodes in any layer (for height calculation)
    let maxNodesInLayer = 0;
    for (const layerNodes of layers.values()) {
        maxNodesInLayer = Math.max(maxNodesInLayer, layerNodes.length);
    }

    // Calculate total dimensions
    const totalWidth = cfg.paddingX * 2 + (numLayers - 1) * cfg.layerSpacing + cfg.nodeWidth;
    const totalHeight = cfg.paddingY * 2 + (maxNodesInLayer - 1) * cfg.nodeSpacing + cfg.nodeHeight;

    // Assign positions to each node
    const sortedLayerKeys = Array.from(layers.keys()).sort((a, b) => a - b);

    for (const layerIndex of sortedLayerKeys) {
        const layerNodes = layers.get(layerIndex)!;
        const x = cfg.paddingX + layerIndex * cfg.layerSpacing;

        // Center nodes vertically within their layer
        const layerHeight = (layerNodes.length - 1) * cfg.nodeSpacing + cfg.nodeHeight;
        const startY = cfg.paddingY + (totalHeight - cfg.paddingY * 2 - layerHeight) / 2;

        // Sort nodes within layer to minimize edge crossings
        const sortedNodes = sortNodesInLayer(layerNodes, graph, layers);

        sortedNodes.forEach((node, i) => {
            node.x = x;
            node.y = startY + i * cfg.nodeSpacing;
        });
    }

    return {
        graph,
        width: totalWidth,
        height: Math.max(totalHeight, 200) // Minimum height
    };
}

/**
 * Group nodes by their layer value
 */
function groupNodesByLayer(nodes: LineageNode[]): Map<number, LineageNode[]> {
    const layers = new Map<number, LineageNode[]>();

    for (const node of nodes) {
        const layer = node.layer;
        if (!layers.has(layer)) {
            layers.set(layer, []);
        }
        layers.get(layer)!.push(node);
    }

    return layers;
}

/**
 * Sort nodes within a layer to minimize edge crossings
 * Uses barycenter heuristic based on connected nodes in previous layer
 */
function sortNodesInLayer(
    layerNodes: LineageNode[],
    graph: LineageGraph,
    allLayers: Map<number, LineageNode[]>
): LineageNode[] {
    if (layerNodes.length <= 1) return layerNodes;

    const currentLayer = layerNodes[0].layer;

    // For first layer, sort alphabetically
    if (currentLayer === 0) {
        return layerNodes.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Calculate barycenter for each node based on connected nodes in previous layer
    const prevLayer = currentLayer - 1;
    const prevLayerNodes = allLayers.get(prevLayer) || [];

    // Create position map for previous layer nodes
    const prevPositions = new Map<string, number>();
    prevLayerNodes.forEach((node, i) => {
        prevPositions.set(node.id, i);
    });

    // Calculate barycenter for each node
    const barycenters = new Map<string, number>();

    for (const node of layerNodes) {
        // Find all edges coming into this node
        const incomingEdges = graph.edges.filter(e => e.target === node.id);

        if (incomingEdges.length === 0) {
            barycenters.set(node.id, Infinity); // No connections, put at end
            continue;
        }

        // Calculate average position of connected nodes in previous layer
        let sum = 0;
        let count = 0;

        for (const edge of incomingEdges) {
            const pos = prevPositions.get(edge.source);
            if (pos !== undefined) {
                sum += pos;
                count++;
            }
        }

        barycenters.set(node.id, count > 0 ? sum / count : Infinity);
    }

    // Sort by barycenter
    return layerNodes.sort((a, b) => {
        const bcA = barycenters.get(a.id) || 0;
        const bcB = barycenters.get(b.id) || 0;
        if (bcA !== bcB) return bcA - bcB;
        return a.name.localeCompare(b.name);
    });
}

/**
 * Get layout configuration with optional customization
 */
export function getLayoutConfig(options?: Partial<LayoutConfig>): LayoutConfig {
    return { ...DEFAULT_CONFIG, ...options };
}
