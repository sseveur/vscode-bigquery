import * as vscode from 'vscode';
import { splitQueries } from '../services/querySplitter';

export const NOTEBOOK_TYPE = 'bigquery-sql-notebook';
export const CELL_LANGUAGE = 'bqsql';

/**
 * Serializes .sql/.bqsql files as notebooks.
 * On disk the file remains plain SQL; cells are joined with ";\n".
 */
export class BqSqlNotebookSerializer implements vscode.NotebookSerializer {

    async deserializeNotebook(
        content: Uint8Array,
        _token: vscode.CancellationToken
    ): Promise<vscode.NotebookData> {
        const text = new TextDecoder().decode(content);

        if (text.trim().length === 0) {
            return new vscode.NotebookData([
                new vscode.NotebookCellData(vscode.NotebookCellKind.Code, '', CELL_LANGUAGE)
            ]);
        }

        const queries = splitQueries(text);

        if (queries.length === 0) {
            return new vscode.NotebookData([
                new vscode.NotebookCellData(vscode.NotebookCellKind.Code, text.trim(), CELL_LANGUAGE)
            ]);
        }

        const cells = queries.map(q =>
            new vscode.NotebookCellData(vscode.NotebookCellKind.Code, q.sql, CELL_LANGUAGE)
        );

        return new vscode.NotebookData(cells);
    }

    async serializeNotebook(
        data: vscode.NotebookData,
        _token: vscode.CancellationToken
    ): Promise<Uint8Array> {
        const codeCells = data.cells.filter(c => c.kind === vscode.NotebookCellKind.Code);
        const content = codeCells
            .map(cell => cell.value.trim())
            .filter(v => v.length > 0)
            .map(v => v.endsWith(';') ? v : v + ';')
            .join('\n\n');
        return new TextEncoder().encode(content);
    }
}
