import { LineageGraph, LineageNode, LineageEdge, NodeType } from "../services/lineageGraph";
import { LayoutConfig, getLayoutConfig } from "./dagLayout";

/**
 * Node colors by type (dbt-inspired palette)
 */
/* eslint-disable @typescript-eslint/naming-convention */
const NODE_COLORS: Record<NodeType, string> = {
    'SOURCE': '#3794ff',    // Blue
    'CTE': '#9b59b6',       // Purple
    'TARGET': '#89d185'     // Green
};
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * Render the lineage graph as an SVG string
 */
export function renderGraphToSvg(
    graph: LineageGraph,
    width: number,
    height: number,
    config?: Partial<LayoutConfig>
): string {
    const cfg = getLayoutConfig(config);

    if (graph.nodes.length === 0) {
        return renderEmptyState(width, height);
    }

    const edges = graph.edges.map(edge => renderEdge(edge, graph.nodes, cfg)).join('\n');
    const nodes = graph.nodes.map(node => renderNode(node, cfg)).join('\n');

    return `
        <svg viewBox="0 0 ${width} ${height}" class="lineage-graph" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <marker id="arrowhead" markerWidth="8" markerHeight="6"
                    refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
                    <polygon points="0 0, 8 3, 0 6" fill="var(--vscode-descriptionForeground, #888)"/>
                </marker>
                <!-- Glow filter for hover effect -->
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            </defs>

            <!-- Edges (rendered first, behind nodes) -->
            <g class="edges">
                ${edges}
            </g>

            <!-- Nodes -->
            <g class="nodes">
                ${nodes}
            </g>
        </svg>
    `;
}

/**
 * Render a single edge as a curved Bezier path
 */
function renderEdge(edge: LineageEdge, nodes: LineageNode[], cfg: LayoutConfig): string {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);

    if (!sourceNode || !targetNode || sourceNode.x === undefined || targetNode.x === undefined) {
        return '';
    }

    const path = generateBezierPath(sourceNode, targetNode, cfg);

    return `
        <path
            d="${path}"
            class="edge"
            fill="none"
            stroke="var(--vscode-descriptionForeground, #666)"
            stroke-width="2"
            marker-end="url(#arrowhead)"
            data-source="${escapeAttr(edge.source)}"
            data-target="${escapeAttr(edge.target)}"
        />
    `;
}

/**
 * Generate a cubic Bezier path between two nodes
 */
function generateBezierPath(from: LineageNode, to: LineageNode, cfg: LayoutConfig): string {
    // Start from right edge of source node (center height)
    const x1 = from.x! + cfg.nodeWidth;
    const y1 = from.y! + cfg.nodeHeight / 2;

    // End at left edge of target node with small gap for arrow (center height)
    const x2 = to.x! - 4;
    const y2 = to.y! + cfg.nodeHeight / 2;

    // Control points for smooth S-curve
    const dx = x2 - x1;
    const cx1 = x1 + dx * 0.5;
    const cy1 = y1;
    const cx2 = x2 - dx * 0.5;
    const cy2 = y2;

    return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
}

/**
 * Render a single node
 */
function renderNode(node: LineageNode, cfg: LayoutConfig): string {
    if (node.x === undefined || node.y === undefined) {
        return '';
    }

    const color = NODE_COLORS[node.nodeType];
    const typeLabel = getTypeLabel(node);

    return `
        <g class="node node-${node.nodeType.toLowerCase()}"
           transform="translate(${node.x}, ${node.y})"
           data-id="${escapeAttr(node.id)}"
           data-type="${escapeAttr(node.nodeType)}">
            <!-- Node background -->
            <rect
                width="${cfg.nodeWidth}"
                height="${cfg.nodeHeight}"
                rx="6"
                ry="6"
                fill="var(--vscode-editor-background, #1e1e1e)"
                stroke="${color}"
                stroke-width="2"
                class="node-rect"
            />
            <!-- Color accent bar -->
            <rect
                x="0"
                y="0"
                width="4"
                height="${cfg.nodeHeight}"
                rx="2"
                ry="2"
                fill="${color}"
            />
            <!-- Node name -->
            <text
                x="${cfg.nodeWidth / 2}"
                y="20"
                text-anchor="middle"
                class="node-name"
                fill="var(--vscode-foreground, #ccc)"
                font-size="12"
                font-weight="600">
                ${escapeHtml(truncateName(node.name, 18))}
            </text>
            <!-- Node type label -->
            <text
                x="${cfg.nodeWidth / 2}"
                y="38"
                text-anchor="middle"
                class="node-type"
                fill="var(--vscode-descriptionForeground, #888)"
                font-size="10">
                ${escapeHtml(typeLabel)}
            </text>
        </g>
    `;
}

/**
 * Render empty state when no nodes
 */
function renderEmptyState(width: number, height: number): string {
    return `
        <svg viewBox="0 0 ${width} ${height}" class="lineage-graph" xmlns="http://www.w3.org/2000/svg">
            <text
                x="${width / 2}"
                y="${height / 2}"
                text-anchor="middle"
                fill="var(--vscode-descriptionForeground, #888)"
                font-size="14">
                No lineage data detected
            </text>
        </svg>
    `;
}

/**
 * Get display label for node type
 */
function getTypeLabel(node: LineageNode): string {
    if (node.statementType) {
        return `${node.nodeType} (${node.statementType})`;
    }
    return node.nodeType;
}

/**
 * Truncate name if too long
 */
function truncateName(name: string, maxLength: number): string {
    if (name.length <= maxLength) {return name;}
    return name.substring(0, maxLength - 2) + '..';
}

/**
 * Escape HTML entities
 */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Escape attribute value
 */
function escapeAttr(text: string): string {
    return text.replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

/**
 * Get CSS styles for the lineage graph
 */
export function getGraphStyles(): string {
    return `
        .lineage-graph {
            width: 100%;
            height: auto;
            min-height: 200px;
        }

        .edge {
            transition: stroke 0.2s, stroke-width 0.2s;
        }

        .edge:hover {
            stroke: var(--vscode-focusBorder, #007acc);
            stroke-width: 3;
        }

        .node {
            cursor: pointer;
        }

        .node:hover .node-rect {
            stroke-width: 3;
            filter: drop-shadow(0 2px 8px rgba(0,0,0,0.3));
        }

        .node-source .node-rect:hover {
            stroke: ${NODE_COLORS.SOURCE};
        }

        .node-cte .node-rect:hover {
            stroke: ${NODE_COLORS.CTE};
        }

        .node-target .node-rect:hover {
            stroke: ${NODE_COLORS.TARGET};
        }

        .node-name {
            font-family: var(--vscode-font-family);
            pointer-events: none;
        }

        .node-type {
            font-family: var(--vscode-font-family);
            pointer-events: none;
        }
    `;
}

/**
 * Generate legend HTML
 */
export function renderLegend(): string {
    return `
        <div class="legend">
            <div class="legend-item">
                <span class="legend-color" style="background: ${NODE_COLORS.SOURCE}"></span>
                <span>Source Table</span>
            </div>
            <div class="legend-item">
                <span class="legend-color" style="background: ${NODE_COLORS.CTE}"></span>
                <span>CTE</span>
            </div>
            <div class="legend-item">
                <span class="legend-color" style="background: ${NODE_COLORS.TARGET}"></span>
                <span>Target Table</span>
            </div>
        </div>
    `;
}
