import * as vscode from 'vscode';
import { BigQueryClient, selectFinalDmlChildJob, selectFinalResultChildJob } from '../services/bigqueryClient';
import { DownloadCsv } from '../tableResultsPanel/downloadCsv';
import { DownloadJsonl } from '../tableResultsPanel/downloadJsonl';
import { SendToPubsub } from '../tableResultsPanel/sendToPubsub';
import { CopyToClipboard } from '../tableResultsPanel/copyToClipboard';
import { Authentication } from '../services/authentication';
import { QueryHistoryService } from '../services/queryHistoryService';
import { NOTEBOOK_TYPE, CELL_LANGUAGE } from './bqSqlNotebookSerializer';
import { JobReference } from '../services/queryResultsMapping';
import { CellRegistry, CellExecutionState } from './bqSqlNotebookCellRegistry';
import { hashQuery } from './bqSqlNotebookCellRegistry';
import { sanitizedGridColorVars } from '../tableResultsPanel/resultsGridRender';

const CONTROLLER_ID = 'bigquery-sql-controller';
const CONTROLLER_LABEL = 'BigQuery';
const INITIAL_PAGE_ROWS = 1000;
/** Must match the notebookRenderer id in package.json and the renderer bundle. */
const RENDERER_ID = 'bigquery-grid-renderer';

/** MIME type consumed by the notebook-renderer bundle (resources/notebook-renderer.js). Keep in
 *  sync with GRID_MIME in src/notebook/renderer/index.tsx and the package.json contribution. */
const GRID_MIME = 'application/vnd.bigquery.grid+json';

/**
 * Executes BigQuery SQL notebook cells and renders results inline.
 */
export class BqSqlNotebookController implements vscode.Disposable {
    private readonly controller: vscode.NotebookController;
    private executionOrder = 0;
    private readonly historyService?: QueryHistoryService;
    private readonly registry: CellRegistry;
    private readonly messaging: vscode.NotebookRendererMessaging;
    private readonly messagingListener: vscode.Disposable;
    /** Authenticated clients reused across load-more page fetches, keyed by project id. Avoids
     *  re-running `gcloud` + rebuilding auth on every page (the source of paging lag). */
    private readonly clientCache = new Map<string, BigQueryClient>();

    constructor(registry: CellRegistry, historyService?: QueryHistoryService) {
        this.historyService = historyService;
        this.registry = registry;
        this.controller = vscode.notebooks.createNotebookController(
            CONTROLLER_ID,
            NOTEBOOK_TYPE,
            CONTROLLER_LABEL
        );
        this.controller.supportedLanguages = [CELL_LANGUAGE, 'sql'];
        this.controller.supportsExecutionOrder = true;
        this.controller.executeHandler = this.execute.bind(this);

        // Load-more: the grid renderer requests pages beyond the initially loaded window; fetch the
        // page in wire format for its job and post it back to the requesting notebook.
        this.messaging = vscode.notebooks.createRendererMessaging(RENDERER_ID);
        this.messagingListener = this.messaging.onDidReceiveMessage(async (e) => {
            const m: any = e.message;
            if (!m || !m.job?.projectId) { return; }
            if (m.type === 'bq-fetch-page') {
                try {
                    // Use the project from the job reference (already known) and a cached client — no
                    // gcloud lookup or client rebuild per page, so paging matches the webview's latency.
                    const rows = await this.clientFor(m.job.projectId).getQueryPageWire(m.job, m.startIndex, m.pageSize);
                    await this.messaging.postMessage({ type: 'bq-page', requestId: m.requestId, rows }, e.editor);
                } catch (err: any) {
                    await this.messaging.postMessage(
                        { type: 'bq-page', requestId: m.requestId, error: extractBigQueryErrorMessage(err) },
                        e.editor
                    );
                }
                return;
            }
            if (m.type === 'bq-export') {
                // In-grid export buttons: run the same export helpers as the cell status bar —
                // dialogs/fs/Pub/Sub/clipboard live extension-side and show their own notifications.
                try {
                    const client = this.clientFor(m.job.projectId);
                    switch (m.command) {
                        case 'download_csv': await DownloadCsv.download(client, m.job); break;
                        case 'download_jsonl': await DownloadJsonl.download(client, m.job); break;
                        case 'send_pubsub': await SendToPubsub.sendJobResult(client, m.job); break;
                        case 'copy_to_clipboard': await CopyToClipboard.copy(client, m.job); break;
                    }
                } catch (err: any) {
                    vscode.window.showErrorMessage(`Export failed: ${extractBigQueryErrorMessage(err)}`);
                }
            }
        });
    }

    dispose(): void {
        this.controller.dispose();
        this.messagingListener.dispose();
    }

    /** Returns an authenticated client for the given project, building it once and reusing it. */
    private clientFor(projectId: string): BigQueryClient {
        let client = this.clientCache.get(projectId);
        if (!client) {
            client = new BigQueryClient(projectId);
            this.clientCache.set(projectId, client);
        }
        return client;
    }

    private async execute(
        cells: vscode.NotebookCell[],
        _notebook: vscode.NotebookDocument,
        controller: vscode.NotebookController
    ): Promise<void> {
        for (const cell of cells) {
            await this.executeCell(cell, controller);
        }
    }

    private async executeCell(
        cell: vscode.NotebookCell,
        controller: vscode.NotebookController
    ): Promise<void> {
        const execution = controller.createNotebookCellExecution(cell);
        execution.executionOrder = ++this.executionOrder;
        const startTime = Date.now();
        execution.start(startTime);

        const queryText = cell.document.getText().trim();
        if (!queryText) {
            execution.end(true, Date.now());
            return;
        }

        const cellKey = cell.document.uri.toString();
        let cancelledJob: any = null;

        // Wire cancel: when user clicks the cell cancel button, try to abort the job.
        execution.token.onCancellationRequested(async () => {
            if (cancelledJob) {
                try {
                    await cancelledJob.cancel();
                } catch {
                    // best-effort
                }
            }
        });

        try {
            const projectId = await Authentication.getDefaultProjectId();
            const bqClient = new BigQueryClient(projectId);
            // Warm the load-more cache with this already-authenticated client so the first page
            // fetch after the initial window has no auth/startup cost.
            this.clientCache.set(projectId, bqClient);
            const job = await bqClient.runQuery(queryText);
            cancelledJob = job;

            if (execution.token.isCancellationRequested) {
                await job.cancel().catch(() => { /* noop */ });
                throw new Error('Query cancelled.');
            }

            const [metadata] = await job.getMetadata();

            // Multi-statement scripts (DECLARE / CREATE TEMP TABLE / SELECT) surface as a
            // SCRIPT parent job that carries no result rows or schema of its own — the rows
            // live on the final SELECT child job. Calling getQueryResults() on the parent
            // returns nothing, so resolve the child that produced the visible result set and
            // render that instead. Mirrors the regular results-grid behaviour.
            let resultJob = job;
            let resultMetadata: any = metadata;
            if (metadata?.statistics?.query?.statementType === 'SCRIPT') {
                const parentRef: JobReference = {
                    projectId: (metadata?.jobReference?.projectId as string) || projectId || '',
                    jobId: metadata?.jobReference?.jobId as string,
                    location: metadata?.jobReference?.location as string
                };
                // Completion barrier on the parent: the child-job list is only complete once the
                // script is DONE (getQueryResults polls; returns no rows for a script parent).
                await job.getQueryResults({ maxResults: 0 }).catch(() => { /* children fetch below still tries */ });
                const children = await bqClient.getChildJobs(parentRef).catch(() => [] as any[]);
                // Prefer the child with a real result set; fall back to the last DML child so
                // affected-row counts still render. A script with neither (pure DECLARE/DDL)
                // gets a text summary instead of an empty, columnless grid (#8).
                const finalChild = selectFinalResultChildJob(children) ?? selectFinalDmlChildJob(children);
                if (finalChild) {
                    resultJob = finalChild;
                    resultMetadata = finalChild.metadata ?? (await finalChild.getMetadata())[0];
                } else {
                    await this.renderScriptSummary(execution, children, metadata, startTime);
                    if (this.historyService) {
                        await this.historyService.addEntry({
                            query: queryText,
                            timestamp: startTime,
                            bytesProcessed: parseInt(metadata?.statistics?.totalBytesProcessed ?? '0', 10),
                            durationMs: Date.now() - startTime,
                            projectId: projectId || 'unknown',
                            status: 'success'
                        });
                    }
                    execution.end(true, Date.now());
                    return;
                }
            }

            // runQuery only creates the job (no completion wait), so getQueryResults is still needed
            // as the barrier that polls until results are ready. Request 0 rows here — it serves
            // purely as the completion/schema check; the actual rows come from the single wire fetch
            // below, avoiding a duplicate transfer/hydration of the whole page.
            const queryResults = await resultJob.getQueryResults({ maxResults: 0 });
            const response: any = queryResults[2];

            // Rows + schema come from one raw wire-format response so they always agree — the SDK
            // strips wire rows, and for SCRIPT child jobs its response can also drop the schema,
            // which would render columnless rows (see fetchWireResults).
            const wire = await fetchWireResults(resultJob, INITIAL_PAGE_ROWS);
            const rawRows = wire.rows;

            const schemaFields: any[] =
                wire.fields
                || response?.schema?.fields
                || (resultMetadata?.statistics?.query?.schema as any)?.fields
                || [];

            const bytesProcessed = parseInt(metadata?.statistics?.totalBytesProcessed ?? '0', 10);
            const durationMs = Date.now() - startTime;
            // The /queries response's totalRows is the authoritative result count; outputRowCount is
            // often absent (it was here, which capped the grid at the loaded 1000). Fall back only if
            // both are missing.
            const totalRows = parseInt(
                wire.totalRows
                ?? resultMetadata?.statistics?.query?.outputRowCount
                ?? String(rawRows.length),
                10
            );

            const jobReference: JobReference = {
                projectId: (resultMetadata?.jobReference?.projectId as string) || projectId || '',
                jobId: resultMetadata?.jobReference?.jobId as string,
                location: resultMetadata?.jobReference?.location as string
            };

            const state: CellExecutionState = {
                notebookUri: cell.notebook.uri.toString(),
                cellUri: cellKey,
                queryHash: hashQuery(queryText),
                queryText,
                jobReference,
                fields: schemaFields,
                totalRows,
                bytesProcessed,
                durationMs
            };

            this.registry.set(cellKey, state);

            // Emit the wire-format rows + schema as a custom MIME so the notebook-renderer bundle
            // mounts the same Preact grid used by the results panel.
            const dmlStats = resultMetadata?.statistics?.query?.dmlStats;
            const statementType = resultMetadata?.statistics?.query?.statementType;

            await execution.replaceOutput(
                new vscode.NotebookCellOutput([
                    vscode.NotebookCellOutputItem.json({
                        rows: rawRows,
                        fields: schemaFields,
                        totalRows,
                        previewedRows: rawRows.length,
                        bytesProcessed,
                        durationMs,
                        dmlStats,
                        statementType,
                        jobReference,
                        colors: sanitizedGridColorVars()
                    }, GRID_MIME)
                ])
            );

            // Persist lightweight metadata (jobRef + schema + stats) for the export/load-more
            // flows to keep working on restored cells. Output HTML is intentionally NOT stored
            // to avoid multi-GB globalState bloat — cells render afresh on execute.
            await this.registry.persist(state);

            if (this.historyService) {
                await this.historyService.addEntry({
                    query: queryText,
                    timestamp: startTime,
                    bytesProcessed,
                    durationMs,
                    projectId: projectId || 'unknown',
                    status: 'success'
                });
            }

            execution.end(true, Date.now());
        } catch (err: any) {
            const errorMessage = extractBigQueryErrorMessage(err);
            await execution.replaceOutput(
                new vscode.NotebookCellOutput([
                    vscode.NotebookCellOutputItem.error({
                        name: err?.name || 'BigQueryError',
                        message: errorMessage,
                        stack: err?.stack
                    })
                ])
            );

            if (this.historyService) {
                await this.historyService.addEntry({
                    query: queryText,
                    timestamp: startTime,
                    bytesProcessed: 0,
                    durationMs: Date.now() - startTime,
                    projectId: 'unknown',
                    status: 'error',
                    errorMessage
                });
            }

            execution.end(false, Date.now());
        }
    }

    /**
     * Renders a plain-text summary for a SCRIPT whose children produced neither a result set nor
     * DML stats (pure DECLARE / SET / DDL) — statement count, types in execution order, bytes and
     * duration — instead of the empty, columnless grid the generic path would show (#8).
     */
    private async renderScriptSummary(
        execution: vscode.NotebookCellExecution,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        children: any[],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parentMetadata: any,
        startTime: number
    ): Promise<void> {
        // Child ids end in a numeric statement index — sort ascending for execution order.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const suffix = (j: any) => {
            const id: string = j?.id ?? '';
            return Number(id.substring(id.lastIndexOf('_') + 1)) || 0;
        };
        const types = children
            .slice()
            .sort((a, b) => suffix(a) - suffix(b))
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((c: any) => c?.metadata?.statistics?.query?.statementType)
            .filter((t): t is string => typeof t === 'string' && t.length > 0);

        const bytes = parseInt(parentMetadata?.statistics?.totalBytesProcessed ?? '0', 10);
        const durationMs = Date.now() - startTime;
        // Control-statement-only scripts (DECLARE/SET) spawn no child jobs at all — don't
        // report a misleading "0 statements" in that case.
        const count = children.length;
        const lines = [
            count > 0
                ? `Script completed — ${count} statement${count === 1 ? '' : 's'}, no result set.`
                : 'Script completed — no result set.',
            types.length > 0 ? `Statements: ${types.join(', ')}` : '',
            `${formatByteSize(bytes)} processed · ${durationMs.toLocaleString()} ms`,
        ].filter(l => l.length > 0);

        await execution.replaceOutput(
            new vscode.NotebookCellOutput([vscode.NotebookCellOutputItem.text(lines.join('\n'))])
        );
    }
}

function formatByteSize(bytes: number): string {
    if (!bytes || bytes <= 0) { return '0 B'; }
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const value = bytes / Math.pow(1024, i);
    return `${i === 0 ? value : value.toFixed(2)} ${units[i]}`;
}

/**
 * Fetches result rows in BigQuery REST wire format ({ f: [{ v }] }) together with the schema, by
 * calling the raw /queries/{jobId} endpoint directly. The SDK's job.getQueryResults() hydrates the
 * rows into plain objects and `delete`s resp.rows, so the wire form is unavailable from it; and for
 * SCRIPT child jobs its response can also omit the schema. Sourcing both rows and schema from this
 * single response keeps them consistent (a schema-less response would render columnless rows). We
 * deliberately omit `formatOptions.useInt64Timestamp` to mirror the webview grid's fetchPage, whose
 * default format the grid's cell formatters are written against.
 */
function fetchWireResults(
    job: any,
    maxResults: number
): Promise<{ rows: Array<{ f: Array<{ v: any }> }>; fields: any[] | undefined; totalRows: string | undefined }> {
    return new Promise((resolve, reject) => {
        try {
            job.bigQuery.request(
                { uri: '/queries/' + job.id, qs: { location: job.location, maxResults } },
                (err: any, resp: any) => {
                    if (err) { reject(err); return; }
                    resolve({
                        rows: (resp && resp.rows) || [],
                        fields: resp?.schema?.fields,
                        totalRows: resp?.totalRows,
                    });
                }
            );
        } catch (e) {
            reject(e);
        }
    });
}

/**
 * Extracts a human-readable message from a BigQuery error.
 * The @google-cloud/bigquery library throws errors whose top-level `message`
 * is often empty; the real detail lives in the `errors[]` array
 * (`{ message, reason, location }`). Falling back to String(err) yields the
 * useless "[object Object]", so dig into the known shapes first.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractBigQueryErrorMessage(err: any): string {
    if (!err) {
        return 'Unknown error';
    }
    if (typeof err === 'string') {
        return err;
    }

    const apiErrors = err.errors ?? err.response?.data?.error?.errors;
    if (Array.isArray(apiErrors) && apiErrors.length > 0) {
        const messages = apiErrors
            .map((e: any) => e?.message)
            .filter((m: any) => typeof m === 'string' && m.length > 0);
        if (messages.length > 0) {
            return messages.join('; ');
        }
    }

    const nested = err.response?.data?.error?.message;
    if (typeof nested === 'string' && nested.length > 0) {
        return nested;
    }

    if (typeof err.message === 'string' && err.message.length > 0) {
        return err.message;
    }

    try {
        const json = JSON.stringify(err);
        if (json && json !== '{}') {
            return json;
        }
    } catch {
        // fall through
    }

    return String(err);
}
