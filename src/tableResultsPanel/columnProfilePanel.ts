import * as vscode from 'vscode';
import { ColumnProfile, TopValue } from '../services/columnProfile';

const PANEL_VIEW_TYPE = 'bigquery-column-profile';

let currentPanel: vscode.WebviewPanel | undefined;

export function showColumnProfilePanel(profile: ColumnProfile): void {
    const title = `Profile: ${profile.columnName}`;
    if (currentPanel) {
        currentPanel.title = title;
        currentPanel.webview.html = renderHtml(profile);
        currentPanel.reveal(vscode.ViewColumn.Beside, true);
        return;
    }

    currentPanel = vscode.window.createWebviewPanel(
        PANEL_VIEW_TYPE,
        title,
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
        { enableScripts: false, retainContextWhenHidden: true }
    );
    currentPanel.webview.html = renderHtml(profile);
    currentPanel.onDidDispose(() => { currentPanel = undefined; });
}

function renderHtml(profile: ColumnProfile): string {
    const stats = renderStatsTable(profile);
    const quantiles = renderQuantiles(profile.quantiles);
    const topValues = renderTopValues(profile.topValues);
    const sql = escapeHtml(profile.sourceSql);

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
  .subtitle { color: var(--vscode-descriptionForeground); margin: 0 0 18px; }
  .type-badge { display: inline-block; padding: 1px 6px; border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border)); border-radius: 3px; font-size: 0.85em; font-family: var(--vscode-editor-font-family); margin-left: 6px; }
  table { border-collapse: collapse; width: 100%; max-width: 720px; }
  th, td { text-align: left; padding: 5px 10px; border-bottom: 1px solid var(--vscode-widget-border, var(--vscode-panel-border)); }
  th { font-weight: 600; color: var(--vscode-descriptionForeground); }
  td.num { text-align: right; font-variant-numeric: tabular-nums; font-family: var(--vscode-editor-font-family); }
  .bar-row { display: flex; align-items: center; gap: 8px; max-width: 720px; margin: 2px 0; }
  .bar-label { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--vscode-editor-font-family); }
  .bar-track { flex: 0 0 200px; height: 10px; background: var(--vscode-editorWidget-background); border-radius: 2px; overflow: hidden; }
  .bar-fill { height: 100%; background: var(--vscode-charts-blue, var(--vscode-textLink-foreground)); }
  .bar-count { flex: 0 0 90px; text-align: right; font-variant-numeric: tabular-nums; color: var(--vscode-descriptionForeground); font-family: var(--vscode-editor-font-family); }
  pre.sql { background: var(--vscode-textCodeBlock-background); padding: 10px 12px; border-radius: 4px; overflow-x: auto; font-family: var(--vscode-editor-font-family); font-size: 0.9em; max-width: 720px; }
  details { margin-top: 18px; }
  summary { cursor: pointer; color: var(--vscode-descriptionForeground); }
  .muted { color: var(--vscode-descriptionForeground); font-style: italic; }
</style>
</head>
<body>
  <h1>${escapeHtml(profile.columnName)}<span class="type-badge">${escapeHtml(profile.columnType)}</span></h1>
  <p class="subtitle">${formatNumber(profile.totalCount)} rows scanned</p>

  <h2>Stats</h2>
  ${stats}

  ${quantiles}
  ${topValues}

  <details>
    <summary>Source SQL</summary>
    <pre class="sql">${sql}</pre>
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

function renderQuantiles(quantiles: unknown[] | null): string {
    if (!quantiles || quantiles.length === 0) { return ''; }
    const labels = quantiles.length === 11
        ? ['min', 'p10', 'p20', 'p30', 'p40', 'p50', 'p60', 'p70', 'p80', 'p90', 'max']
        : quantiles.map((_, i) => `q${i}`);
    const tbody = quantiles.map((q, i) =>
        `<tr><th>${escapeHtml(labels[i])}</th><td class="num">${escapeHtml(formatScalar(q))}</td></tr>`
    ).join('');
    return `<h2>Quantiles (approx)</h2><table><tbody>${tbody}</tbody></table>`;
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
    return `<h2>Top values</h2>${rows}`;
}

function formatScalar(value: unknown): string {
    if (value === null || value === undefined) { return 'NULL'; }
    if (typeof value === 'object') {
        // BigQueryDate / BigQueryTimestamp / BigQueryDatetime / Big numerics have a `.value` field.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const v: any = value;
        if (typeof v.value === 'string') { return v.value; }
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
