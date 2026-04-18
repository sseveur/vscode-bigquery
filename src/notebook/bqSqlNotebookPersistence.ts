import * as vscode from 'vscode';
import { NOTEBOOK_TYPE } from './bqSqlNotebookSerializer';
import { CellRegistry } from './bqSqlNotebookCellRegistry';

/**
 * Listens for BigQuery notebooks being opened and hydrates the in-memory
 * cell registry from persisted metadata (jobRef + schema + stats), so
 * exports / load-more flows work on previously executed cells. Output HTML
 * is not stored (would cause multi-GB globalState); re-run the cell to see
 * results again.
 */
export function registerNotebookPersistence(
    context: vscode.ExtensionContext,
    registry: CellRegistry
): void {
    const restoreFor = async (notebook: vscode.NotebookDocument) => {
        if (notebook.notebookType !== NOTEBOOK_TYPE) {
            return;
        }
        // Hydrate in-memory registry (so exports / load-more work on restored cells)
        // without replaying the output HTML. Output is re-rendered on cell execute.
        registry.hydrate(notebook);
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
