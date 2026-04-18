import * as vscode from 'vscode';
import { NOTEBOOK_TYPE } from './bqSqlNotebookSerializer';
import { CellRegistry } from './bqSqlNotebookCellRegistry';
import { BqSqlNotebookController } from './bqSqlNotebookController';

/**
 * Listens for BigQuery notebooks being opened and restores any previously
 * persisted cell outputs. Outputs are saved in globalState at execution time
 * and keyed by the notebook URI + SHA1 hash of the cell's SQL text, so a cell
 * keeps its output as long as its text remains the same.
 */
export function registerNotebookPersistence(
    context: vscode.ExtensionContext,
    registry: CellRegistry,
    controller: BqSqlNotebookController
): void {
    const restoreFor = async (notebook: vscode.NotebookDocument) => {
        if (notebook.notebookType !== NOTEBOOK_TYPE) {
            return;
        }
        const matches = registry.hydrate(notebook);
        for (const { cell, persisted } of matches) {
            if (cell.outputs.length > 0) {
                continue; // don't overwrite a fresh output
            }
            try {
                await controller.restoreOutput(cell, persisted.outputHtml);
            } catch {
                // cell may have been disposed; ignore
            }
        }
    };

    // Restore for already-open notebooks (e.g. on extension reload).
    for (const nb of vscode.workspace.notebookDocuments) {
        void restoreFor(nb);
    }

    context.subscriptions.push(
        vscode.workspace.onDidOpenNotebookDocument(restoreFor)
    );

    // Clear in-memory state when a notebook is closed so the registry doesn't
    // grow unbounded. Persisted outputs stay in globalState.
    context.subscriptions.push(
        vscode.workspace.onDidCloseNotebookDocument(nb => {
            registry.deleteForNotebook(nb.uri.toString());
        })
    );
}
