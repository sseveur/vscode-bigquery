import * as vscode from 'vscode';
import { splitQueries } from '../services/querySplitter';

export const NOTEBOOK_TYPE = 'bigquery-sql-notebook';
export const CELL_LANGUAGE = 'bqsql';

const CELL_MARKER = '-- %%';
const CELL_MARKER_LINE_REGEX = /^[ \t]*--[ \t]*%%[ \t]*$/m;
const CELL_MARKER_SPLIT_REGEX = /^[ \t]*--[ \t]*%%[ \t]*\r?\n?/gm;

/**
 * Serializes .sql/.bqsql files as notebooks.
 *
 * Cell layout persistence:
 *   - When the user's cell layout matches what splitQueries() would auto-produce,
 *     the file is written as plain SQL with no markers (clean diff).
 *   - When the user has merged or split cells differently from auto-split, a
 *     Jupytext-style `-- %%` marker line is written before each cell so the
 *     layout reloads identically.
 *   - On load, presence of any `-- %%` line switches to marker-based splitting;
 *     otherwise we fall back to the parser-driven split.
 */
export class BqSqlNotebookSerializer implements vscode.NotebookSerializer {

    async deserializeNotebook(
        content: Uint8Array,
        _token: vscode.CancellationToken
    ): Promise<vscode.NotebookData> {
        return textToNotebookData(new TextDecoder().decode(content));
    }

    async serializeNotebook(
        data: vscode.NotebookData,
        _token: vscode.CancellationToken
    ): Promise<Uint8Array> {
        const userCells = data.cells
            .filter(c => c.kind === vscode.NotebookCellKind.Code)
            .map(c => c.value.trim())
            .filter(v => v.length > 0);

        if (userCells.length === 0) {
            return new TextEncoder().encode('');
        }

        const withSemicolons = userCells.map(v => v.endsWith(';') ? v : v + ';');
        const cleanSql = withSemicolons.join('\n\n');

        if (cellsMatchAutoSplit(userCells, cleanSql)) {
            return new TextEncoder().encode(cleanSql);
        }

        const marked = withSemicolons
            .map(v => `${CELL_MARKER}\n${v}`)
            .join('\n\n');
        return new TextEncoder().encode(marked);
    }
}

/**
 * Splits SQL text into notebook cells: `-- %%` markers when present, otherwise the
 * parser-driven statement split. Used by the serializer (file → notebook) and by
 * "Open as Notebook" on unsaved buffers, where there is no file to deserialize from.
 */
export function textToNotebookData(text: string): vscode.NotebookData {
    if (text.trim().length === 0) {
        return new vscode.NotebookData([
            new vscode.NotebookCellData(vscode.NotebookCellKind.Code, '', CELL_LANGUAGE)
        ]);
    }

    if (CELL_MARKER_LINE_REGEX.test(text)) {
        const cells = splitOnMarkers(text);
        if (cells.length > 0) {
            return new vscode.NotebookData(
                cells.map(value =>
                    new vscode.NotebookCellData(vscode.NotebookCellKind.Code, value, CELL_LANGUAGE)
                )
            );
        }
    }

    const queries = splitQueries(text);

    if (queries.length === 0) {
        return new vscode.NotebookData([
            new vscode.NotebookCellData(vscode.NotebookCellKind.Code, text.trim(), CELL_LANGUAGE)
        ]);
    }

    return new vscode.NotebookData(
        queries.map(q => new vscode.NotebookCellData(vscode.NotebookCellKind.Code, q.sql, CELL_LANGUAGE))
    );
}

function splitOnMarkers(text: string): string[] {
    return text
        .split(CELL_MARKER_SPLIT_REGEX)
        .map(s => s.trim())
        .filter(s => s.length > 0);
}

function normalizeForCompare(s: string): string {
    return s.trim().replace(/;\s*$/, '').trim();
}

function cellsMatchAutoSplit(userCells: string[], joinedSql: string): boolean {
    const autoCells = splitQueries(joinedSql).map(q => normalizeForCompare(q.sql));
    const normalizedUser = userCells.map(normalizeForCompare);
    if (autoCells.length !== normalizedUser.length) {
        return false;
    }
    for (let i = 0; i < autoCells.length; i++) {
        if (autoCells[i] !== normalizedUser[i]) {
            return false;
        }
    }
    return true;
}
