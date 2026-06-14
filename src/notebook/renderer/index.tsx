import { render } from 'preact';
import { BqTable, type PageFetcher } from '../../tableResultsPanel/grid/BqTable';
import type { BqField, DmlStats, ExportRef, JobReference } from '../../tableResultsPanel/grid/types';
// Bundled as a raw string by webpack (asset/source). Shared stylesheet with the webview grid so
// the notebook cell renders identically to the results panel.
// @ts-ignore - no module typings; webpack provides the file contents as a string.
import gridCssText from '../../../resources/grid-v2.css';

/**
 * MIME type the notebook controller tags its result output with. Keep in sync with
 * `GRID_MIME` in bqSqlNotebookController.ts and the `notebookRenderer` contribution
 * in package.json.
 */
export const GRID_MIME = 'application/vnd.bigquery.grid+json';

/** Payload the controller emits per executed cell (see bqSqlNotebookController.executeCell). */
interface CellPayload {
    rows: Array<{ f: Array<{ v: any }> }>;   // raw BigQuery wire format
    fields: BqField[];
    totalRows: number;       // real total row count of the result (may exceed loaded)
    previewedRows: number;   // rows actually loaded into this output
    bytesProcessed: number;
    durationMs: number;
    dmlStats?: DmlStats;
    statementType?: string;
    jobReference?: JobReference;
    colors?: Record<string, string>;   // sanitized { --bq-color-*: value } overrides
}

/** Minimal shape of the VS Code notebook renderer OutputItem (avoids a types dependency). */
interface OutputItem {
    id: string;
    mime: string;
    json(): any;
    text(): string;
}

/** Minimal shape of the renderer RendererContext when messaging is enabled. */
interface RendererContext {
    postMessage?(message: unknown): void;
    onDidReceiveMessage?(listener: (e: any) => void): { dispose(): void };
}

let stylesInjected = false;
function injectStyles(): void {
    if (stylesInjected || document.getElementById('bq-grid-v2-styles')) {
        stylesInjected = true;
        return;
    }
    // The stylesheet was written for the results-panel webview, where the grid owns the whole
    // document: it paints `body` with the editor background and sizes `.bq-root` to 100vh.
    // Injected into the shared notebook output document that blacks out the entire cell and
    // stretches it to the viewport height. Drop the global `body` rule and bound the grid to a
    // scrollable fixed height within the cell instead.
    const scoped = (gridCssText as unknown as string)
        .replace(/(^|\n)[ \t]*body[ \t]*\{[^}]*\}/g, '$1')
        + '\n.bq-nb-grid .bq-root { height: 460px; }\n';
    const style = document.createElement('style');
    style.id = 'bq-grid-v2-styles';
    style.textContent = scoped;
    document.head.appendChild(style);
    stylesInjected = true;
}

function formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) { return '0 B'; }
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const value = bytes / Math.pow(1024, i);
    return `${i === 0 ? value : value.toFixed(2)} ${units[i]}`;
}

/** Asks the extension host for a page beyond the loaded window (load-more). */
type PageRequester = (job: JobReference, startIndex: number, pageSize: number) => Promise<Array<{ f: Array<{ v: any }> }>>;

function NotebookGrid({ payload, requestPage }: { payload: CellPayload; requestPage: PageRequester | null }) {
    const allRows = payload.rows || [];
    const loaded = allRows.length;
    const realTotal = payload.totalRows || loaded;
    // Only advertise more pages than are loaded when we can actually fetch them (messaging up +
    // we have a job to page against). Otherwise cap the grid to the loaded window so it never
    // offers a page it can't fill.
    const canFetchMore = !!requestPage && !!payload.jobReference && realTotal > loaded;
    const gridTotal = canFetchMore ? realTotal : loaded;

    const fetchRows: PageFetcher = (start, size) => {
        // Serve from the in-memory window when the page is fully covered (no round-trip).
        if (start + size <= loaded || !canFetchMore || !payload.jobReference) {
            return Promise.resolve({ rows: allRows.slice(start, start + size), totalRows: String(gridTotal) });
        }
        return requestPage!(payload.jobReference, start, size)
            .then(rows => ({ rows, totalRows: String(gridTotal) }));
    };

    const exportRef: ExportRef = payload.jobReference ? { jobReference: payload.jobReference } : {};
    const truncated = realTotal > loaded && !canFetchMore;
    // Per-type cell colors from the vscode-bigquery.gridColors setting, scoped to this grid. Applied
    // via setProperty (not a style string) so CSS custom properties are set reliably.
    const applyColors = (node: HTMLElement | null) => {
        if (!node || !payload.colors) { return; }
        for (const [k, v] of Object.entries(payload.colors)) { node.style.setProperty(k, v); }
    };

    return (
        <div class="bq-nb-grid" ref={applyColors}>
            <div class="bq-nb-stats" style="opacity:.7;font-size:11px;margin:4px 2px;font-family:var(--vscode-editor-font-family,monospace);">
                {realTotal.toLocaleString()} rows
                {' · '}{formatBytes(payload.bytesProcessed)} processed
                {' · '}{payload.durationMs.toLocaleString()} ms
                {truncated ? ` · showing first ${loaded.toLocaleString()} of ${realTotal.toLocaleString()}` : ''}
            </div>
            <BqTable
                fetchRows={fetchRows}
                exportRef={exportRef}
                schema={payload.fields || []}
                totalRows={gridTotal}
                initialRows={allRows}
                dmlStats={payload.dmlStats}
                statementType={payload.statementType}
            />
        </div>
    );
}

export function activate(context: RendererContext) {
    const canMessage = !!(context && typeof context.postMessage === 'function');
    const pending = new Map<string, { resolve: (rows: any[]) => void; reject: (e: Error) => void }>();
    let reqSeq = 0;

    if (canMessage && context.onDidReceiveMessage) {
        context.onDidReceiveMessage((msg: any) => {
            if (!msg || msg.type !== 'bq-page' || !msg.requestId) { return; }
            const p = pending.get(msg.requestId);
            if (!p) { return; }
            pending.delete(msg.requestId);
            if (msg.error) { p.reject(new Error(String(msg.error))); }
            else { p.resolve(msg.rows || []); }
        });
    }

    const requestPage: PageRequester | null = canMessage
        ? (job, startIndex, pageSize) => new Promise((resolve, reject) => {
            const requestId = `bq-${++reqSeq}`;
            pending.set(requestId, { resolve, reject });
            context.postMessage!({ type: 'bq-fetch-page', requestId, job, startIndex, pageSize });
            setTimeout(() => {
                if (pending.has(requestId)) {
                    pending.delete(requestId);
                    reject(new Error('Timed out fetching more rows.'));
                }
            }, 30000);
        })
        : null;

    return {
        renderOutputItem(outputItem: OutputItem, element: HTMLElement) {
            injectStyles();
            let payload: CellPayload;
            try {
                payload = outputItem.json() as CellPayload;
            } catch (e) {
                element.textContent = `Failed to parse results: ${String(e)}`;
                return;
            }
            render(<NotebookGrid payload={payload} requestPage={requestPage} />, element);
        },
        disposeOutputItem(_id?: string) {
            // Preact reconciles on the next renderOutputItem call; VS Code discards the element
            // on dispose, so there is nothing to tear down explicitly.
        },
    };
}
