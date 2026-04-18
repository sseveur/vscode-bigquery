import * as vscode from 'vscode';
import { BigQueryClient } from '../services/bigqueryClient';
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

    /**
     * Restore a previously persisted HTML output on a cell without re-running
     * the query. Uses a synthetic execution so we can call replaceOutput.
     */
    public async restoreOutput(cell: vscode.NotebookCell, html: string): Promise<void> {
        const execution = this.controller.createNotebookCellExecution(cell);
        execution.start();
        await execution.replaceOutput(
            new vscode.NotebookCellOutput([
                vscode.NotebookCellOutputItem.text(html, 'text/html')
            ])
        );
        execution.end(true);
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

            const [rows] = await job.getQueryResults({ maxResults: INITIAL_PAGE_ROWS });
            const [metadata] = await job.getMetadata();
            const schema = metadata?.statistics?.query?.schema || metadata?.configuration?.query?.destinationTable;
            const schemaFields = (schema?.fields as any[]) || inferFields(rows);

            const bytesProcessed = parseInt(metadata?.statistics?.totalBytesProcessed ?? '0', 10);
            const durationMs = Date.now() - startTime;
            const totalRows = parseInt(metadata?.statistics?.query?.outputRowCount ?? String(rows.length), 10);

            const jobReference: JobReference = {
                projectId: (metadata?.jobReference?.projectId as string) || projectId || '',
                jobId: metadata?.jobReference?.jobId as string,
                location: metadata?.jobReference?.location as string
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

            // Persist the cell's output + registry entry for restoration on next open.
            await this.registry.persist(state, html);

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
            const errorMessage = err?.message || String(err);
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
