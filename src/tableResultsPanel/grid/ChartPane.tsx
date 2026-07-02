import { useEffect, useMemo, useState } from 'preact/hooks';
import type { BqField } from './types';
import type { FlatColumn } from './cellFormatters';
import type { PageFetcher } from './BqTable';
import {
    buildChartGroups,
    compactNumber,
    dimensionColumns,
    formatTimeTick,
    isNumericType,
    isTemporalType,
    niceTicks,
    numericColumns,
    OTHER_SERIES,
    type AggKind,
    type ChartGroup,
} from './chartData';

/** VS Code's theme-adaptive chart palette. Fixed order for series identity — never cycled. */
const HUES: Array<{ id: string; label: string; css: string }> = [
    { id: 'blue', label: 'Blue', css: 'var(--vscode-charts-blue, #4fc1ff)' },
    { id: 'purple', label: 'Purple', css: 'var(--vscode-charts-purple, #c586c0)' },
    { id: 'orange', label: 'Orange', css: 'var(--vscode-charts-orange, #ce9178)' },
    { id: 'green', label: 'Green', css: 'var(--vscode-charts-green, #89d185)' },
    { id: 'yellow', label: 'Yellow', css: 'var(--vscode-charts-yellow, #cca700)' },
    { id: 'red', label: 'Red', css: 'var(--vscode-charts-red, #f14c4c)' },
];
/** "Other" is a fold-bucket, not an entity — neutral, outside the identity palette. */
const OTHER_COLOR = 'var(--vscode-descriptionForeground, #8a8a8a)';

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
 * Compact chart pane inside the results grid. Single hue when one series; coloring by a
 * column splits into up to MAX_SERIES entities (fixed hue order) + a neutral "Other",
 * with a legend. Axes/grid stay recessive; values surface via an instant hover tooltip.
 */
export function ChartPane({ schema, columns, totalRows, initialRows, fetchRows }: Props) {
    const dims = useMemo(() => dimensionColumns(columns), [columns]);
    const measures = useMemo(() => numericColumns(columns), [columns]);
    const categoricals = useMemo(
        () => dims.filter(c => !isNumericType(c.type) && !isTemporalType(c.type)),
        [dims]
    );

    const [type, setType] = useState<ChartType>('bar');
    const [xKey, setXKey] = useState<string>(dims[0]?.key ?? '');
    // '' = count of rows
    const [yKey, setYKey] = useState<string>(measures[0]?.key ?? '');
    const [agg, setAgg] = useState<AggKind>('sum');
    const [hue, setHue] = useState<string>('blue');
    // '' = no series split
    const [colorKey, setColorKey] = useState<string>('');

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
    const colorCol = categoricals.find(c => c.key === colorKey) ?? null;

    // Aggregation only applies when categories are being grouped with a real measure.
    const isCategoryX = !!xCol && !isNumericType(xCol.type) && !isTemporalType(xCol.type);
    const aggApplies = isCategoryX && !!yCol;

    const group: ChartGroup | null = useMemo(() => {
        if (!xCol || rows.length === 0) { return null; }
        return buildChartGroups(rows, schema, xCol, yCol, agg, colorCol);
    }, [rows, schema, xCol, yCol, agg, colorCol]);

    const multi = !!colorCol && !!group && group.series.length > 1;
    const seriesColor = (name: string, idx: number): string =>
        !multi ? (HUES.find(h => h.id === hue)?.css ?? HUES[0].css)
            : name === OTHER_SERIES ? OTHER_COLOR
                : HUES[idx % HUES.length].css;

    const notes: string[] = [];
    if (totalRows > CHART_ROW_CAP) { notes.push(`charting first ${CHART_ROW_CAP.toLocaleString()} of ${totalRows.toLocaleString()} rows`); }
    if (group?.truncated) { notes.push('top 30 categories shown'); }
    if (group?.seriesFolded) { notes.push('smaller series folded into Other'); }
    if (group && group.skipped > 0) { notes.push(`${group.skipped.toLocaleString()} row${group.skipped === 1 ? '' : 's'} skipped (null/non-numeric)`); }

    const hasData = !!group && group.series.some(s => s.points.length > 0 || s.values.some(v => v !== null));

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
                {categoricals.length > 0 && (
                    <>
                        <span class="bq-chart-label">Color by</span>
                        <select class="bq-pg-size" value={colorKey} onChange={(e: any) => setColorKey(e.currentTarget.value)} title="Split into one series per value">
                            <option value="">None</option>
                            {categoricals.map(c => <option value={c.key}>{c.label}</option>)}
                        </select>
                    </>
                )}
                {!multi && (
                    <>
                        <span class="bq-chart-swatch" style={{ background: HUES.find(h => h.id === hue)?.css }} />
                        <select class="bq-pg-size" value={hue} onChange={(e: any) => setHue(e.currentTarget.value)} title="Chart color (theme palette)">
                            {HUES.map(h => <option value={h.id}>{h.label}</option>)}
                        </select>
                    </>
                )}
                {notes.length > 0 && <span class="bq-chart-note">{notes.join(' · ')}</span>}
            </div>
            {multi && group && (
                <div class="bq-chart-legend">
                    {group.series.map((s, i) => (
                        <span class="bq-chart-legend-item">
                            <span class="bq-chart-swatch" style={{ background: seriesColor(s.name, i) }} />
                            {s.name.length > 24 ? s.name.slice(0, 23) + '…' : s.name}
                        </span>
                    ))}
                </div>
            )}
            {loading && <div class="bq-notice">Loading rows for chart&hellip;</div>}
            {!xCol && <div class="bq-empty">No chartable column.</div>}
            {xCol && group && !hasData && !loading && (
                <div class="bq-empty">No plottable values for this X/Y choice.</div>
            )}
            {xCol && group && hasData && (
                <ChartSvg
                    type={type}
                    group={group}
                    yName={yCol ? (aggApplies ? `${agg}(${yCol.label})` : yCol.label) : 'count'}
                    colorOf={seriesColor}
                    showSeriesName={multi}
                />
            )}
        </div>
    );
}

const W = 920;
const H = 300;
const M = { top: 14, right: 16, bottom: 42, left: 56 };

interface SvgProps {
    type: ChartType;
    group: ChartGroup;
    yName: string;
    colorOf: (name: string, idx: number) => string;
    showSeriesName: boolean;
}

function ChartSvg({ type, group, yName, colorOf, showSeriesName }: SvgProps) {
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
    const isCat = group.kind === 'category';
    const cats = group.categories ?? [];

    // Y domain across every series.
    const allYs: number[] = [];
    for (const s of group.series) {
        for (const v of s.values) { if (v !== null) { allYs.push(v); } }
        for (const p of s.points) { allYs.push(p.y); }
    }
    const yMin = Math.min(0, ...allYs);
    const yMax = Math.max(0, ...allYs);
    const yTicks = niceTicks(yMin, yMax, 5);
    const yLo = yTicks.length ? Math.min(yTicks[0], yMin) : yMin;
    const yHi = yTicks.length ? Math.max(yTicks[yTicks.length - 1], yMax) : yMax;
    const sy = (v: number) => M.top + ih - ((v - yLo) / (yHi - yLo || 1)) * ih;

    // X scale.
    const allXs: number[] = isCat ? [] : group.series.flatMap(s => s.points.map(p => p.x as number));
    const xLo = isCat ? 0 : Math.min(...allXs);
    const xHi = isCat ? 0 : Math.max(...allXs);
    const band = isCat ? iw / Math.max(1, cats.length) : 0;
    const sxCat = (i: number) => M.left + i * band + band / 2;
    const sxNum = (x: number) => M.left + ((x - xLo) / (xHi - xLo || 1)) * iw;

    const ink = 'var(--vscode-foreground)';
    const gridLn = 'var(--vscode-editorWidget-border, rgba(128,128,128,.25))';

    const catSkip = isCat ? Math.max(1, Math.ceil(cats.length / 12)) : 1;
    const spanMs = !isCat && group.kind === 'time' ? xHi - xLo : 0;
    const xTickVals = !isCat && allXs.length ? niceTicks(xLo, xHi, 5) : [];

    const fmtX = (v: string | number): string =>
        group.kind === 'time' ? formatTimeTick(v as number, spanMs)
            : typeof v === 'number' ? compactNumber(v)
                : String(v).length > 14 ? String(v).slice(0, 13) + '…' : String(v);

    const nSeries = Math.max(1, group.series.length);
    // Grouped bars: split the category band into per-series slots (2px surface gaps).
    const slot = isCat ? Math.max(3, (band - 4) / nSeries) : 8;
    const barW = Math.max(2, Math.min(24, slot - 2));

    const zeroY = sy(Math.max(0, yLo));
    const tipLines = (sName: string, x: string | number, y: number): string[] => {
        const l = [String(typeof x === 'number' ? fmtX(x) : x)];
        if (showSeriesName) { l.push(sName); }
        l.push(`${yName}: ${y.toLocaleString()}`);
        return l;
    };

    return (
        <div class="bq-chart-scroll">
            <svg viewBox={`0 0 ${W} ${H}`} class="bq-chart-svg" role="img" aria-label={`${type} chart of ${yName}`}>
                {/* recessive horizontal grid + y tick labels */}
                {yTicks.map(t => (
                    <g>
                        <line x1={M.left} x2={W - M.right} y1={sy(t)} y2={sy(t)} stroke={gridLn} stroke-width="1" />
                        <text x={M.left - 8} y={sy(t) + 3.5} text-anchor="end" class="bq-chart-tick" fill={ink}>{compactNumber(t)}</text>
                    </g>
                ))}

                {/* x tick labels */}
                {isCat
                    ? cats.map((c, i) => (i % catSkip === 0
                        ? <text x={sxCat(i)} y={H - M.bottom + 16} text-anchor="middle" class="bq-chart-tick" fill={ink}>{fmtX(c)}</text>
                        : null))
                    : xTickVals.map(v => (
                        <text x={sxNum(v)} y={H - M.bottom + 16} text-anchor="middle" class="bq-chart-tick" fill={ink}>{fmtX(v)}</text>
                    ))}

                {/* marks, one layer per series */}
                {group.series.map((s, si) => {
                    const color = colorOf(s.name, si);

                    if (isCat && type === 'bar') {
                        return cats.map((c, ci) => {
                            const v = s.values[ci];
                            if (v === null) { return null; }
                            const groupLeft = sxCat(ci) - (slot * nSeries) / 2;
                            const x = groupLeft + si * slot + (slot - barW) / 2;
                            const y = sy(v);
                            const top = Math.min(y, zeroY);
                            const h = Math.max(1, Math.abs(zeroY - y));
                            return (
                                <rect
                                    x={x} y={top} width={barW} height={h}
                                    rx={Math.min(3, barW / 2)} fill={color}
                                    onMouseMove={(e: MouseEvent) => showTip(e, tipLines(s.name, c, v))}
                                    onMouseLeave={hideTip}
                                />
                            );
                        });
                    }

                    // Screen-space points for the series (category kinds place points at band centers).
                    const spts = isCat
                        ? cats.map((c, ci) => ({ label: c as string | number, px: sxCat(ci), v: s.values[ci] }))
                            .filter(p => p.v !== null)
                            .map(p => ({ label: p.label, px: p.px, py: sy(p.v as number), v: p.v as number }))
                        : s.points.map(p => ({ label: p.x, px: sxNum(p.x as number), py: sy(p.y), v: p.y }));

                    if (type === 'line') {
                        return (
                            <g>
                                <path
                                    d={spts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.px.toFixed(1)},${p.py.toFixed(1)}`).join(' ')}
                                    fill="none" stroke={color} stroke-width="2" stroke-linejoin="round"
                                />
                                {spts.length <= 120 && spts.map(p => (
                                    <circle
                                        cx={p.px} cy={p.py} r="3" fill={color} stroke="transparent" stroke-width="12"
                                        onMouseMove={(e: MouseEvent) => showTip(e, tipLines(s.name, p.label, p.v))}
                                        onMouseLeave={hideTip}
                                    />
                                ))}
                            </g>
                        );
                    }
                    if (type === 'scatter') {
                        return spts.map(p => (
                            <circle
                                cx={p.px} cy={p.py} r="4" fill={color} fill-opacity="0.75" stroke="transparent" stroke-width="10"
                                onMouseMove={(e: MouseEvent) => showTip(e, tipLines(s.name, p.label, p.v))}
                                onMouseLeave={hideTip}
                            />
                        ));
                    }
                    // bar over a numeric/time axis: thin per-point bars
                    return spts.map(p => {
                        const top = Math.min(p.py, zeroY);
                        const h = Math.max(1, Math.abs(zeroY - p.py));
                        return (
                            <rect
                                x={p.px - 2} y={top} width={4} height={h} rx={2} fill={color}
                                onMouseMove={(e: MouseEvent) => showTip(e, tipLines(s.name, p.label, p.v))}
                                onMouseLeave={hideTip}
                            />
                        );
                    });
                })}

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
