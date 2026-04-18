import { useEffect, useMemo, useState } from 'preact/hooks';
import type { BqField, JobReference } from './types';
import { flattenSchema, extractRowValue, renderCellValue, type FlatColumn } from './cellFormatters';
import { fetchPage, DEFAULT_PAGE_SIZE } from './pagination';

interface Props {
    jobRef: JobReference;
    token: string;
    schema: BqField[];
    totalRows: number;
    initialRows: Array<{ f: Array<{ v: any }> }>;
}

type SortState = { colKey: string; dir: 1 | -1 } | null;

const NUMERIC_TYPES = new Set(['INT64', 'INTEGER', 'FLOAT', 'FLOAT64', 'NUMERIC', 'BIGNUMERIC']);
function isNumericType(t: string): boolean {
    return NUMERIC_TYPES.has(t.toUpperCase());
}

function showToast(msg: string) {
    let el = document.querySelector('.bq-toast') as HTMLDivElement | null;
    if (!el) {
        el = document.createElement('div');
        el.className = 'bq-toast';
        document.body.appendChild(el);
    }
    el.textContent = msg;
    requestAnimationFrame(() => el!.classList.add('show'));
    window.clearTimeout((el as any)._t);
    (el as any)._t = window.setTimeout(() => el!.classList.remove('show'), 1200);
}

async function copyText(text: string) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('Copied');
    } catch {
        showToast('Copy failed');
    }
}

function valueToCopyText(v: any, col: FlatColumn): string {
    if (v === null || v === undefined) { return ''; }
    if (typeof v === 'object') {
        try { return JSON.stringify(v); } catch { return String(v); }
    }
    return String(v);
}

function compareValues(a: any, b: any): number {
    if (a == null && b == null) { return 0; }
    if (a == null) { return 1; }
    if (b == null) { return -1; }
    const an = parseFloat(String(a));
    const bn = parseFloat(String(b));
    if (!isNaN(an) && !isNaN(bn) && String(a).trim() !== '' && String(b).trim() !== '') {
        return an - bn;
    }
    return String(a).localeCompare(String(b));
}

export function BqTable({ jobRef, token, schema, totalRows, initialRows }: Props) {
    const columns = useMemo<FlatColumn[]>(() => flattenSchema(schema), [schema]);
    const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
    const [pageIndex, setPageIndex] = useState<number>(0);
    const [rows, setRows] = useState<Array<{ f: Array<{ v: any }> }>>(initialRows);
    const [loading, setLoading] = useState<boolean>(false);
    const [err, setErr] = useState<string | null>(null);
    const [sort, setSort] = useState<SortState>(null);

    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

    useEffect(() => {
        let cancelled = false;
        if (pageIndex === 0 && pageSize === DEFAULT_PAGE_SIZE && rows === initialRows) {
            return () => { cancelled = true; };
        }
        setLoading(true);
        setErr(null);
        fetchPage(jobRef, token, pageIndex * pageSize, pageSize)
            .then(res => {
                if (cancelled) { return; }
                setRows(res.rows || []);
                setLoading(false);
            })
            .catch(e => {
                if (cancelled) { return; }
                setErr(e instanceof Error ? e.message : String(e));
                setLoading(false);
            });
        return () => { cancelled = true; };
    }, [jobRef.projectId, jobRef.jobId, jobRef.location, token, pageIndex, pageSize]);

    const extracted = useMemo(
        () => rows.map(r => {
            const obj: Record<string, any> = {};
            for (const c of columns) {
                obj[c.key] = extractRowValue(r, schema, c.path);
            }
            return obj;
        }),
        [rows, columns, schema]
    );

    const sortedIndices = useMemo(() => {
        const idx = extracted.map((_, i) => i);
        if (!sort) { return idx; }
        const key = sort.colKey;
        const dir = sort.dir;
        idx.sort((a, b) => compareValues(extracted[a][key], extracted[b][key]) * dir);
        return idx;
    }, [extracted, sort]);

    function onHeaderClick(col: FlatColumn) {
        setSort(s => {
            if (!s || s.colKey !== col.key) { return { colKey: col.key, dir: 1 }; }
            if (s.dir === 1) { return { colKey: col.key, dir: -1 }; }
            return null;
        });
    }

    const startRow = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
    const endRow = Math.min((pageIndex + 1) * pageSize, totalRows);

    return (
        <div class="bq-root">
            <div class="bq-controls">
                <button class="bq-pg-btn" disabled={pageIndex === 0 || loading} onClick={() => setPageIndex(0)} title="First page">&laquo;</button>
                <button class="bq-pg-btn" disabled={pageIndex === 0 || loading} onClick={() => setPageIndex(p => Math.max(0, p - 1))} title="Previous page">&lsaquo;</button>
                <span class="bq-pg-label">Page</span>
                <input
                    class="bq-pg-input"
                    type="number"
                    min={1}
                    max={totalPages}
                    value={pageIndex + 1}
                    onChange={(e: any) => {
                        const n = parseInt(e.currentTarget.value, 10);
                        if (!isNaN(n)) { setPageIndex(Math.max(0, Math.min(totalPages - 1, n - 1))); }
                    }}
                />
                <span class="bq-pg-of">of {totalPages.toLocaleString()}</span>
                <button class="bq-pg-btn" disabled={pageIndex >= totalPages - 1 || loading} onClick={() => setPageIndex(p => Math.min(totalPages - 1, p + 1))} title="Next page">&rsaquo;</button>
                <button class="bq-pg-btn" disabled={pageIndex >= totalPages - 1 || loading} onClick={() => setPageIndex(totalPages - 1)} title="Last page">&raquo;</button>
                <span class="bq-pg-info">{startRow.toLocaleString()}-{endRow.toLocaleString()} of {totalRows.toLocaleString()} rows</span>
                <select
                    class="bq-pg-size"
                    value={pageSize}
                    onChange={(e: any) => { setPageSize(parseInt(e.currentTarget.value, 10)); setPageIndex(0); }}
                >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={250}>250</option>
                    <option value={1000}>1000</option>
                </select>
                <div class="bq-export">
                    <button class="bq-pg-btn" onClick={() => postExport('download_csv', jobRef)} title="Download CSV">CSV</button>
                    <button class="bq-pg-btn" onClick={() => postExport('download_jsonl', jobRef)} title="Download JSONL">JSONL</button>
                    <button class="bq-pg-btn" onClick={() => postExport('send_pubsub', jobRef)} title="Send to Pub/Sub">Pub/Sub</button>
                    <button class="bq-pg-btn" onClick={() => postExport('copy_to_clipboard', jobRef)} title="Copy as Markdown">Copy</button>
                </div>
            </div>
            {loading && <div class="bq-notice">Loading rows&hellip;</div>}
            {err && <div class="bq-error">{err}</div>}
            <div class="bq-scroll">
                <table class="bq-grid">
                    <thead>
                        <tr>
                            <th class="bq-rownum" title="Row">#</th>
                            {columns.map(col => {
                                const active = sort?.colKey === col.key;
                                const arrow = active ? <span class="bq-sort">{sort!.dir === 1 ? '▲' : '▼'}</span> : null;
                                return (
                                    <th onClick={() => onHeaderClick(col)} title={`${col.label} · ${col.type}${col.mode !== 'NULLABLE' ? ' · ' + col.mode : ''}`}>
                                        {col.label}
                                        <span class="bq-col-type">{col.mode === 'REPEATED' ? col.type + '[]' : col.type}</span>
                                        {arrow}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {sortedIndices.map((i, displayIdx) => (
                            <tr>
                                <td class="bq-rownum">{startRow + displayIdx}</td>
                                {columns.map(col => {
                                    const v = extracted[i][col.key];
                                    const { html, isNull } = renderCellValue(v, col);
                                    const classes = [
                                        isNull ? 'bq-null' : '',
                                        isNumericType(col.type) ? 'bq-numeric' : 'bq-cell-max',
                                    ].filter(Boolean).join(' ');
                                    return (
                                        <td
                                            class={classes}
                                            title={isNull ? 'NULL' : valueToCopyText(v, col)}
                                            onClick={() => copyText(valueToCopyText(v, col))}
                                            dangerouslySetInnerHTML={{ __html: isNull ? 'NULL' : html }}
                                        />
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

declare const acquireVsCodeApi: () => { postMessage(msg: any): void };
let vscodeApi: { postMessage(msg: any): void } | null = null;
function vs() {
    if (!vscodeApi) { vscodeApi = (window as any).__bqVscode || acquireVsCodeApi(); (window as any).__bqVscode = vscodeApi; }
    return vscodeApi!;
}
function postExport(command: string, jobRef: JobReference) {
    vs().postMessage({
        command,
        job_reference: { projectId: jobRef.projectId, jobId: jobRef.jobId, location: jobRef.location },
    });
}
