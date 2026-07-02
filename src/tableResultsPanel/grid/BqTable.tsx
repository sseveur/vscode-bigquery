import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { BqField, DmlStats, ExportRef, QueryResultsResponse } from './types';
import { flattenSchema, extractRowValue, renderCellValue, type FlatColumn } from './cellFormatters';
import { DEFAULT_PAGE_SIZE } from './pagination';
import { ChartPane } from './ChartPane';

export type PageFetcher = (startIndex: number, pageSize: number) => Promise<QueryResultsResponse>;

interface Props {
    fetchRows: PageFetcher;
    exportRef: ExportRef;
    schema: BqField[];
    totalRows: number;
    initialRows: Array<{ f: Array<{ v: any }> }>;
    title?: string;
    dmlStats?: DmlStats;
    statementType?: string;
    /** Handler for the export buttons (CSV/JSONL/Pub/Sub/Copy-all). Defaults to posting through
     *  the webview API (results panel). Notebook hosts pass their own handler that routes over
     *  renderer messaging instead — acquireVsCodeApi doesn't exist there. Pass null to hide the
     *  buttons (no export channel available). Clipboard selection copy is unaffected. */
    onExport?: ((command: string, ref: ExportRef) => void) | null;
}

type SortItem = { colKey: string; dir: 1 | -1 };
type Density = 'compact' | 'cozy' | 'comfy';
type Tab = 'results' | 'schema' | 'chart';

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

function valueToCopyText(v: any, _col: FlatColumn): string {
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

function highlightMatch(text: string, needle: string): string {
    if (!needle) { return escapeHtml(text); }
    const safe = escapeHtml(text);
    const safeNeedle = escapeHtml(needle);
    const re = new RegExp(safeNeedle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    return safe.replace(re, m => `<mark class="bq-mark">${m}</mark>`);
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function prettyPrint(v: any): string {
    if (v === null || v === undefined) { return 'NULL'; }
    if (typeof v === 'object') {
        try { return JSON.stringify(v, null, 2); } catch { return String(v); }
    }
    if (typeof v === 'string') {
        const parsed = tryParseJson(v);
        if (parsed !== undefined) {
            try { return JSON.stringify(parsed, null, 2); } catch { return v; }
        }
    }
    return String(v);
}

function tryParseJson(s: string): any {
    if (typeof s !== 'string') { return undefined; }
    const trimmed = s.trim();
    if (!trimmed) { return undefined; }
    const first = trimmed[0];
    if (first !== '{' && first !== '[') { return undefined; }
    try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object') { return parsed; }
    } catch { /* ignore */ }
    return undefined;
}

export function BqTable({ fetchRows, exportRef, schema, totalRows, initialRows, title, dmlStats, statementType, onExport = postExport }: Props) {
    const columns = useMemo<FlatColumn[]>(() => flattenSchema(schema), [schema]);
    const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
    const [pageIndex, setPageIndex] = useState<number>(0);
    const [rows, setRows] = useState<Array<{ f: Array<{ v: any }> }>>(initialRows);
    const [loading, setLoading] = useState<boolean>(false);
    const [err, setErr] = useState<string | null>(null);
    const [sorts, setSorts] = useState<SortItem[]>([]);
    const [density, setDensity] = useState<Density>('cozy');
    const [find, setFind] = useState<string>('');
    const [tab, setTab] = useState<Tab>('results');
    const [drawer, setDrawer] = useState<{ col: FlatColumn; value: any } | null>(null);
    const [colWidths, setColWidths] = useState<Record<string, number>>({});
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [lastClickedIdx, setLastClickedIdx] = useState<number | null>(null);
    const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; rowIdx: number; col?: FlatColumn } | null>(null);

    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

    useEffect(() => {
        let cancelled = false;
        if (pageIndex === 0 && pageSize === DEFAULT_PAGE_SIZE && rows === initialRows) {
            return () => { cancelled = true; };
        }
        setLoading(true);
        setErr(null);
        fetchRows(pageIndex * pageSize, pageSize)
            .then(res => {
                if (cancelled) { return; }
                setRows(res.rows || []);
                setSelected(new Set());
                setLoading(false);
            })
            .catch(e => {
                if (cancelled) { return; }
                setErr(e instanceof Error ? e.message : String(e));
                setLoading(false);
            });
        return () => { cancelled = true; };
    }, [fetchRows, pageIndex, pageSize]);

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

    const filteredIndices = useMemo(() => {
        const base = extracted.map((_, i) => i);
        if (!find.trim()) { return base; }
        const needle = find.toLowerCase();
        return base.filter(i => {
            for (const c of columns) {
                const v = extracted[i][c.key];
                if (v === null || v === undefined) { continue; }
                const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
                if (s.toLowerCase().includes(needle)) { return true; }
            }
            return false;
        });
    }, [extracted, columns, find]);

    const sortedIndices = useMemo(() => {
        if (sorts.length === 0) { return filteredIndices; }
        const idx = filteredIndices.slice();
        idx.sort((a, b) => {
            for (const s of sorts) {
                const c = compareValues(extracted[a][s.colKey], extracted[b][s.colKey]) * s.dir;
                if (c !== 0) { return c; }
            }
            return 0;
        });
        return idx;
    }, [extracted, filteredIndices, sorts]);

    function onHeaderClick(col: FlatColumn, e: MouseEvent) {
        const additive = e.shiftKey;
        setSorts(prev => {
            const existing = prev.find(s => s.colKey === col.key);
            if (additive) {
                if (!existing) { return [...prev, { colKey: col.key, dir: 1 }]; }
                if (existing.dir === 1) { return prev.map(s => s.colKey === col.key ? { ...s, dir: -1 as -1 } : s); }
                return prev.filter(s => s.colKey !== col.key);
            }
            if (!existing) { return [{ colKey: col.key, dir: 1 }]; }
            if (prev.length > 1 || existing.dir === -1) { return [{ colKey: col.key, dir: 1 }]; }
            return [{ colKey: col.key, dir: -1 }];
        });
    }

    function sortInfo(col: FlatColumn): { rank: number; dir: 1 | -1 } | null {
        const i = sorts.findIndex(s => s.colKey === col.key);
        if (i < 0) { return null; }
        return { rank: i + 1, dir: sorts[i].dir };
    }

    function onRowClick(rowIdx: number, e: MouseEvent) {
        if ((e.target as HTMLElement).closest('td.bq-rownum') === null) { return; }
        e.preventDefault();
        setSelected(prev => {
            const next = new Set(prev);
            if (e.shiftKey && lastClickedIdx !== null) {
                const order = sortedIndices;
                const a = order.indexOf(lastClickedIdx);
                const b = order.indexOf(rowIdx);
                if (a >= 0 && b >= 0) {
                    const [lo, hi] = a < b ? [a, b] : [b, a];
                    for (let k = lo; k <= hi; k++) { next.add(order[k]); }
                }
            } else if (e.metaKey || e.ctrlKey) {
                if (next.has(rowIdx)) { next.delete(rowIdx); } else { next.add(rowIdx); }
            } else {
                next.clear();
                next.add(rowIdx);
            }
            return next;
        });
        setLastClickedIdx(rowIdx);
    }

    function formatRows(indices: number[], format: 'tsv' | 'md' | 'json'): string {
        const header = columns.map(c => c.label);
        if (format === 'json') {
            const objs = indices.map(i => {
                const obj: Record<string, any> = {};
                for (const c of columns) { obj[c.label] = extracted[i][c.key]; }
                return obj;
            });
            return JSON.stringify(objs.length === 1 ? objs[0] : objs, null, 2);
        }
        const body = indices.map(i => columns.map(c => valueToCopyText(extracted[i][c.key], c)));
        if (format === 'tsv') {
            return [header.join('\t'), ...body.map(r => r.join('\t'))].join('\n');
        }
        const sep = '| ' + header.map(() => '---').join(' | ') + ' |';
        return [
            '| ' + header.join(' | ') + ' |',
            sep,
            ...body.map(r => '| ' + r.map(c => c.replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ') + ' |'),
        ].join('\n');
    }

    function copySelected(format: 'tsv' | 'md' | 'json') {
        const indices = sortedIndices.filter(i => selected.has(i));
        if (indices.length === 0) { showToast('No rows selected'); return; }
        copyText(formatRows(indices, format));
    }

    function copyRow(rowIdx: number, format: 'tsv' | 'md' | 'json') {
        copyText(formatRows([rowIdx], format));
    }

    function onRowContextMenu(rowIdx: number, col: FlatColumn | undefined, e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        if (!selected.has(rowIdx)) {
            setSelected(new Set([rowIdx]));
            setLastClickedIdx(rowIdx);
        }
        setCtxMenu({ x: e.clientX, y: e.clientY, rowIdx, col });
    }

    useEffect(() => {
        if (!ctxMenu) { return; }
        function close() { setCtxMenu(null); }
        window.addEventListener('click', close);
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        window.addEventListener('keydown', close);
        return () => {
            window.removeEventListener('click', close);
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
            window.removeEventListener('keydown', close);
        };
    }, [ctxMenu]);

    const startRow = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
    const endRow = Math.min((pageIndex + 1) * pageSize, totalRows);

    const densityVars: Record<Density, { padY: string; font: string }> = {
        compact: { padY: '2px', font: '0.82em' },
        cozy: { padY: '5px', font: '0.88em' },
        comfy: { padY: '9px', font: '0.92em' },
    };
    const cssVars = {
        ['--bq-cell-pad-y' as any]: densityVars[density].padY,
        ['--bq-cell-font' as any]: densityVars[density].font,
    };

    const dmlParts: string[] = [];
    if (dmlStats?.insertedRowCount && dmlStats.insertedRowCount !== '0') { dmlParts.push(`${Number(dmlStats.insertedRowCount).toLocaleString()} inserted`); }
    if (dmlStats?.updatedRowCount && dmlStats.updatedRowCount !== '0') { dmlParts.push(`${Number(dmlStats.updatedRowCount).toLocaleString()} updated`); }
    if (dmlStats?.deletedRowCount && dmlStats.deletedRowCount !== '0') { dmlParts.push(`${Number(dmlStats.deletedRowCount).toLocaleString()} deleted`); }
    const showDml = dmlParts.length > 0 || (statementType && ['INSERT', 'UPDATE', 'DELETE', 'MERGE'].includes(statementType));

    // A DML result with no rows to page through IS the banner — an empty table with a schema
    // header, pagination and find box under it reads as "results missing" rather than "N rows
    // affected". Render just the summary.
    if (showDml && totalRows === 0) {
        return (
            <div class="bq-root bq-root-dml-only" style={cssVars}>
                {title && <div class="bq-title">{title}</div>}
                <div class="bq-dml-summary">
                    <span class="bq-dml-type">{statementType || 'DML'}</span>
                    <span class="bq-dml-counts">{dmlParts.length ? dmlParts.join(' · ') : '0 rows affected'}</span>
                </div>
            </div>
        );
    }

    return (
        <div class="bq-root" style={cssVars}>
            {title && <div class="bq-title">{title}</div>}
            {showDml && (
                <div class="bq-dml-summary">
                    <span class="bq-dml-type">{statementType || 'DML'}</span>
                    <span class="bq-dml-counts">{dmlParts.length ? dmlParts.join(' · ') : '0 rows affected'}</span>
                </div>
            )}
            <div class="bq-controls">
                <div class="bq-tabs">
                    <button class={`bq-tab ${tab === 'results' ? 'active' : ''}`} onClick={() => setTab('results')}>Results</button>
                    <button class={`bq-tab ${tab === 'schema' ? 'active' : ''}`} onClick={() => setTab('schema')}>Schema <span class="bq-count">{columns.length}</span></button>
                    <button class={`bq-tab ${tab === 'chart' ? 'active' : ''}`} onClick={() => setTab('chart')}>Chart</button>
                </div>
                {tab === 'results' && <>
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
                    <span class="bq-pg-info">{startRow.toLocaleString()}-{endRow.toLocaleString()} / {totalRows.toLocaleString()}</span>
                    <select
                        class="bq-pg-size"
                        value={pageSize}
                        onChange={(e: any) => { setPageSize(parseInt(e.currentTarget.value, 10)); setPageIndex(0); }}
                        title="Rows per page"
                    >
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={250}>250</option>
                        <option value={1000}>1000</option>
                    </select>
                    <div class="bq-find">
                        <input
                            class="bq-find-input"
                            type="search"
                            placeholder="Find…"
                            value={find}
                            onInput={(e: any) => setFind(e.currentTarget.value)}
                            title="Filter current page"
                        />
                        {find && <span class="bq-find-count">{filteredIndices.length}</span>}
                    </div>
                    <div class="bq-density" title="Row density">
                        {(['compact', 'cozy', 'comfy'] as Density[]).map(d => (
                            <button class={`bq-density-btn ${density === d ? 'active' : ''}`} onClick={() => setDensity(d)} title={d}>
                                {d === 'compact' ? '≡' : d === 'cozy' ? '☰' : '⋯'}
                            </button>
                        ))}
                    </div>
                    <div class="bq-export">
                        {selected.size > 0 && <>
                            <span class="bq-sel-count">{selected.size} sel</span>
                            <button class="bq-pg-btn" onClick={() => copySelected('tsv')} title="Copy selected rows as TSV">TSV</button>
                            <button class="bq-pg-btn" onClick={() => copySelected('md')} title="Copy selected rows as Markdown">MD</button>
                            <button class="bq-pg-btn" onClick={() => copySelected('json')} title="Copy selected rows as JSON">JSON</button>
                            <button class="bq-pg-btn" onClick={() => setSelected(new Set())} title="Clear selection">✕</button>
                        </>}
                        {onExport && <>
                            <button class="bq-pg-btn" onClick={() => onExport('download_csv', exportRef)} title="Download all as CSV">CSV</button>
                            <button class="bq-pg-btn" onClick={() => onExport('download_jsonl', exportRef)} title="Download all as JSONL">JSONL</button>
                            <button class="bq-pg-btn" onClick={() => onExport('send_pubsub', exportRef)} title="Send to Pub/Sub">Pub/Sub</button>
                            <button class="bq-pg-btn" onClick={() => onExport('copy_to_clipboard', exportRef)} title="Copy all as Markdown">Copy</button>
                        </>}
                    </div>
                </>}
            </div>
            {loading && <div class="bq-notice">Loading rows&hellip;</div>}
            {err && <div class="bq-error">{err}</div>}

            {tab === 'schema' ? (
                <SchemaPane columns={columns} />
            ) : tab === 'chart' ? (
                <ChartPane
                    schema={schema}
                    columns={columns}
                    totalRows={totalRows}
                    initialRows={rows}
                    fetchRows={fetchRows}
                />
            ) : (
                <div class={`bq-layout ${drawer ? 'with-drawer' : ''}`}>
                    <div class="bq-scroll">
                        <table class="bq-grid">
                            <thead>
                                <tr>
                                    <th class="bq-rownum" title="Row">#</th>
                                    {columns.map(col => {
                                        const info = sortInfo(col);
                                        const style = colWidths[col.key] ? { width: colWidths[col.key] + 'px', minWidth: colWidths[col.key] + 'px' } : undefined;
                                        return (
                                            <th
                                                style={style}
                                                onClick={(e: MouseEvent) => onHeaderClick(col, e)}
                                                title={`${col.label} · ${col.type}${col.mode !== 'NULLABLE' ? ' · ' + col.mode : ''} · Click to sort, Shift+click for multi-sort`}
                                            >
                                                <span class="bq-col-name">{col.label}</span>
                                                <span class="bq-col-type">{col.mode === 'REPEATED' ? col.type + '[]' : col.type}</span>
                                                {info && <span class="bq-sort">{info.dir === 1 ? '▲' : '▼'}{sorts.length > 1 ? <sub class="bq-sort-rank">{info.rank}</sub> : null}</span>}
                                                <ResizeHandle onResize={w => setColWidths(cw => ({ ...cw, [col.key]: w }))} />
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {sortedIndices.map((i, displayIdx) => (
                                    <tr class={selected.has(i) ? 'bq-selected' : ''} onClick={(e: MouseEvent) => onRowClick(i, e)} onContextMenu={(e: MouseEvent) => onRowContextMenu(i, undefined, e)}>
                                        <td class="bq-rownum" onContextMenu={(e: MouseEvent) => onRowContextMenu(i, undefined, e)}>{startRow + displayIdx}</td>
                                        {columns.map(col => {
                                            const v = extracted[i][col.key];
                                            const { html, isNull } = renderCellValue(v, col);
                                            const classes = [
                                                isNull ? 'bq-null' : '',
                                                isNumericType(col.type) ? 'bq-numeric' : 'bq-cell-max',
                                                `bq-t-${col.type.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
                                            ].filter(Boolean).join(' ');
                                            const display = isNull
                                                ? 'NULL'
                                                : (find ? highlightMatch(typeof v === 'object' ? JSON.stringify(v) : String(v), find) : html);
                                            const canExpand = (typeof v === 'object' && v !== null) || (typeof v === 'string' && tryParseJson(v) !== undefined);
                                            return (
                                                <td
                                                    class={classes}
                                                    title={isNull ? 'NULL' : valueToCopyText(v, col)}
                                                    onContextMenu={(e: MouseEvent) => onRowContextMenu(i, col, e)}
                                                    onClick={(e: MouseEvent) => {
                                                        e.stopPropagation();
                                                        if (canExpand) { setDrawer({ col, value: v }); return; }
                                                        copyText(valueToCopyText(v, col));
                                                    }}
                                                    dangerouslySetInnerHTML={{ __html: display }}
                                                />
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {drawer && <CellDrawer col={drawer.col} value={drawer.value} onClose={() => setDrawer(null)} />}
                </div>
            )}
            {ctxMenu && (() => {
                const selCount = selected.size;
                const multi = selCount > 1 && selected.has(ctxMenu.rowIdx);
                const label = multi ? `${selCount} rows` : `Row ${startRow + sortedIndices.indexOf(ctxMenu.rowIdx)}`;
                const doCopy = (fmt: 'tsv' | 'md' | 'json') => {
                    if (multi) { copySelected(fmt); } else { copyRow(ctxMenu.rowIdx, fmt); }
                    setCtxMenu(null);
                };
                return (
                    <div
                        class="bq-ctx-menu"
                        style={{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }}
                        onClick={(e: MouseEvent) => e.stopPropagation()}
                        onContextMenu={(e: MouseEvent) => e.preventDefault()}
                    >
                        <div class="bq-ctx-head">{label}</div>
                        <button class="bq-ctx-item" onClick={() => doCopy('tsv')}>Copy {multi ? 'rows' : 'row'} (TSV)</button>
                        <button class="bq-ctx-item" onClick={() => doCopy('md')}>Copy {multi ? 'rows' : 'row'} (Markdown)</button>
                        <button class="bq-ctx-item" onClick={() => doCopy('json')}>Copy {multi ? 'rows' : 'row'} (JSON)</button>
                        {ctxMenu.col && <>
                            <div class="bq-ctx-sep" />
                            <button class="bq-ctx-item" onClick={() => { copyText(valueToCopyText(extracted[ctxMenu.rowIdx][ctxMenu.col!.key], ctxMenu.col!)); setCtxMenu(null); }}>Copy cell value</button>
                            <button class="bq-ctx-item" onClick={() => { copyText(ctxMenu.col!.label); setCtxMenu(null); }}>Copy column name</button>
                        </>}
                        {multi && <>
                            <div class="bq-ctx-sep" />
                            <button class="bq-ctx-item" onClick={() => { setSelected(new Set()); setCtxMenu(null); }}>Clear selection</button>
                        </>}
                    </div>
                );
            })()}
        </div>
    );
}

function SchemaPane({ columns }: { columns: FlatColumn[] }) {
    return (
        <div class="bq-scroll">
            <table class="bq-grid bq-schema-grid">
                <thead>
                    <tr>
                        <th class="bq-rownum">#</th>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Mode</th>
                    </tr>
                </thead>
                <tbody>
                    {columns.map((c, i) => (
                        <tr>
                            <td class="bq-rownum">{i + 1}</td>
                            <td>{c.label}</td>
                            <td><span class="bq-col-type">{c.mode === 'REPEATED' ? c.type + '[]' : c.type}</span></td>
                            <td class="bq-muted">{c.mode}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function CellDrawer({ col, value, onClose }: { col: FlatColumn; value: any; onClose: () => void }) {
    const pretty = prettyPrint(value);
    return (
        <aside class="bq-drawer">
            <div class="bq-drawer-head">
                <div class="bq-drawer-title">
                    <span>{col.label}</span>
                    <span class="bq-col-type">{col.mode === 'REPEATED' ? col.type + '[]' : col.type}</span>
                </div>
                <div class="bq-drawer-actions">
                    <button class="bq-pg-btn" onClick={() => copyText(pretty)} title="Copy value">Copy</button>
                    <button class="bq-pg-btn" onClick={onClose} title="Close">✕</button>
                </div>
            </div>
            <pre class="bq-drawer-body">{pretty}</pre>
        </aside>
    );
}

function ResizeHandle({ onResize }: { onResize: (w: number) => void }) {
    const ref = useRef<HTMLSpanElement | null>(null);
    function onDown(e: MouseEvent) {
        e.stopPropagation();
        const th = (ref.current?.parentElement) as HTMLElement | null;
        if (!th) { return; }
        const startX = e.clientX;
        const startW = th.getBoundingClientRect().width;
        function move(ev: MouseEvent) {
            const w = Math.max(60, startW + (ev.clientX - startX));
            onResize(w);
        }
        function up() {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
        }
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
    }
    return <span ref={ref} class="bq-resize" onMouseDown={onDown} onClick={(e: MouseEvent) => e.stopPropagation()} />;
}

declare const acquireVsCodeApi: () => { postMessage(msg: any): void };
let vscodeApi: { postMessage(msg: any): void } | null = null;
function vs() {
    if (!vscodeApi) { vscodeApi = (window as any).__bqVscode || acquireVsCodeApi(); (window as any).__bqVscode = vscodeApi; }
    return vscodeApi!;
}
function postExport(command: string, ref: ExportRef) {
    const payload: any = { command };
    if (ref.jobReference) {
        payload.job_reference = {
            projectId: ref.jobReference.projectId,
            jobId: ref.jobReference.jobId,
            location: ref.jobReference.location,
        };
    }
    if (ref.tableReference) {
        payload.table_reference = {
            projectId: ref.tableReference.projectId,
            datasetId: ref.tableReference.datasetId,
            tableId: ref.tableReference.tableId,
        };
    }
    vs().postMessage(payload);
}
