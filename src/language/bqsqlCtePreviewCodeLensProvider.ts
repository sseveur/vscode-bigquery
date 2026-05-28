import * as vscode from 'vscode';
import { extractCtePreviews } from '../services/ctePreview';

// Must match COMMAND_PREVIEW_CTE in extensionCommands.ts.
// Hardcoded here to avoid an import cycle (extensionCommands ↔ extension).
const PREVIEW_CTE_COMMAND = 'vscode-bigquery.preview-cte';

/**
 * Renders a clickable "Preview CTE" CodeLens above each CTE in a top-level WITH
 * clause, mirroring the dbt Power User experience. Clicking runs the CTE in
 * isolation (all upstream CTEs included) and shows the rows in the results grid.
 */
export class BqsqlCtePreviewCodeLensProvider implements vscode.CodeLensProvider {

    private readonly _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
    readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

    constructor() {
        // Re-render lenses when the toggle or row-limit setting changes.
        vscode.workspace.onDidChangeConfiguration(e => {
            if (
                e.affectsConfiguration('vscode-bigquery.enableCtePreviewCodeLens') ||
                e.affectsConfiguration('vscode-bigquery.ctePreviewRowLimit')
            ) {
                this._onDidChangeCodeLenses.fire();
            }
        });
    }

    provideCodeLenses(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): vscode.CodeLens[] {
        const config = vscode.workspace.getConfiguration('vscode-bigquery');
        if (!config.get<boolean>('enableCtePreviewCodeLens', true)) {
            return [];
        }

        const rowLimit = config.get<number>('ctePreviewRowLimit', 100);
        const previews = extractCtePreviews(document.getText(), rowLimit);

        return previews.map(preview => {
            const position = document.positionAt(preview.nameOffset);
            const range = new vscode.Range(position, position);
            return new vscode.CodeLens(range, {
                title: '$(play) Preview CTE',
                tooltip: `Run ${preview.name} (and its upstream CTEs) and preview the results`,
                command: PREVIEW_CTE_COMMAND,
                arguments: [preview.previewSql, preview.name]
            });
        });
    }
}
