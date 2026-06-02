import * as vscode from 'vscode';
import { ColumnProfile, TopValue } from '../services/columnProfile';

const PANEL_VIEW_TYPE = 'bigquery-column-profile';

let currentPanel: vscode.WebviewPanel | undefined;

export function showColumnProfilePanel(profile: ColumnProfile, subtitle?: string): void {
    const title = `Profile: ${profile.columnName}`;
    if (currentPanel) {
        currentPanel.title = title;
        currentPanel.webview.html = renderHtml(profile, subtitle);
        currentPanel.reveal(vscode.ViewColumn.Beside, true);
        return;
    }

    currentPanel = vscode.window.createWebviewPanel(
        PANEL_VIEW_TYPE,
        title,
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
        { enableScripts: false, retainContextWhenHidden: true }
    );
    currentPanel.webview.html = renderHtml(profile, subtitle);
    currentPanel.onDidDispose(() => { currentPanel = undefined; });
}

function renderHtml(profile: ColumnProfile, subtitle: string | undefined): string {
    const stats = renderStatsTable(profile);
    const distChart = renderDistributionChart(profile);
    const quantiles = renderQuantiles(profile.quantiles);
    const topValues = renderTopValues(profile.topValues);
    const sql = escapeHtml(profile.sourceSql);
    const sub = subtitle ? `<p class="subtitle">${escapeHtml(subtitle)} · ${formatNumber(profile.totalCount)} rows scanned</p>`
                         : `<p class="subtitle">${formatNumber(profile.totalCount)} rows scanned</p>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
<title>Column Profile</title>
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 18px 22px; font-size: 13px; line-height: 1.5; }
  h1 { font-size: 1.15em; margin: 0 0 4px; }
  h2 { font-size: 0.95em; margin: 22px 0 8px; color: var(--vscode-descriptionForeground); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
  details.section { margin-top: 18px; }
  details.section > summary { font-size: 0.95em; color: var(--vscode-descriptionForeground); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; cursor: pointer; padding: 4px 0; list-style: none; user-select: none; display: flex; align-items: center; gap: 6px; }
  details.section > summary::-webkit-details-marker { display: none; }
  details.section > summary::before { content: '▸'; display: inline-block; transition: transform 0.12s ease; font-size: 0.85em; color: var(--vscode-descriptionForeground); }
  details.section[open] > summary::before { transform: rotate(90deg); }
  details.section > summary:hover { color: var(--vscode-foreground); }
  details.section > .section-body { padding: 8px 0 4px; }
  .subtitle { color: var(--vscode-descriptionForeground); margin: 0 0 18px; }
  .type-badge { display: inline-block; padding: 1px 6px; border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border)); border-radius: 3px; font-size: 0.85em; font-family: var(--vscode-editor-font-family); margin-left: 6px; }
  table { border-collapse: collapse; width: 100%; max-width: 720px; }
  th, td { text-align: left; padding: 5px 10px; border-bottom: 1px solid var(--vscode-widget-border, var(--vscode-panel-border)); }
  th { font-weight: 600; color: var(--vscode-descriptionForeground); }
  td.num { text-align: right; font-variant-numeric: tabular-nums; font-family: var(--vscode-editor-font-family); }
  .bar-row { display: flex; align-items: center; gap: 8px; max-width: 720px; margin: 2px 0; }
  .bar-label { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--vscode-editor-font-family); }
  .bar-track { flex: 0 0 200px; height: 10px; background: var(--vscode-editorWidget-background, rgba(127,127,127,0.18)); border-radius: 2px; overflow: hidden; display: block; }
  .bar-fill { display: block; height: 100%; background: var(--vscode-charts-blue, var(--vscode-textLink-foreground, #4fc1ff)); }
  .bar-count { flex: 0 0 90px; text-align: right; font-variant-numeric: tabular-nums; color: var(--vscode-descriptionForeground); font-family: var(--vscode-editor-font-family); }
  pre.sql { background: var(--vscode-textCodeBlock-background); padding: 10px 12px; border-radius: 4px; overflow-x: auto; font-family: var(--vscode-editor-font-family); font-size: 0.9em; max-width: 720px; }
  details { margin-top: 18px; }
  summary { cursor: pointer; color: var(--vscode-descriptionForeground); }
  .muted { color: var(--vscode-descriptionForeground); font-style: italic; }
  .chart-wrap { max-width: 720px; }
  .chart-axis { color: var(--vscode-descriptionForeground); font-family: var(--vscode-editor-font-family); font-size: 0.85em; display: flex; justify-content: space-between; margin-top: 2px; }
  svg.chart { display: block; width: 100%; height: auto; }
  .scale-toggle { position: absolute; opacity: 0; pointer-events: none; width: 0; height: 0; }
  .scale-tabs { display: inline-flex; gap: 0; margin-bottom: 6px; border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border)); border-radius: 4px; overflow: hidden; font-size: 0.85em; }
  .scale-tab { padding: 3px 12px; cursor: pointer; color: var(--vscode-descriptionForeground); user-select: none; }
  .scale-tab + .scale-tab { border-left: 1px solid var(--vscode-widget-border, var(--vscode-panel-border)); }
  .scale-tab:hover { background: var(--vscode-toolbar-hoverBackground, rgba(127,127,127,0.12)); }
  .chart-wrap .scale-pane-log { display: none; }
  .chart-wrap .scale-toggle:nth-of-type(2):checked ~ .scale-stage .scale-pane-lin { display: none; }
  .chart-wrap .scale-toggle:nth-of-type(2):checked ~ .scale-stage .scale-pane-log { display: block; }
  .chart-wrap .scale-toggle:nth-of-type(1):checked ~ .scale-tabs .scale-tab-lin,
  .chart-wrap .scale-toggle:nth-of-type(2):checked ~ .scale-tabs .scale-tab-log { background: var(--vscode-button-background, #0e639c); color: var(--vscode-button-foreground, #fff); }
  .hist-bar { fill: var(--vscode-charts-blue, var(--vscode-textLink-foreground)); opacity: 0.85; }
  .box-line { stroke: var(--vscode-foreground); stroke-width: 1.2; }
  .box-rect { fill: var(--vscode-charts-blue, var(--vscode-textLink-foreground)); fill-opacity: 0.25; stroke: var(--vscode-charts-blue, var(--vscode-textLink-foreground)); stroke-width: 1.2; }
  .box-median { stroke: var(--vscode-charts-orange, #d18616); stroke-width: 2; }
</style>
</head>
<body>
  <h1>${escapeHtml(profile.columnName)}<span class="type-badge">${escapeHtml(profile.columnType)}</span></h1>
  ${sub}

  <details class="section" open>
    <summary>Stats</summary>
    <div class="section-body">${stats}</div>
  </details>

  ${distChart}
  ${quantiles}
  ${topValues}

  <details class="section">
    <summary>Source SQL</summary>
    <div class="section-body"><pre class="sql">${sql}</pre></div>
  </details>
</body>
</html>`;
}

function renderStatsTable(profile: ColumnProfile): string {
    const nullPct = profile.totalCount > 0
        ? (profile.nullCount / profile.totalCount * 100).toFixed(2)
        : '0.00';
    const distinctPct = (profile.distinctCount != null && profile.totalCount > 0)
        ? (profile.distinctCount / Math.max(1, profile.totalCount - profile.nullCount) * 100).toFixed(2)
        : null;

    const rows: Array<[string, string]> = [];
    rows.push(['Total rows', formatNumber(profile.totalCount)]);
    rows.push(['Null', `${formatNumber(profile.nullCount)} (${nullPct}%)`]);
    if (profile.distinctCount != null) {
        rows.push(['Distinct (non-null)', `${formatNumber(profile.distinctCount)}${distinctPct ? ` (${distinctPct}% unique)` : ''}`]);
    }
    if (profile.isUnique != null) {
        rows.push(['Unique', profile.isUnique ? 'Yes' : 'No']);
    }
    if (profile.duplicateValueCount != null) {
        rows.push(['Duplicate values', `${formatNumber(profile.duplicateValueCount)} appear >1×`]);
    }
    if (profile.duplicateRowCount != null) {
        const dupPct = profile.totalCount > 0
            ? (profile.duplicateRowCount / profile.totalCount * 100).toFixed(2)
            : '0.00';
        rows.push(['Duplicate rows', `${formatNumber(profile.duplicateRowCount)} (${dupPct}%)`]);
    }
    if (profile.minValue !== null) {
        rows.push(['Min', formatScalar(profile.minValue)]);
    }
    if (profile.maxValue !== null) {
        rows.push(['Max', formatScalar(profile.maxValue)]);
    }

    const tbody = rows.map(([label, value]) =>
        `<tr><th>${escapeHtml(label)}</th><td class="num">${escapeHtml(value)}</td></tr>`
    ).join('');
    return `<table><tbody>${tbody}</tbody></table>`;
}

/**
 * For numeric/temporal columns, render a box plot above a quantile-derived density
 * histogram. Each of the 20 quantile buckets carries exactly 1/20 of the data,
 * so bar heights are proportional to 1/(quantile gap) — narrower gaps mean denser
 * regions of the distribution.
 *
 * Heavy-tailed distributions (e.g. lifetime sales: p90 = 5k, max = 3M) flatten
 * out on a linear x-axis. We render two SVGs — linear and signed-log — and let
 * the user toggle between them with hidden-radio CSS, so the panel stays
 * script-free.
 */
function renderDistributionChart(profile: ColumnProfile): string {
    const numeric = quantilesToNumbers(profile.quantiles);
    if (!numeric || numeric.length < 3) { return ''; }

    const min = numeric[0];
    const max = numeric[numeric.length - 1];
    if (!(max > min)) {
        // All values equal — nothing meaningful to draw.
        return '';
    }

    const linear = buildDistSvg(numeric, (v) => v);
    if (!linear) { return ''; }
    const log = buildDistSvg(numeric, signedLog);

    const p50 = numeric[Math.floor(numeric.length * 0.50)];
    const id = `dist-${Math.floor(Math.random() * 1e9).toString(36)}`;

    return `<details class="section" open>
  <summary>Distribution</summary>
  <div class="section-body chart-wrap">
    <input type="radio" id="${id}-lin" name="${id}" class="scale-toggle" checked>
    <input type="radio" id="${id}-log" name="${id}" class="scale-toggle">
    <div class="scale-tabs">
      <label for="${id}-lin" class="scale-tab scale-tab-lin">Linear</label>
      <label for="${id}-log" class="scale-tab scale-tab-log">Log</label>
    </div>
    <div class="scale-stage">
      <div class="scale-pane scale-pane-lin">
        ${linear}
        <div class="chart-axis">
          <span>${escapeHtml(formatScalar(profile.minValue))}</span>
          <span>median ${escapeHtml(formatNumber(p50))}</span>
          <span>${escapeHtml(formatScalar(profile.maxValue))}</span>
        </div>
      </div>
      <div class="scale-pane scale-pane-log">
        ${log ?? '<div class="muted">Log scale not available for this distribution.</div>'}
        <div class="chart-axis">
          <span>${escapeHtml(formatScalar(profile.minValue))}</span>
          <span>median ${escapeHtml(formatNumber(p50))} (symlog)</span>
          <span>${escapeHtml(formatScalar(profile.maxValue))}</span>
        </div>
      </div>
    </div>
  </div>
</details>`;
}

/**
 * Signed log: sign(x) * log10(1 + |x|). Handles negatives and zeros without a
 * domain crash, and compresses heavy tails the same way Matplotlib's `symlog`
 * does. Slope near zero stays near 1 so the shape isn't distorted around the
 * origin.
 */
function signedLog(v: number): number {
    return Math.sign(v) * Math.log10(1 + Math.abs(v));
}

/**
 * Builds the histogram + box plot SVG given a quantile array and an x-axis
 * transform. Returns null when the transformed range collapses (all values
 * map to the same point).
 */
function buildDistSvg(numeric: number[], xform: (v: number) => number): string | null {
    const min = numeric[0];
    const max = numeric[numeric.length - 1];
    const tMin = xform(min);
    const tMax = xform(max);
    if (!(tMax > tMin)) { return null; }

    const width = 720;
    const padX = 8;
    const histHeight = 120;
    const boxHeight = 36;
    const totalHeight = histHeight + boxHeight + 16;
    const innerWidth = width - padX * 2;

    const scaleX = (v: number) => padX + ((xform(v) - tMin) / (tMax - tMin)) * innerWidth;

    // Density histogram from quantile gaps (post-transform).
    const bars: string[] = [];
    let maxDensity = 0;
    const buckets: Array<{ lo: number; hi: number; density: number }> = [];
    for (let i = 0; i < numeric.length - 1; i++) {
        const lo = numeric[i];
        const hi = numeric[i + 1];
        const tSpan = xform(hi) - xform(lo);
        const density = tSpan > 0 ? 1 / tSpan : 0;
        if (density > maxDensity) { maxDensity = density; }
        buckets.push({ lo, hi, density });
    }
    if (maxDensity === 0) { return null; }

    for (const b of buckets) {
        const x = scaleX(b.lo);
        const w = Math.max(1, scaleX(b.hi) - scaleX(b.lo));
        const h = (b.density / maxDensity) * histHeight;
        const y = histHeight - h;
        bars.push(`<rect class="hist-bar" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" />`);
    }

    const boxCenterY = histHeight + 8 + boxHeight / 2;
    const p25 = numeric[Math.floor(numeric.length * 0.25)];
    const p50 = numeric[Math.floor(numeric.length * 0.50)];
    const p75 = numeric[Math.floor(numeric.length * 0.75)];

    const boxX1 = scaleX(p25);
    const boxX2 = scaleX(p75);
    const medianX = scaleX(p50);

    const boxParts: string[] = [];
    boxParts.push(`<line class="box-line" x1="${scaleX(min)}" y1="${boxCenterY}" x2="${scaleX(max)}" y2="${boxCenterY}" />`);
    boxParts.push(`<line class="box-line" x1="${scaleX(min)}" y1="${boxCenterY - 8}" x2="${scaleX(min)}" y2="${boxCenterY + 8}" />`);
    boxParts.push(`<line class="box-line" x1="${scaleX(max)}" y1="${boxCenterY - 8}" x2="${scaleX(max)}" y2="${boxCenterY + 8}" />`);
    boxParts.push(`<rect class="box-rect" x="${boxX1.toFixed(2)}" y="${(boxCenterY - 10).toFixed(2)}" width="${Math.max(1, boxX2 - boxX1).toFixed(2)}" height="20" />`);
    boxParts.push(`<line class="box-median" x1="${medianX.toFixed(2)}" y1="${boxCenterY - 10}" x2="${medianX.toFixed(2)}" y2="${boxCenterY + 10}" />`);

    return `<svg class="chart" viewBox="0 0 ${width} ${totalHeight}" preserveAspectRatio="none">
    ${bars.join('\n    ')}
    ${boxParts.join('\n    ')}
  </svg>`;
}

function renderQuantiles(quantiles: unknown[] | null): string {
    if (!quantiles || quantiles.length === 0) { return ''; }
    // Always show the canonical decile cuts even when we collected 20-bucket quantiles.
    const idxLabel: Array<[number, string]> = quantiles.length === 21
        ? [[0, 'min'], [2, 'p10'], [4, 'p20'], [6, 'p30'], [8, 'p40'], [10, 'p50'],
           [12, 'p60'], [14, 'p70'], [16, 'p80'], [18, 'p90'], [20, 'max']]
        : quantiles.length === 11
            ? [[0, 'min'], [1, 'p10'], [2, 'p20'], [3, 'p30'], [4, 'p40'], [5, 'p50'],
               [6, 'p60'], [7, 'p70'], [8, 'p80'], [9, 'p90'], [10, 'max']]
            : quantiles.map((_, i) => [i, `q${i}`] as [number, string]);

    const tbody = idxLabel.map(([i, label]) =>
        `<tr><th>${escapeHtml(label)}</th><td class="num">${escapeHtml(formatScalar(quantiles[i]))}</td></tr>`
    ).join('');
    return `<details class="section">
  <summary>Quantiles (approx)</summary>
  <div class="section-body"><table><tbody>${tbody}</tbody></table></div>
</details>`;
}

function renderTopValues(top: TopValue[] | null): string {
    if (!top || top.length === 0) { return ''; }
    const max = Math.max(...top.map(t => t.count));
    const rows = top.map(t => {
        const pct = max > 0 ? (t.count / max * 100).toFixed(1) : '0';
        const label = formatScalar(t.value);
        return `<div class="bar-row">
          <span class="bar-label" title="${escapeHtml(label)}">${escapeHtml(label)}</span>
          <span class="bar-track"><span class="bar-fill" style="width:${pct}%"></span></span>
          <span class="bar-count">${formatNumber(t.count)}</span>
        </div>`;
    }).join('');
    return `<details class="section" open>
  <summary>Top values</summary>
  <div class="section-body">${rows}</div>
</details>`;
}

/**
 * Parses quantile entries (numbers / numeric strings / BigQueryDate-style {value: '...'})
 * to numbers. Date strings are parsed via Date.parse. Returns null when the array
 * isn't usable for a chart (mixed/non-numeric).
 */
function quantilesToNumbers(quantiles: unknown[] | null): number[] | null {
    if (!quantiles || quantiles.length === 0) { return null; }
    const out: number[] = [];
    for (const q of quantiles) {
        const n = toNumber(q);
        if (n == null) { return null; }
        out.push(n);
    }
    return out;
}

// big.js (NUMERIC / BIGNUMERIC) instances expose `c` (coefficient digits array),
// `e` (exponent), `s` (sign), and `toFixed`/`toString`. They do NOT have a `.value`
// field — earlier paths assumed they did and would JSON.stringify them, producing
// `"-65842.79"` (a quoted string). Detect and stringify explicitly instead.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function bigToString(v: any): string | null {
    if (v && typeof v.toFixed === 'function' && Array.isArray(v.c)) {
        try { return v.toString(); } catch { return null; }
    }
    return null;
}

function toNumber(v: unknown): number | null {
    if (v == null) { return null; }
    if (typeof v === 'number') { return Number.isFinite(v) ? v : null; }
    if (typeof v === 'string') {
        const n = Number(v);
        if (Number.isFinite(n)) { return n; }
        const t = Date.parse(v);
        return Number.isFinite(t) ? t : null;
    }
    if (typeof v === 'object') {
        const bigStr = bigToString(v);
        if (bigStr !== null) {
            const n = Number(bigStr);
            return Number.isFinite(n) ? n : null;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const val = (v as any).value;
        if (typeof val === 'string') {
            const n = Number(val);
            if (Number.isFinite(n)) { return n; }
            const t = Date.parse(val);
            return Number.isFinite(t) ? t : null;
        }
        if (typeof val === 'number') { return Number.isFinite(val) ? val : null; }
    }
    return null;
}

function formatScalar(value: unknown): string {
    if (value === null || value === undefined) { return 'NULL'; }
    if (typeof value === 'object') {
        // BigQueryDate / BigQueryTimestamp / BigQueryDatetime expose `.value` as a string.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const v: any = value;
        if (typeof v.value === 'string') { return v.value; }
        const bigStr = bigToString(v);
        if (bigStr !== null) { return bigStr; }
        try { return JSON.stringify(value); } catch { return String(value); }
    }
    return String(value);
}

function formatNumber(n: number): string {
    if (!Number.isFinite(n)) { return String(n); }
    return n.toLocaleString();
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
