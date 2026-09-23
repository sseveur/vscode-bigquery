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
    nodeWidth: 200,
    nodeHeight: 40,
    layerSpacing: 290,
    nodeSpacing: 56,
    paddingX: 40,
    paddingY: 40
};

const MIN_HEIGHT = 200;
/** Vertical room a long edge's lane needs next to a box or another lane. */
const LANE_GAP = 16;
const ORDER_SWEEPS = 8;
const PLACE_SWEEPS = 12;

/**
 * One slot in a layer: a real node, or a lane where an edge that skips this layer passes through.
 * `center` is the item's anchor — the middle of a card's header row, where its edges attach —
 * filled by placement; a card extends `above` / `below` it (more below when it lists columns).
 */
interface Item {
    node?: LineageNode;
    rank: number;
    above: number;
    below: number;
    center: number;
    up: Item[];
    down: Item[];
}

/**
 * Layered (Sugiyama-style) layout, left to right:
 *  1. edges that skip layers get a lane item in every layer they cross, so they route through
 *     gaps instead of through the boxes in between;
 *  2. each layer is ordered by repeated barycenter sweeps, keeping the order with fewest crossings;
 *  3. items are placed as close as possible to the average height of their neighbours, keeping
 *     order and spacing, so chains come out straight and fan-ins centre on their inputs.
 * Sets node.x / node.y (top-left) and edge.waypoints.
 */
export function calculateLayout(graph: LineageGraph, config: Partial<LayoutConfig> = {}): LayoutResult {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    if (graph.nodes.length === 0) {
        return { graph, width: cfg.paddingX * 2, height: cfg.paddingY * 2 };
    }

    // Dense ranks: layer numbers may skip values (e.g. the target layer), columns should not
    const rankOf = new Map<number, number>();
    [...new Set(graph.nodes.map(n => n.layer))].sort((a, b) => a - b).forEach((l, i) => rankOf.set(l, i));
    const rankCount = rankOf.size;

    const ranks: Item[][] = Array.from({ length: rankCount }, () => []);
    const itemOf = new Map<string, Item>();
    for (const node of graph.nodes) {
        const height = node.height ?? cfg.nodeHeight;
        const item: Item = { node, rank: rankOf.get(node.layer)!, above: cfg.nodeHeight / 2, below: height - cfg.nodeHeight / 2, center: 0, up: [], down: [] };
        ranks[item.rank].push(item);
        itemOf.set(node.id, item);
    }

    const lanesOf = new Map<string, Item[]>();
    for (const edge of graph.edges) {
        const from = itemOf.get(edge.source);
        const to = itemOf.get(edge.target);
        if (!from || !to || to.rank <= from.rank) { continue; }
        let prev = from;
        const lanes: Item[] = [];
        for (let r = from.rank + 1; r < to.rank; r++) {
            const lane: Item = { rank: r, above: 0, below: 0, center: 0, up: [], down: [] };
            ranks[r].push(lane);
            lanes.push(lane);
            link(prev, lane);
            prev = lane;
        }
        link(prev, to);
        lanesOf.set(edge.id, lanes);
    }

    orderRanks(ranks);
    placeRanks(ranks, cfg);

    // Top of the drawing at paddingY; short graphs are centred in the minimum height
    let top = Infinity, bottom = -Infinity;
    for (const item of ranks.flat()) {
        top = Math.min(top, item.center - item.above);
        bottom = Math.max(bottom, item.center + item.below);
    }
    const contentHeight = bottom - top + cfg.paddingY * 2;
    const height = Math.max(contentHeight, MIN_HEIGHT);
    const shift = cfg.paddingY - top + (height - contentHeight) / 2;
    const columnX = (rank: number) => cfg.paddingX + rank * cfg.layerSpacing;

    for (const item of ranks.flat()) {
        if (item.node) {
            item.node.x = columnX(item.rank);
            item.node.y = item.center + shift - item.above;
        }
    }
    for (const edge of graph.edges) {
        const lanes = lanesOf.get(edge.id);
        if (lanes?.length) {
            edge.waypoints = lanes.map(l => ({ x: columnX(l.rank), y: l.center + shift }));
        } else {
            delete edge.waypoints;
        }
    }

    return {
        graph,
        width: cfg.paddingX * 2 + (rankCount - 1) * cfg.layerSpacing + cfg.nodeWidth,
        height,
    };
}

function link(a: Item, b: Item): void {
    a.down.push(b);
    b.up.push(a);
}

/** Crossing-reduction: alternate down / up barycenter sweeps, keep the best ordering seen. */
function orderRanks(ranks: Item[][]): void {
    ranks[0].sort((a, b) => byName(a, b));
    for (let r = 1; r < ranks.length; r++) { sortByBarycenter(ranks[r], ranks[r - 1], 'up'); }

    let best = ranks.map(r => r.slice());
    let bestCrossings = countCrossings(ranks);
    for (let sweep = 0; sweep < ORDER_SWEEPS && bestCrossings > 0; sweep++) {
        if (sweep % 2 === 0) {
            for (let r = 1; r < ranks.length; r++) { sortByBarycenter(ranks[r], ranks[r - 1], 'up'); }
        } else {
            for (let r = ranks.length - 2; r >= 0; r--) { sortByBarycenter(ranks[r], ranks[r + 1], 'down'); }
        }
        const crossings = countCrossings(ranks);
        if (crossings < bestCrossings) {
            bestCrossings = crossings;
            best = ranks.map(r => r.slice());
        }
    }
    best.forEach((order, r) => { ranks[r] = order; });
}

/** Reorders `layer` by the mean position of each item's neighbours in `ref`; items without any keep their place. */
function sortByBarycenter(layer: Item[], ref: Item[], side: 'up' | 'down'): void {
    const pos = new Map<Item, number>();
    ref.forEach((item, i) => pos.set(item, i));
    const key = new Map<Item, number>();
    layer.forEach((item, i) => {
        const ps = item[side].map(n => pos.get(n)).filter((p): p is number => p !== undefined);
        key.set(item, ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : i);
    });
    const current = new Map<Item, number>();
    layer.forEach((item, i) => current.set(item, i));
    layer.sort((a, b) => (key.get(a)! - key.get(b)!) || (current.get(a)! - current.get(b)!));
}

function countCrossings(ranks: Item[][]): number {
    let total = 0;
    for (let r = 0; r + 1 < ranks.length; r++) {
        const below = new Map<Item, number>();
        ranks[r + 1].forEach((item, i) => below.set(item, i));
        const segs: Array<[number, number]> = [];
        ranks[r].forEach((item, i) => item.down.forEach(d => segs.push([i, below.get(d)!])));
        for (let a = 0; a < segs.length; a++) {
            for (let b = a + 1; b < segs.length; b++) {
                if ((segs[a][0] - segs[b][0]) * (segs[a][1] - segs[b][1]) < 0) { total++; }
            }
        }
    }
    return total;
}

function byName(a: Item, b: Item): number {
    return (a.node?.name ?? '').localeCompare(b.node?.name ?? '');
}

/** Minimum distance between the anchors of `a` and the item `b` right below it in one layer. */
function separation(a: Item, b: Item, cfg: LayoutConfig): number {
    const gap = a.node && b.node ? cfg.nodeSpacing - cfg.nodeHeight : LANE_GAP;
    return a.below + b.above + gap;
}

/**
 * Vertical placement. Start stacked, then repeatedly pull every layer towards the mean centre of
 * its neighbours (lanes pull harder, so long edges run straight) and project back onto
 * "keep order, keep spacing" with an exact weighted least-squares fit.
 */
function placeRanks(ranks: Item[][], cfg: LayoutConfig): void {
    for (const layer of ranks) {
        let y = 0;
        layer.forEach((item, i) => {
            if (i > 0) { y += separation(layer[i - 1], item, cfg); }
            item.center = y;
        });
        const mid = y / 2;
        layer.forEach(item => { item.center -= mid; });
    }

    for (let sweep = 0; sweep < PLACE_SWEEPS; sweep++) {
        const down = sweep % 2 === 0;
        const order = down ? ranks.map((_, i) => i) : ranks.map((_, i) => ranks.length - 1 - i);
        for (const r of order) {
            const layer = ranks[r];
            const desired = layer.map(item => {
                const ns = down ? (item.up.length ? item.up : item.down) : (item.down.length ? item.down : item.up);
                return ns.length ? ns.reduce((s, n) => s + n.center, 0) / ns.length : item.center;
            });
            const weights = layer.map(item => item.node ? 1 : 4);
            const placed = fitOrdered(desired, weights, layer.map((item, i) => i ? separation(layer[i - 1], item, cfg) : 0));
            layer.forEach((item, i) => { item.center = placed[i]; });
        }
    }
}

/**
 * Closest positions (weighted least squares) to `desired` such that
 * position[i] >= position[i-1] + gaps[i]. Shifting by the cumulative gaps turns this into
 * isotonic regression, solved exactly by pool-adjacent-violators.
 */
export function fitOrdered(desired: number[], weights: number[], gaps: number[]): number[] {
    const offset: number[] = [];
    let acc = 0;
    gaps.forEach((g, i) => { acc += i ? g : 0; offset.push(acc); });
    const blocks: Array<{ value: number; weight: number; count: number }> = [];
    desired.forEach((d, i) => {
        blocks.push({ value: d - offset[i], weight: weights[i], count: 1 });
        while (blocks.length > 1 && blocks[blocks.length - 2].value > blocks[blocks.length - 1].value) {
            const b = blocks.pop()!, a = blocks.pop()!;
            const weight = a.weight + b.weight;
            blocks.push({ value: (a.value * a.weight + b.value * b.weight) / weight, weight, count: a.count + b.count });
        }
    });
    const out: number[] = [];
    for (const b of blocks) { for (let k = 0; k < b.count; k++) { out.push(b.value + offset[out.length]); } }
    return out;
}

/**
 * Get layout configuration with optional customization
 */
export function getLayoutConfig(options?: Partial<LayoutConfig>): LayoutConfig {
    return { ...DEFAULT_CONFIG, ...options };
}
