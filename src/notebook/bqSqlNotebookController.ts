import * as vscode from 'vscode';
import { BigQueryClient, selectFinalResultChildJob } from '../services/bigqueryClient';
import { Authentication } from '../services/authentication';
import { QueryHistoryService } from '../services/queryHistoryService';
import { NOTEBOOK_TYPE, CELL_LANGUAGE } from './bqSqlNotebookSerializer';
import { JobReference } from '../services/queryResultsMapping';
import { CellRegistry, CellExecutionState } from './bqSqlNotebookCellRegistry';
import { renderResultsHtml } from './bqSqlNotebookResultsHtml';
import { hashQuery } from './bqSqlNotebookCellRegistry';

const CONTROLLER_ID = 'bigquery-sql-controller';
const CONTROLLER_LABEL = 'BigQuery';
const INITIAL_PAGE_ROWS = 1000;

/**
 * Executes BigQuery SQL notebook cells and renders results inline.
 */
export class BqSqlNotebookController implements vscode.Disposable {
    private readonly controller: vscode.NotebookController;
    private executionOrder = 0;
    private readonly historyService?: QueryHistoryService;
    private readonly registry: CellRegistry;

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
    }

    dispose(): void {
        this.controller.dispose();
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
                const children = await bqClient.getChildJobs(parentRef).catch(() => [] as any[]);
                const finalChild = selectFinalResultChildJob(children);
                if (finalChild) {
                    resultJob = finalChild;
                    resultMetadata = finalChild.metadata ?? (await finalChild.getMetadata())[0];
                }
            }

            const queryResults = await resultJob.getQueryResults({ maxResults: INITIAL_PAGE_ROWS });
            const rows = queryResults[0];
            const response: any = queryResults[2];

            const schemaFields: any[] =
                response?.schema?.fields
                || (resultMetadata?.statistics?.query?.schema as any)?.fields
                || inferFields(rows);

            const bytesProcessed = parseInt(metadata?.statistics?.totalBytesProcessed ?? '0', 10);
            const durationMs = Date.now() - startTime;
            const totalRows = parseInt(resultMetadata?.statistics?.query?.outputRowCount ?? String(rows.length), 10);

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

            const html = renderResultsHtml(rows, schemaFields, {
                bytesProcessed,
                durationMs,
                totalRows,
                previewedRows: rows.length
            });

            await execution.replaceOutput(
                new vscode.NotebookCellOutput([
                    vscode.NotebookCellOutputItem.text(html, 'text/html')
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
}

function inferFields(rows: any[]): Array<{ name: string }> {
    if (!rows || rows.length === 0) {
        return [];
    }
    return Object.keys(rows[0]).map(name => ({ name }));
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
