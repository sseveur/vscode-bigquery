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

/**
 * Builds a drawable series from wire-format rows.
 *  - `yCol === null` → y is a row count (agg ignored).
 *  - Categorical x → one point per category (`agg` of y, or count), sorted by y descending,
 *    capped at `maxCategories` (sets `truncated`).
 *  - Numeric/temporal x → one point per row, sorted by x ascending (agg not applicable).
 */
export function buildChartSeries(
    rows: Array<{ f: Array<{ v: unknown }> }>,
    fields: BqField[],
    xCol: FlatColumn,
    yCol: FlatColumn | null,
    agg: AggKind = 'sum',
    maxCategories = 30
): ChartSeries {
    const xType = xCol.type.toUpperCase();
    const kind: ChartSeries['kind'] =
        isTemporalType(xType) ? 'time' : isNumericType(xType) ? 'linear' : 'category';

    let skipped = 0;

    if (kind === 'category') {
        // Track enough per category to answer any of the aggregations.
        const acc = new Map<string, { sum: number; n: number; min: number; max: number }>();
        for (const row of rows) {
            const x = parseX(extractRowValue(row, fields, xCol.path), xCol);
            if (x === null) { skipped++; continue; }
            let y = 1;
            if (yCol) {
                const parsed = parseY(extractRowValue(row, fields, yCol.path));
                if (parsed === null) { skipped++; continue; }
                y = parsed;
            }
            const key = String(x);
            const a = acc.get(key);
            if (a) {
                a.sum += y; a.n++;
                a.min = Math.min(a.min, y);
                a.max = Math.max(a.max, y);
            } else {
                acc.set(key, { sum: y, n: 1, min: y, max: y });
            }
        }
        const finalize = (a: { sum: number; n: number; min: number; max: number }): number => {
            if (!yCol) { return a.n; }                      // count of rows
            switch (agg) {
                case 'avg': return a.sum / a.n;
                case 'min': return a.min;
                case 'max': return a.max;
                default: return a.sum;
            }
        };
        const sorted = [...acc.entries()]
            .map(([x, a]) => ({ x, y: finalize(a) }))
            .sort((a, b) => b.y - a.y);
        const truncated = sorted.length > maxCategories;
        return {
            kind,
            points: sorted.slice(0, maxCategories).map(({ x, y }) => ({ x, y })),
            truncated,
            skipped,
        };
    }

    const points: ChartPoint[] = [];
    for (const row of rows) {
        const x = parseX(extractRowValue(row, fields, xCol.path), xCol);
        if (x === null || typeof x !== 'number') { skipped++; continue; }
        let y = 1;
        if (yCol) {
            const parsed = parseY(extractRowValue(row, fields, yCol.path));
            if (parsed === null) { skipped++; continue; }
            y = parsed;
        }
        points.push({ x, y });
    }
    points.sort((a, b) => (a.x as number) - (b.x as number));
    return { kind, points, truncated: false, skipped };
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
