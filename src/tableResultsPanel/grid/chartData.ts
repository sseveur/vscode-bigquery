import type { BqField } from './types';
import { extractRowValue, type FlatColumn } from './cellFormatters';

/** One drawable point. For category series `x` is the category label; else a number
 *  (epoch ms for temporal columns). */
export interface ChartPoint {
    x: string | number;
    y: number;
}

export interface ChartSeries {
    /** How the x axis scales: discrete categories, linear numbers, or time. */
    kind: 'category' | 'linear' | 'time';
    points: ChartPoint[];
    /** True when categories were capped — the tail is not shown. */
    truncated: boolean;
    /** Rows that could not contribute (null / unparsable x or y). */
    skipped: number;
}

const NUMERIC_TYPES = new Set(['INT64', 'INTEGER', 'FLOAT', 'FLOAT64', 'NUMERIC', 'BIGNUMERIC']);
const TEMPORAL_TYPES = new Set(['TIMESTAMP', 'DATE', 'DATETIME']);

export function isNumericType(type: string | undefined): boolean {
    return NUMERIC_TYPES.has((type || '').toUpperCase());
}

export function isTemporalType(type: string | undefined): boolean {
    return TEMPORAL_TYPES.has((type || '').toUpperCase());
}

/** Columns usable as a Y measure (numeric scalars). */
export function numericColumns(columns: FlatColumn[]): FlatColumn[] {
    return columns.filter(c => c.mode !== 'REPEATED' && isNumericType(c.type));
}

/** Columns usable as an X dimension (any non-repeated scalar). */
export function dimensionColumns(columns: FlatColumn[]): FlatColumn[] {
    return columns.filter(c => c.mode !== 'REPEATED' && c.type !== 'RECORD' && c.type !== 'STRUCT');
}

/** Parses a wire cell into an x-axis value for the given column, or null when unusable. */
function parseX(raw: unknown, col: FlatColumn): string | number | null {
    if (raw === null || raw === undefined) { return null; }
    const t = col.type.toUpperCase();
    if (t === 'TIMESTAMP') {
        const ms = parseFloat(String(raw)) * 1000;
        return isFinite(ms) ? Math.round(ms) : null;
    }
    if (t === 'DATE' || t === 'DATETIME') {
        const ms = Date.parse(String(raw));
        return isFinite(ms) ? ms : null;
    }
    if (isNumericType(t)) {
        const n = Number(raw);
        return isFinite(n) ? n : null;
    }
    return String(raw);
}

/** Parses a wire cell into a y measure, or null when unusable. */
function parseY(raw: unknown): number | null {
    if (raw === null || raw === undefined) { return null; }
    const n = Number(raw);
    return isFinite(n) ? n : null;
}

/** Aggregation applied per category when a Y measure is chosen. */
export type AggKind = 'sum' | 'avg' | 'min' | 'max';

/** Series cap when coloring by a column; the tail folds into OTHER_SERIES. */
export const MAX_SERIES = 6;
export const OTHER_SERIES = 'Other';

export interface ChartGroup {
    kind: 'category' | 'linear' | 'time';
    /** Shared x categories (category kind only), sorted by combined y descending. */
    categories: string[] | null;
    series: Array<{
        name: string;
        /** Category kind: y per category (aligned with `categories`, null = no data).
         *  Linear/time: ignored. */
        values: Array<number | null>;
        /** Linear/time kind: per-row points sorted by x. Category kind: empty. */
        points: ChartPoint[];
    }>;
    truncated: boolean;
    /** True when more than MAX_SERIES color values were folded into "Other". */
    seriesFolded: boolean;
    skipped: number;
}

interface Acc { sum: number; n: number; min: number; max: number }
const newAcc = (y: number): Acc => ({ sum: y, n: 1, min: y, max: y });
const addAcc = (a: Acc, y: number) => { a.sum += y; a.n++; a.min = Math.min(a.min, y); a.max = Math.max(a.max, y); };
const mergeAcc = (a: Acc, b: Acc) => { a.sum += b.sum; a.n += b.n; a.min = Math.min(a.min, b.min); a.max = Math.max(a.max, b.max); };

/**
 * Builds one or more drawable series. `colorCol === null` → a single series (name '').
 * With a color column, rows split into one series per value; the largest MAX_SERIES stay,
 * the rest are folded into "Other" (aggregated together, so avg stays correct).
 */
export function buildChartGroups(
    rows: Array<{ f: Array<{ v: unknown }> }>,
    fields: BqField[],
    xCol: FlatColumn,
    yCol: FlatColumn | null,
    agg: AggKind = 'sum',
    colorCol: FlatColumn | null = null,
    maxCategories = 30
): ChartGroup {
    const xType = xCol.type.toUpperCase();
    const kind: ChartGroup['kind'] =
        isTemporalType(xType) ? 'time' : isNumericType(xType) ? 'linear' : 'category';

    let skipped = 0;

    // Row → (x, y, seriesKey) triples.
    const triples: Array<{ x: string | number; y: number; s: string }> = [];
    for (const row of rows) {
        const x = parseX(extractRowValue(row, fields, xCol.path), xCol);
        if (x === null || (kind !== 'category' && typeof x !== 'number')) { skipped++; continue; }
        let y = 1;
        if (yCol) {
            const parsed = parseY(extractRowValue(row, fields, yCol.path));
            if (parsed === null) { skipped++; continue; }
            y = parsed;
        }
        let s = '';
        if (colorCol) {
            const raw = extractRowValue(row, fields, colorCol.path);
            s = raw === null || raw === undefined ? 'NULL' : String(raw);
        }
        triples.push({ x, y, s });
    }

    // Pick the series to keep: largest total magnitude (or row count for counts).
    const seriesTotals = new Map<string, number>();
    for (const t of triples) {
        seriesTotals.set(t.s, (seriesTotals.get(t.s) ?? 0) + (yCol ? Math.abs(t.y) : 1));
    }
    const rankedSeries = [...seriesTotals.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
    const seriesFolded = !!colorCol && rankedSeries.length > MAX_SERIES;
    const kept = new Set(rankedSeries.slice(0, MAX_SERIES));
    const seriesKey = (s: string) => (kept.has(s) ? s : OTHER_SERIES);
    const seriesNames = rankedSeries.slice(0, MAX_SERIES).concat(seriesFolded ? [OTHER_SERIES] : []);

    const finalize = (a: Acc): number => {
        if (!yCol) { return a.n; }
        switch (agg) {
            case 'avg': return a.sum / a.n;
            case 'min': return a.min;
            case 'max': return a.max;
            default: return a.sum;
        }
    };

    if (kind === 'category') {
        // cat → series → acc, plus combined per-cat totals for ordering/capping.
        const byCat = new Map<string, Map<string, Acc>>();
        const catTotal = new Map<string, Acc>();
        for (const t of triples) {
            const cat = String(t.x);
            const s = seriesKey(t.s);
            let perSeries = byCat.get(cat);
            if (!perSeries) { perSeries = new Map(); byCat.set(cat, perSeries); }
            const a = perSeries.get(s);
            if (a) { addAcc(a, t.y); } else { perSeries.set(s, newAcc(t.y)); }
            const ct = catTotal.get(cat);
            if (ct) { addAcc(ct, t.y); } else { catTotal.set(cat, newAcc(t.y)); }
        }
        const orderedCats = [...catTotal.entries()]
            .sort((a, b) => finalize(b[1]) - finalize(a[1]))
            .map(([c]) => c);
        const truncated = orderedCats.length > maxCategories;
        const categories = orderedCats.slice(0, maxCategories);

        const series = seriesNames.map(name => ({
            name,
            values: categories.map(cat => {
                const a = byCat.get(cat)?.get(name);
                return a ? finalize(a) : null;
            }),
            points: [] as ChartPoint[],
        }));
        return { kind, categories, series, truncated, seriesFolded, skipped };
    }

    // Linear / time: per-series raw points. "Other" merges the tail's points.
    const bySeries = new Map<string, ChartPoint[]>();
    for (const t of triples) {
        const s = seriesKey(t.s);
        const arr = bySeries.get(s);
        const pt = { x: t.x as number, y: t.y };
        if (arr) { arr.push(pt); } else { bySeries.set(s, [pt]); }
    }
    const series = seriesNames
        .filter(name => bySeries.has(name))
        .map(name => ({
            name,
            values: [] as Array<number | null>,
            points: bySeries.get(name)!.sort((a, b) => (a.x as number) - (b.x as number)),
        }));
    return { kind, categories: null, series, truncated: false, seriesFolded, skipped };
}

/**
 * Single-series convenience wrapper over buildChartGroups (no color column).
 * Categorical x → one point per category (`agg` of y, or count), y-descending, capped.
 * Numeric/temporal x → one point per row, x-ascending.
 */
export function buildChartSeries(
    rows: Array<{ f: Array<{ v: unknown }> }>,
    fields: BqField[],
    xCol: FlatColumn,
    yCol: FlatColumn | null,
    agg: AggKind = 'sum',
    maxCategories = 30
): ChartSeries {
    const g = buildChartGroups(rows, fields, xCol, yCol, agg, null, maxCategories);
    if (g.kind === 'category') {
        const points = (g.categories ?? []).map((c, i) => ({ x: c, y: g.series[0]?.values[i] ?? 0 }));
        return { kind: g.kind, points, truncated: g.truncated, skipped: g.skipped };
    }
    return { kind: g.kind, points: g.series[0]?.points ?? [], truncated: false, skipped: g.skipped };
}

/** Nice-number axis ticks covering [min, max] (inclusive-ish), ~`count` steps. */
export function niceTicks(min: number, max: number, count = 5): number[] {
    if (!isFinite(min) || !isFinite(max)) { return []; }
    if (min === max) {
        return min === 0 ? [0, 1] : [0, min].sort((a, b) => a - b);
    }
    const span = max - min;
    const rawStep = span / Math.max(1, count);
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const norm = rawStep / mag;
    const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
    const start = Math.floor(min / step) * step;
    const ticks: number[] = [];
    for (let v = start; v <= max + step * 0.5; v += step) {
        // Snap floating point noise (0.30000000000000004 → 0.3).
        ticks.push(Number(v.toPrecision(12)));
    }
    return ticks;
}

/** Compact number for axis labels: 1200000 → "1.2M". */
export function compactNumber(n: number): string {
    const abs = Math.abs(n);
    if (abs >= 1e9) { return `${trimFixed(n / 1e9)}B`; }
    if (abs >= 1e6) { return `${trimFixed(n / 1e6)}M`; }
    if (abs >= 1e3) { return `${trimFixed(n / 1e3)}K`; }
    return String(Number(n.toPrecision(6)));
}

function trimFixed(n: number): string {
    const s = n.toFixed(1);
    return s.endsWith('.0') ? s.slice(0, -2) : s;
}

/** Short x tick label for time axes; span decides the precision shown. */
export function formatTimeTick(ms: number, spanMs: number): string {
    const d = new Date(ms);
    if (spanMs >= 365 * 864e5) {
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    }
    if (spanMs >= 864e5) {
        return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    }
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}
