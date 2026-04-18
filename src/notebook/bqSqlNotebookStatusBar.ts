import * as vscode from 'vscode';
import { NOTEBOOK_TYPE } from './bqSqlNotebookSerializer';
import { CellRegistry } from './bqSqlNotebookCellRegistry';

export const COMMAND_CELL_DOWNLOAD_CSV = 'vscode-bigquery.cell-download-csv';
export const COMMAND_CELL_DOWNLOAD_JSONL = 'vscode-bigquery.cell-download-jsonl';
export const COMMAND_CELL_SEND_PUBSUB = 'vscode-bigquery.cell-send-pubsub';
export const COMMAND_CELL_COPY_MARKDOWN = 'vscode-bigquery.cell-copy-markdown';

/**
 * Shows export buttons (CSV, JSONL, Pub/Sub, Copy) in the status bar below
 * each executed cell. Only appears on cells that have an executed job.
 */
export class BqSqlNotebookStatusBarProvider implements vscode.NotebookCellStatusBarItemProvider {
    constructor(private readonly registry: CellRegistry) { }

    provideCellStatusBarItems(
        cell: vscode.NotebookCell
    ): vscode.NotebookCellStatusBarItem[] {
        if (cell.notebook.notebookType !== NOTEBOOK_TYPE) {
            return [];
        }
        const state = this.registry.get(cell.document.uri.toString());
        if (!state || !state.jobReference?.jobId) {
            return [];
        }

        const args = [cell.document.uri.toString()];
        const items: vscode.NotebookCellStatusBarItem[] = [];

        const csv = new vscode.NotebookCellStatusBarItem('$(cloud-download) CSV', vscode.NotebookCellStatusBarAlignment.Right);
        csv.command = { command: COMMAND_CELL_DOWNLOAD_CSV, title: 'Download CSV', arguments: args };
        csv.tooltip = 'Download results as CSV';
        items.push(csv);

        const jsonl = new vscode.NotebookCellStatusBarItem('$(cloud-download) JSONL', vscode.NotebookCellStatusBarAlignment.Right);
        jsonl.command = { command: COMMAND_CELL_DOWNLOAD_JSONL, title: 'Download JSONL', arguments: args };
        jsonl.tooltip = 'Download results as JSONL';
        items.push(jsonl);

        const pubsub = new vscode.NotebookCellStatusBarItem('$(megaphone) Pub/Sub', vscode.NotebookCellStatusBarAlignment.Right);
        pubsub.command = { command: COMMAND_CELL_SEND_PUBSUB, title: 'Send to Pub/Sub', arguments: args };
        pubsub.tooltip = 'Publish results to a Pub/Sub topic';
        items.push(pubsub);

        const copy = new vscode.NotebookCellStatusBarItem('$(clippy) Copy', vscode.NotebookCellStatusBarAlignment.Right);
        copy.command = { command: COMMAND_CELL_COPY_MARKDOWN, title: 'Copy as Markdown', arguments: args };
        copy.tooltip = 'Copy results as a Markdown table';
        items.push(copy);

        return items;
    }
}
