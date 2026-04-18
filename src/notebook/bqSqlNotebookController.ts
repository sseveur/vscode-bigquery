import * as vscode from 'vscode';
import { BigQueryClient } from '../services/bigqueryClient';
import { Authentication } from '../services/authentication';
import { QueryHistoryService } from '../services/queryHistoryService';
import { NOTEBOOK_TYPE, CELL_LANGUAGE } from './bqSqlNotebookSerializer';

const CONTROLLER_ID = 'bigquery-sql-controller';
const CONTROLLER_LABEL = 'BigQuery';
const MAX_PREVIEW_ROWS = 1000;

/**
 * Executes BigQuery SQL notebook cells and renders results inline.
 */
export class BqSqlNotebookController implements vscode.Disposable {
    private readonly controller: vscode.NotebookController;
    private executionOrder = 0;
    private readonly historyService?: QueryHistoryService;

    constructor(historyService?: QueryHistoryService) {
        this.historyService = historyService;
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

        try {
            const projectId = await Authentication.getDefaultProjectId();
            const bqClient = new BigQueryClient(projectId);
            const job = await bqClient.runQuery(queryText);

            const [rows] = await job.getQueryResults({ maxResults: MAX_PREVIEW_ROWS });
            const [metadata] = await job.getMetadata();
            const schema = metadata?.configuration?.query?.destinationTable
                ? metadata?.statistics?.query?.schema
                : metadata?.statistics?.query?.schema;
            const schemaFields = schema?.fields || this.inferFields(rows);

            const bytesProcessed = parseInt(metadata?.statistics?.totalBytesProcessed ?? '0', 10);
            const durationMs = Date.now() - startTime;
            const totalRows = parseInt(metadata?.statistics?.query?.outputRowCount ?? String(rows.length), 10);

            const html = this.renderResultsHtml(rows, schemaFields, {
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
            await execution.replaceOutput(
                new vscode.NotebookCellOutput([
                    vscode.NotebookCellOutputItem.error({
                        name: err?.name || 'BigQueryError',
                        message: err?.message || String(err),
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
                    errorMessage: err?.message || String(err)
                });
            }

            execution.end(false, Date.now());
        }
    }

    private inferFields(rows: any[]): Array<{ name: string }> {
        if (!rows || rows.length === 0) {
            return [];
        }
        return Object.keys(rows[0]).map(name => ({ name }));
    }

    private renderResultsHtml(
        rows: any[],
        fields: Array<{ name: string; type?: string }>,
        stats: { bytesProcessed: number; durationMs: number; totalRows: number; previewedRows: number }
    ): string {
        const truncated = stats.totalRows > stats.previewedRows;
        const header = fields.map(f => `<th title="${escapeHtml(f.type || '')}">${escapeHtml(f.name)}</th>`).join('');

        const body = rows.map(row => {
            const cells = fields.map(f => {
                const value = row[f.name];
                return `<td>${formatCell(value)}</td>`;
            }).join('');
            return `<tr>${cells}</tr>`;
        }).join('');

        const statsLine = [
            `${stats.totalRows.toLocaleString()} row${stats.totalRows === 1 ? '' : 's'}`,
            `${formatBytes(stats.bytesProcessed)} processed`,
            `${stats.durationMs} ms`
        ].join(' \u00b7 ');

        const truncationNotice = truncated
            ? `<div class="bq-notice">Showing first ${stats.previewedRows.toLocaleString()} of ${stats.totalRows.toLocaleString()} rows.</div>`
            : '';

        if (rows.length === 0) {
            return `<div class="bq-stats">${escapeHtml(statsLine)}</div><div class="bq-empty">No rows returned.</div>${baseStyles()}`;
        }

        return `
${baseStyles()}
<div class="bq-stats">${escapeHtml(statsLine)}</div>
${truncationNotice}
<div class="bq-scroll">
    <table class="bq-grid">
        <thead><tr>${header}</tr></thead>
        <tbody>${body}</tbody>
    </table>
</div>
`;
    }
}

function escapeHtml(input: string): string {
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatCell(value: any): string {
    if (value === null || value === undefined) {
        return '<span class="bq-null">NULL</span>';
    }
    if (typeof value === 'object') {
        if (value instanceof Date) {
            return escapeHtml(value.toISOString());
        }
        if (value.value !== undefined) {
            return escapeHtml(String(value.value));
        }
        return escapeHtml(JSON.stringify(value));
    }
    return escapeHtml(String(value));
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
.bq-stats { font-size: 0.85em; opacity: 0.75; margin-bottom: 6px; }
.bq-notice { font-size: 0.85em; opacity: 0.7; margin-bottom: 6px; font-style: italic; }
.bq-empty { font-size: 0.9em; opacity: 0.7; padding: 8px; border: 1px dashed currentColor; border-radius: 4px; }
.bq-scroll { max-height: 420px; overflow: auto; border: 1px solid var(--vscode-panel-border, #3e3e3e); border-radius: 4px; }
.bq-grid { border-collapse: collapse; width: 100%; font-family: var(--vscode-editor-font-family, monospace); font-size: 0.9em; }
.bq-grid th, .bq-grid td { padding: 4px 8px; text-align: left; border-bottom: 1px solid var(--vscode-panel-border, #3e3e3e); white-space: nowrap; }
.bq-grid th { position: sticky; top: 0; background: var(--vscode-editor-background, #1e1e1e); font-weight: 600; z-index: 1; }
.bq-grid tbody tr:hover { background: var(--vscode-list-hoverBackground, #2a2d2e); }
.bq-null { opacity: 0.5; font-style: italic; }
</style>`;
}
