/**
 * Renders BigQuery cell output as an interactive HTML table with:
 * - Tabs: Results / Schema
 * - Client-side sorting (click headers)
 * - Client-side pagination through already-fetched rows
 */

export interface SchemaField {
    name: string;
    type?: string;
    mode?: string;
    fields?: SchemaField[];
}

export interface RenderStats {
    bytesProcessed: number;
    durationMs: number;
    totalRows: number;
    previewedRows: number;
}

export function renderResultsHtml(
    rows: any[],
    fields: SchemaField[],
    stats: RenderStats
): string {
    const truncated = stats.totalRows > stats.previewedRows;
    const statsLine = [
        `${stats.totalRows.toLocaleString()} row${stats.totalRows === 1 ? '' : 's'}`,
        `${formatBytes(stats.bytesProcessed)} processed`,
        `${stats.durationMs} ms`
    ].join(' \u00b7 ');

    const truncationNotice = truncated
        ? `<div class="bq-notice">Showing first ${stats.previewedRows.toLocaleString()} of ${stats.totalRows.toLocaleString()} rows.</div>`
        : '';

    if (rows.length === 0) {
        return `${baseStyles()}<div class="bq-stats">${escapeHtml(statsLine)}</div><div class="bq-empty">No rows returned.</div>`;
    }

    const flatRows = rows.map(row => flattenRow(row, fields));
    const dataJson = JSON.stringify(flatRows).replace(/</g, '\\u003c');
    const fieldsJson = JSON.stringify(fields.map(f => ({ name: f.name, type: f.type || '', mode: f.mode || '' }))).replace(/</g, '\\u003c');

    const schemaTable = renderSchemaTable(fields);

    return `
${baseStyles()}
<div class="bq-root">
    <div class="bq-tabs" role="tablist">
        <button class="bq-tab active" data-tab="results" role="tab">Results</button>
        <button class="bq-tab" data-tab="schema" role="tab">Schema (${fields.length})</button>
        <div class="bq-stats">${escapeHtml(statsLine)}</div>
    </div>
    ${truncationNotice}
    <div class="bq-pane" data-pane="results">
        <div class="bq-scroll">
            <table class="bq-grid">
                <thead></thead>
                <tbody></tbody>
            </table>
        </div>
        <div class="bq-pagination">
            <button class="bq-pg-btn" data-nav="first" title="First page">&laquo;</button>
            <button class="bq-pg-btn" data-nav="prev" title="Previous page">&lsaquo;</button>
            <span class="bq-pg-info"></span>
            <button class="bq-pg-btn" data-nav="next" title="Next page">&rsaquo;</button>
            <button class="bq-pg-btn" data-nav="last" title="Last page">&raquo;</button>
            <select class="bq-pg-size" title="Rows per page">
                <option value="25">25</option>
                <option value="50" selected>50</option>
                <option value="100">100</option>
                <option value="250">250</option>
                <option value="1000">1000</option>
            </select>
        </div>
    </div>
    <div class="bq-pane hidden" data-pane="schema">${schemaTable}</div>
</div>
<script>
(function() {
    var root = document.currentScript.previousElementSibling;
    while (root && !root.classList.contains('bq-root')) { root = root.previousElementSibling; }
    if (!root) { return; }

    var data = ${dataJson};
    var fields = ${fieldsJson};
    var page = 0;
    var pageSize = 50;
    var sortCol = null;
    var sortDir = 1;
    var sortedData = data.slice();

    var thead = root.querySelector('thead');
    var tbody = root.querySelector('tbody');
    var pgInfo = root.querySelector('.bq-pg-info');
    var pgSize = root.querySelector('.bq-pg-size');

    function renderHeader() {
        var row = '<tr>' + fields.map(function(f, i) {
            var arrow = sortCol === i ? (sortDir > 0 ? ' \u25b2' : ' \u25bc') : '';
            return '<th data-col="' + i + '" title="' + escapeAttr(f.type) + '">' + escapeHtml(f.name) + arrow + '</th>';
        }).join('') + '</tr>';
        thead.innerHTML = row;
        thead.querySelectorAll('th').forEach(function(th) {
            th.addEventListener('click', function() {
                var col = parseInt(th.getAttribute('data-col'), 10);
                if (sortCol === col) { sortDir = -sortDir; } else { sortCol = col; sortDir = 1; }
                applySort();
                page = 0;
                renderAll();
            });
        });
    }

    function applySort() {
        if (sortCol === null) { sortedData = data.slice(); return; }
        var name = fields[sortCol].name;
        sortedData = data.slice().sort(function(a, b) {
            var av = a[name];
            var bv = b[name];
            if (av == null && bv == null) { return 0; }
            if (av == null) { return 1; }
            if (bv == null) { return -1; }
            var an = parseFloat(av);
            var bn = parseFloat(bv);
            if (!isNaN(an) && !isNaN(bn)) { return (an - bn) * sortDir; }
            return String(av).localeCompare(String(bv)) * sortDir;
        });
    }

    function renderBody() {
        var start = page * pageSize;
        var end = Math.min(start + pageSize, sortedData.length);
        var html = '';
        for (var i = start; i < end; i++) {
            var row = sortedData[i];
            html += '<tr>';
            for (var j = 0; j < fields.length; j++) {
                html += '<td>' + formatCell(row[fields[j].name]) + '</td>';
            }
            html += '</tr>';
        }
        tbody.innerHTML = html;
    }

    function renderInfo() {
        var total = sortedData.length;
        var totalPages = Math.max(1, Math.ceil(total / pageSize));
        if (page >= totalPages) { page = totalPages - 1; }
        if (page < 0) { page = 0; }
        var start = total === 0 ? 0 : page * pageSize + 1;
        var end = Math.min((page + 1) * pageSize, total);
        pgInfo.textContent = start + '-' + end + ' of ' + total.toLocaleString() + ' (page ' + (page + 1) + '/' + totalPages + ')';
    }

    function renderAll() {
        renderHeader();
        renderBody();
        renderInfo();
    }

    root.querySelectorAll('.bq-pg-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var nav = btn.getAttribute('data-nav');
            var totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
            if (nav === 'first') { page = 0; }
            else if (nav === 'last') { page = totalPages - 1; }
            else if (nav === 'prev') { page = Math.max(0, page - 1); }
            else if (nav === 'next') { page = Math.min(totalPages - 1, page + 1); }
            renderBody();
            renderInfo();
        });
    });

    pgSize.addEventListener('change', function() {
        pageSize = parseInt(pgSize.value, 10);
        page = 0;
        renderBody();
        renderInfo();
    });

    root.querySelectorAll('.bq-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            var target = tab.getAttribute('data-tab');
            root.querySelectorAll('.bq-tab').forEach(function(t) { t.classList.toggle('active', t === tab); });
            root.querySelectorAll('.bq-pane').forEach(function(p) {
                p.classList.toggle('hidden', p.getAttribute('data-pane') !== target);
            });
        });
    });

    function escapeHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function escapeAttr(s) { return escapeHtml(s); }
    function formatCell(v) {
        if (v === null || v === undefined) { return '<span class="bq-null">NULL</span>'; }
        if (typeof v === 'object') {
            if (v.value !== undefined) { return escapeHtml(String(v.value)); }
            return escapeHtml(JSON.stringify(v));
        }
        return escapeHtml(String(v));
    }

    renderAll();
})();
</script>
`;
}

function renderSchemaTable(fields: SchemaField[], depth: number = 0): string {
    if (!fields || fields.length === 0) {
        return '<div class="bq-empty">No schema available.</div>';
    }
    const rows = fields.map(f => {
        const nested = f.fields && f.fields.length > 0
            ? `<tr><td colspan="3" class="bq-schema-nested">${renderSchemaTable(f.fields, depth + 1)}</td></tr>`
            : '';
        const indent = '&nbsp;&nbsp;'.repeat(depth);
        return `<tr>
            <td>${indent}${escapeHtml(f.name)}</td>
            <td>${escapeHtml(f.type || '')}</td>
            <td>${escapeHtml(f.mode || '')}</td>
        </tr>${nested}`;
    }).join('');
    return `<table class="bq-schema">
        <thead><tr><th>Name</th><th>Type</th><th>Mode</th></tr></thead>
        <tbody>${rows}</tbody>
    </table>`;
}

function flattenRow(row: any, fields: SchemaField[]): Record<string, any> {
    const out: Record<string, any> = {};
    for (const f of fields) {
        const v = row[f.name];
        if (v === null || v === undefined) {
            out[f.name] = null;
        } else if (typeof v === 'object' && v.value !== undefined) {
            out[f.name] = v.value;
        } else if (v instanceof Date) {
            out[f.name] = v.toISOString();
        } else if (typeof v === 'object') {
            out[f.name] = JSON.stringify(v);
        } else {
            out[f.name] = v;
        }
    }
    return out;
}

function escapeHtml(input: string): string {
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatBytes(bytes: number): string {
    if (!bytes || bytes < 1024) {
        return `${bytes} B`;
    }
    const units = ['KB', 'MB', 'GB', 'TB', 'PB'];
    let value = bytes / 1024;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex++;
    }
    return `${value.toFixed(2)} ${units[unitIndex]}`;
}

function baseStyles(): string {
    return `<style>
.bq-root { font-family: var(--vscode-font-family, sans-serif); font-size: 0.9em; }
.bq-tabs { display: flex; align-items: center; gap: 4px; border-bottom: 1px solid var(--vscode-panel-border, #3e3e3e); margin-bottom: 6px; }
.bq-tab { background: transparent; color: inherit; border: none; border-bottom: 2px solid transparent; padding: 6px 10px; cursor: pointer; font-size: 0.9em; }
.bq-tab.active { border-bottom-color: var(--vscode-focusBorder, #007acc); font-weight: 600; }
.bq-tab:hover { background: var(--vscode-list-hoverBackground, #2a2d2e); }
.bq-stats { font-size: 0.85em; opacity: 0.75; margin-left: auto; padding: 0 8px; }
.bq-notice { font-size: 0.85em; opacity: 0.7; margin-bottom: 6px; font-style: italic; }
.bq-empty { font-size: 0.9em; opacity: 0.7; padding: 8px; border: 1px dashed currentColor; border-radius: 4px; }
.bq-pane { }
.bq-pane.hidden { display: none; }
.bq-scroll { max-height: 420px; overflow: auto; border: 1px solid var(--vscode-panel-border, #3e3e3e); border-radius: 4px; }
.bq-grid { border-collapse: collapse; width: 100%; font-family: var(--vscode-editor-font-family, monospace); font-size: 0.9em; }
.bq-grid th, .bq-grid td { padding: 4px 8px; text-align: left; border-bottom: 1px solid var(--vscode-panel-border, #3e3e3e); white-space: nowrap; }
.bq-grid th { position: sticky; top: 0; background: var(--vscode-editor-background, #1e1e1e); font-weight: 600; z-index: 1; cursor: pointer; user-select: none; }
.bq-grid th:hover { background: var(--vscode-list-hoverBackground, #2a2d2e); }
.bq-grid tbody tr:hover { background: var(--vscode-list-hoverBackground, #2a2d2e); }
.bq-null { opacity: 0.5; font-style: italic; }
.bq-pagination { display: flex; align-items: center; gap: 4px; padding: 6px 2px; font-size: 0.85em; }
.bq-pg-btn { background: transparent; color: inherit; border: 1px solid var(--vscode-panel-border, #3e3e3e); padding: 2px 8px; cursor: pointer; border-radius: 3px; }
.bq-pg-btn:hover { background: var(--vscode-list-hoverBackground, #2a2d2e); }
.bq-pg-info { padding: 0 8px; opacity: 0.8; }
.bq-pg-size { background: transparent; color: inherit; border: 1px solid var(--vscode-panel-border, #3e3e3e); padding: 2px 4px; margin-left: auto; border-radius: 3px; }
.bq-schema { border-collapse: collapse; width: 100%; font-size: 0.9em; }
.bq-schema th, .bq-schema td { padding: 4px 8px; text-align: left; border-bottom: 1px solid var(--vscode-panel-border, #3e3e3e); }
.bq-schema th { font-weight: 600; background: var(--vscode-editor-background, #1e1e1e); }
.bq-schema-nested { padding-left: 20px !important; }
</style>`;
}
