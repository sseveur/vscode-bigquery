import { JobDetails } from '../services/jobHistoryService';
import { formatJobBytes } from '../services/jobHistoryService';

/**
 * Renders the Job Details webview HTML. Pure string builder, everything escaped,
 * NO scripts — the panel ships with `default-src 'none'; style-src 'unsafe-inline'`.
 */
export function renderJobDetailsHtml(d: JobDetails): string {
    const e = d.entry;
    const when = e.creationTime ? new Date(e.creationTime).toLocaleString() : '—';

    const overviewRows: Array<[string, string]> = [
        ['Job', e.jobReference.jobId],
        ['Location', e.jobReference.location ?? '—'],
        ['Type', [e.jobType, e.statementType].filter(Boolean).join(' / ')],
        ['State', e.state + (e.cacheHit ? ' (cache hit)' : '')],
        ['User', e.user ?? '—'],
        ['Created', when],
        ['Duration', e.durationMs !== undefined ? `${(e.durationMs / 1000).toFixed(2)} s` : '—'],
        ['Bytes processed', e.bytesProcessed ? formatJobBytes(e.bytesProcessed) : e.cacheHit ? '0 B (cached)' : '—'],
        ['Slot time', d.totalSlotMs !== undefined ? formatSlotMs(d.totalSlotMs) : '—'],
        ['Priority', d.priority ?? '—'],
        ['Reservation', d.reservation ?? '—'],
        ['Destination', d.destinationTable ?? '—'],
    ];

    const sections: string[] = [];

    sections.push(`<h2>Overview</h2>
    <table class="kv">${overviewRows.map(([k, v]) =>
        `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}
    </table>`);

    if (d.errors.length > 0) {
        sections.push(`<h2 class="err-h">Errors (${d.errors.length})</h2>
        <ul class="errs">${d.errors.map(er =>
            `<li><b>${esc(er.reason ?? 'error')}</b>${er.location ? ` @ ${esc(er.location)}` : ''}: ${esc(er.message)}</li>`).join('')}
        </ul>`);
    }

    if (e.query) {
        sections.push(`<h2>Query</h2><pre class="sql">${esc(e.query)}</pre>`);
    }

    if (d.referencedTables.length > 0) {
        sections.push(`<h2>Referenced tables</h2>
        <ul>${d.referencedTables.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`);
    }

    if (d.stages.length > 0) {
        sections.push(`<h2>Execution plan (${d.stages.length} stage${d.stages.length === 1 ? '' : 's'})</h2>
        <table class="stages">
            <tr><th>Stage</th><th>Status</th><th>In</th><th>Out</th><th>Wait</th><th>Read</th><th>Compute</th><th>Write</th></tr>
            ${d.stages.map(s => `<tr>
                <td>${esc(s.name)}</td>
                <td>${esc(s.status ?? '')}</td>
                <td class="n">${fmtCount(s.recordsRead)}</td>
                <td class="n">${fmtCount(s.recordsWritten)}</td>
                <td class="n">${fmtMs(s.waitMsAvg)}</td>
                <td class="n">${fmtMs(s.readMsAvg)}</td>
                <td class="n">${fmtMs(s.computeMsAvg)}</td>
                <td class="n">${fmtMs(s.writeMsAvg)}</td>
            </tr>`).join('')}
        </table>`);
    }

    if (d.timeline.length > 0) {
        const last = d.timeline[d.timeline.length - 1];
        sections.push(`<h2>Timeline</h2>
        <p class="muted">${d.timeline.length} samples · ${formatSlotMs(last.totalSlotMs)} total slot time over ${(last.elapsedMs / 1000).toFixed(1)} s</p>
        ${timelineBars(d.timeline)}`);
    }

    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<style>
body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 12px 18px; font-size: 13px; }
h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .04em; opacity: .8; margin: 18px 0 6px; }
h2.err-h { color: var(--vscode-errorForeground); opacity: 1; }
table { border-collapse: collapse; }
.kv td { padding: 2px 14px 2px 0; vertical-align: top; }
.kv td:first-child { opacity: .65; white-space: nowrap; }
.stages th, .stages td { padding: 3px 10px 3px 0; text-align: left; border-bottom: 1px solid var(--vscode-editorWidget-border, rgba(128,128,128,.2)); }
.stages th { opacity: .65; font-weight: normal; }
.stages td.n { text-align: right; font-variant-numeric: tabular-nums; }
pre.sql { background: var(--vscode-textCodeBlock-background, rgba(128,128,128,.1)); padding: 8px 10px; border-radius: 4px; overflow-x: auto; font-family: var(--vscode-editor-font-family, monospace); font-size: 12px; }
ul.errs li { margin: 3px 0; }
.muted { opacity: .65; }
.tl { display: flex; align-items: flex-end; gap: 1px; height: 48px; margin-top: 4px; }
.tl span { flex: 1; background: var(--vscode-charts-blue, #4fc1ff); min-height: 1px; }
</style></head><body>
${sections.join('\n')}
</body></html>`;
}

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtMs(v?: number): string {
    return v === undefined ? '' : `${v.toLocaleString()} ms`;
}

function fmtCount(v?: number): string {
    return v === undefined ? '' : v.toLocaleString();
}

function formatSlotMs(ms: number): string {
    if (ms < 1000) { return `${ms} slot-ms`; }
    const s = ms / 1000;
    if (s < 60) { return `${s.toFixed(1)} slot-s`; }
    return `${(s / 60).toFixed(1)} slot-min`;
}

/** Per-sample slot usage as inline-styled bars (delta of cumulative slot ms). */
function timelineBars(timeline: JobDetails['timeline']): string {
    if (timeline.length < 2) { return ''; }
    const deltas = timeline.map((t, i) => i === 0 ? t.totalSlotMs : t.totalSlotMs - timeline[i - 1].totalSlotMs);
    const max = Math.max(...deltas, 1);
    const bars = deltas
        .slice(0, 120)
        .map(dv => `<span style="height:${Math.max(2, Math.round((dv / max) * 48))}px"></span>`)
        .join('');
    return `<div class="tl">${bars}</div>`;
}
