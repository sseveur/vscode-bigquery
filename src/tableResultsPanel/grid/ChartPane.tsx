import { useEffect, useMemo, useState } from 'preact/hooks';
import type { BqField } from './types';
import type { FlatColumn } from './cellFormatters';
import type { PageFetcher } from './BqTable';
import {
    buildChartSeries,
    compactNumber,
    dimensionColumns,
    formatTimeTick,
    isNumericType,
    isTemporalType,
    niceTicks,
    numericColumns,
    type AggKind,
    type ChartSeries,
} from './chartData';

/** VS Code's theme-adaptive chart palette — hue picked by the user, values stay themed. */
const HUES: Array<{ id: string; label: string; css: string }> = [
    { id: 'blue', label: 'Blue', css: 'var(--vscode-charts-blue, #4fc1ff)' },
    { id: 'purple', label: 'Purple', css: 'var(--vscode-charts-purple, #c586c0)' },
    { id: 'orange', label: 'Orange', css: 'var(--vscode-charts-orange, #ce9178)' },
    { id: 'green', label: 'Green', css: 'var(--vscode-charts-green, #89d185)' },
    { id: 'yellow', label: 'Yellow', css: 'var(--vscode-charts-yellow, #cca700)' },
    { id: 'red', label: 'Red', css: 'var(--vscode-charts-red, #f14c4c)' },
];

/** Rows charted at most — fetched once through the grid's own pager. */
const CHART_ROW_CAP = 1000;

type ChartType = 'bar' | 'line' | 'scatter';

interface Props {
    schema: BqField[];
    columns: FlatColumn[];
    totalRows: number;
    initialRows: Array<{ f: Array<{ v: any }> }>;
    fetchRows: PageFetcher;
}

/**
 * Compact chart pane inside the results grid. Single measure, single hue
 * (--vscode-charts-blue adapts to the active theme in light and dark); axes and grid stay
 * recessive; values surface via per-mark tooltips.
 */
export function ChartPane({ schema, columns, totalRows, initialRows, fetchRows }: Props) {
    const dims = useMemo(() => dimensionColumns(columns), [columns]);
    const measures = useMemo(() => numericColumns(columns), [columns]);

    const [type, setType] = useState<ChartType>('bar');
    const [xKey, setXKey] = useState<string>(dims[0]?.key ?? '');
    // '' = count of rows
    const [yKey, setYKey] = useState<string>(measures[0]?.key ?? '');
    const [agg, setAgg] = useState<AggKind>('sum');
    const [hue, setHue] = useState<string>('blue');

    // Chart data window: what the grid already loaded, topped up to the cap once.
    const [rows, setRows] = useState(initialRows);
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        const want = Math.min(totalRows, CHART_ROW_CAP);
        if (rows.length >= want) { return; }
        setLoading(true);
        fetchRows(0, want)
            .then(r => setRows(r.rows || []))
            .catch(() => { /* keep whatever we have */ })
            .then(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const xCol = dims.find(c => c.key === xKey) ?? null;
    const yCol = measures.find(c => c.key === yKey) ?? null;

    // Aggregation only applies when categories are being grouped with a real measure.
    const isCategoryX = !!xCol && !isNumericType(xCol.type) && !isTemporalType(xCol.type);
    const aggApplies = isCategoryX && !!yCol;

    const series: ChartSeries | null = useMemo(() => {
        if (!xCol || rows.length === 0) { return null; }
        return buildChartSeries(rows, schema, xCol, yCol, agg);
    }, [rows, schema, xCol, yCol, agg]);

    const notes: string[] = [];
    if (totalRows > CHART_ROW_CAP) { notes.push(`charting first ${CHART_ROW_CAP.toLocaleString()} of ${totalRows.toLocaleString()} rows`); }
    if (series?.truncated) { notes.push('top 30 categories shown'); }
    if (series && series.skipped > 0) { notes.push(`${series.skipped.toLocaleString()} row${series.skipped === 1 ? '' : 's'} skipped (null/non-numeric)`); }

    return (
        <div class="bq-chart">
            <div class="bq-chart-controls">
                <select class="bq-pg-size" value={type} onChange={(e: any) => setType(e.currentTarget.value)} title="Chart type">
                    <option value="bar">Bar</option>
                    <option value="line">Line</option>
                    <option value="scatter">Scatter</option>
                </select>
                <span class="bq-chart-label">X</span>
                <select class="bq-pg-size" value={xKey} onChange={(e: any) => setXKey(e.currentTarget.value)} title="X axis column">
                    {dims.map(c => <option value={c.key}>{c.label}</option>)}
                </select>
                <span class="bq-chart-label">Y</span>
                <select class="bq-pg-size" value={yKey} onChange={(e: any) => setYKey(e.currentTarget.value)} title="Y axis measure">
                    <option value="">Count of rows</option>
                    {measures.map(c => <option value={c.key}>{c.label}</option>)}
                </select>
                {aggApplies && (
                    <select class="bq-pg-size" value={agg} onChange={(e: any) => setAgg(e.currentTarget.value)} title="Aggregation per category">
                        <option value="sum">Sum</option>
                        <option value="avg">Avg</option>
                        <option value="min">Min</option>
                        <option value="max">Max</option>
                    </select>
                )}
                <span class="bq-chart-swatch" style={{ background: HUES.find(h => h.id === hue)?.css }} />
                <select class="bq-pg-size" value={hue} onChange={(e: any) => setHue(e.currentTarget.value)} title="Chart color (theme palette)">
                    {HUES.map(h => <option value={h.id}>{h.label}</option>)}
                </select>
                {notes.length > 0 && <span class="bq-chart-note">{notes.join(' · ')}</span>}
            </div>
            {loading && <div class="bq-notice">Loading rows for chart&hellip;</div>}
            {!xCol && <div class="bq-empty">No chartable column.</div>}
            {xCol && series && series.points.length === 0 && !loading && (
                <div class="bq-empty">No plottable values for this X/Y choice.</div>
            )}
            {xCol && series && series.points.length > 0 && (
                <ChartSvg
                    type={type}
                    series={series}
                    yName={yCol ? (aggApplies ? `${agg}(${yCol.label})` : yCol.label) : 'count'}
                    color={HUES.find(h => h.id === hue)?.css ?? HUES[0].css}
                />
            )}
        </div>
    );
}

const W = 920;
const H = 360;
const M = { top: 14, right: 16, bottom: 42, left: 56 };

function ChartSvg({ type, series, yName, color }: { type: ChartType; series: ChartSeries; yName: string; color: string }) {
    // Custom hover tooltip — instant, unlike native SVG <title> (fixed OS delay).
    const [tip, setTip] = useState<{ x: number; y: number; lines: string[] } | null>(null);
    const showTip = (e: MouseEvent, lines: string[]) => {
        const host = (e.currentTarget as SVGElement).closest('.bq-chart-scroll') as HTMLElement | null;
        if (!host) { return; }
        const rect = host.getBoundingClientRect();
        setTip({ x: e.clientX - rect.left + 12, y: e.clientY - rect.top - 10, lines });
    };
    const hideTip = () => setTip(null);

    const iw = W - M.left - M.right;
    const ih = H - M.top - M.bottom;
    const pts = series.points;

    const ys = pts.map(p => p.y);
    const yMin = Math.min(0, ...ys);
    const yMax = Math.max(0, ...ys);
    const yTicks = niceTicks(yMin, yMax, 5);
    const yLo = yTicks.length ? Math.min(yTicks[0], yMin) : yMin;
    const yHi = yTicks.length ? Math.max(yTicks[yTicks.length - 1], yMax) : yMax;
    const sy = (v: number) => M.top + ih - ((v - yLo) / (yHi - yLo || 1)) * ih;

    // X scale.
    const isCat = series.kind === 'category' || type === 'bar';
    let sx: (p: { x: string | number }, i: number) => number;
    let band = 0;
    let xNums: number[] = [];
    if (isCat) {
        band = iw / pts.length;
        sx = (_p, i) => M.left + i * band + band / 2;
    } else {
        xNums = pts.map(p => p.x as number);
        const xLo = Math.min(...xNums);
        const xHi = Math.max(...xNums);
        sx = (p) => M.left + (((p.x as number) - xLo) / (xHi - xLo || 1)) * iw;
    }

    const stroke = color;
    const ink = 'var(--vscode-foreground)';
    const grid = 'var(--vscode-editorWidget-border, rgba(128,128,128,.25))';

    // Category tick labels: show at most ~12, evenly skipped.
    const catSkip = isCat ? Math.max(1, Math.ceil(pts.length / 12)) : 1;
    const spanMs = !isCat && series.kind === 'time' ? Math.max(...xNums) - Math.min(...xNums) : 0;
    const xTickVals = !isCat ? niceTicks(Math.min(...xNums), Math.max(...xNums), 5) : [];

    const fmtX = (v: string | number): string =>
        series.kind === 'time' ? formatTimeTick(v as number, spanMs)
            : typeof v === 'number' ? compactNumber(v)
                : String(v).length > 14 ? String(v).slice(0, 13) + '…' : String(v);

    const barW = Math.max(2, Math.min(28, band - 2)); // ≥2px surface gap between bars
    const zeroY = sy(Math.max(0, yLo));

    return (
        <div class="bq-chart-scroll">
            <svg viewBox={`0 0 ${W} ${H}`} class="bq-chart-svg" role="img" aria-label={`${type} chart of ${yName}`}>
                {/* recessive horizontal grid + y tick labels */}
                {yTicks.map(t => (
                    <g>
                        <line x1={M.left} x2={W - M.right} y1={sy(t)} y2={sy(t)} stroke={grid} stroke-width="1" />
                        <text x={M.left - 8} y={sy(t) + 3.5} text-anchor="end" class="bq-chart-tick" fill={ink}>{compactNumber(t)}</text>
                    </g>
                ))}

                {/* x tick labels */}
                {isCat
                    ? pts.map((p, i) => (i % catSkip === 0
                        ? <text x={sx(p, i)} y={H - M.bottom + 16} text-anchor="middle" class="bq-chart-tick" fill={ink}>
                            <title>{String(p.x)}</title>{fmtX(p.x)}
                        </text>
                        : null))
                    : xTickVals.map(v => (
                        <text x={sx({ x: v }, 0)} y={H - M.bottom + 16} text-anchor="middle" class="bq-chart-tick" fill={ink}>{fmtX(v)}</text>
                    ))}

                {/* marks */}
                {type === 'bar' && pts.map((p, i) => {
                    const y = sy(p.y);
                    const top = Math.min(y, zeroY);
                    const h = Math.max(1, Math.abs(zeroY - y));
                    const lines = [String(p.x), `${yName}: ${p.y.toLocaleString()}`];
                    return (
                        <rect
                            x={sx(p, i) - barW / 2} y={top} width={barW} height={h}
                            rx={Math.min(3, barW / 2)} fill={stroke}
                            onMouseMove={(e: MouseEvent) => showTip(e, lines)}
                            onMouseLeave={hideTip}
                        />
                    );
                })}
                {type === 'line' && (
                    <>
                        <path
                            d={pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p, i).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ')}
                            fill="none" stroke={stroke} stroke-width="2" stroke-linejoin="round"
                        />
                        {pts.length <= 120 && pts.map((p, i) => (
                            <circle
                                cx={sx(p, i)} cy={sy(p.y)} r="3" fill={stroke} stroke="transparent" stroke-width="12"
                                onMouseMove={(e: MouseEvent) => showTip(e, [fmtX(p.x), `${yName}: ${p.y.toLocaleString()}`])}
                                onMouseLeave={hideTip}
                            />
                        ))}
                    </>
                )}
                {type === 'scatter' && pts.map((p, i) => (
                    <circle
                        cx={sx(p, i)} cy={sy(p.y)} r="4" fill={stroke} fill-opacity="0.75" stroke="transparent" stroke-width="10"
                        onMouseMove={(e: MouseEvent) => showTip(e, [fmtX(p.x), `${yName}: ${p.y.toLocaleString()}`])}
                        onMouseLeave={hideTip}
                    />
                ))}

                {/* baseline */}
                <line x1={M.left} x2={W - M.right} y1={zeroY} y2={zeroY} stroke={ink} stroke-opacity="0.45" stroke-width="1" />
            </svg>
            {tip && (
                <div class="bq-chart-tip" style={{ left: `${tip.x}px`, top: `${tip.y}px` }}>
                    {tip.lines.map(l => <div>{l}</div>)}
                </div>
            )}
        </div>
    );
}
