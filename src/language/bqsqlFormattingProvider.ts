import * as vscode from 'vscode';
import { formatBigQuerySQL } from './bqsqlFormatter';

/**
 * Bridges the existing SQL formatter into VS Code's standard formatting API so
 * that "Format Document" (Shift+Alt+F), the editor context menu entry, and
 * editor.formatOnSave all work — not just the vscode-bigquery.format-query
 * command. Same formatting logic and settings as the command (see #12).
 */
export class BqsqlFormattingProvider implements vscode.DocumentFormattingEditProvider {

    provideDocumentFormattingEdits(
        document: vscode.TextDocument,
        _options: vscode.FormattingOptions,
        _token: vscode.CancellationToken
    ): vscode.TextEdit[] {
        const text = document.getText();

        let formatted: string;
        try {
            formatted = formatBigQuerySQL(text);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to format SQL: ${error.message}`);
            return [];
        }

        if (formatted === text) {
            return [];
        }

        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(text.length)
        );

        return [vscode.TextEdit.replace(fullRange, formatted)];
    }
}
