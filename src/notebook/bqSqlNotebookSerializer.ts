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

    // splitQueries only reports statement ranges, so a standalone comment that sits between
    // two statements belongs to no range and was dropped when opening as a notebook (#14).
    // Reconstruct cells from the original text instead: a statement's cell keeps any comment
    // block that leads into it (from just after the previous statement's terminator), and any
    // trailing comment after the last statement is appended to the last cell. Nothing is lost.
    const values: string[] = [];
    let prevTermEnd = 0;
    for (let i = 0; i < queries.length; i++) {
        const q = queries[i];
        const leading = text.substring(prevTermEnd, q.startOffset).trim();
        values.push(leading ? `${leading}\n${q.sql}` : q.sql);
        prevTermEnd = terminatorEnd(text, q.endOffset);
    }
    const tail = text.substring(prevTermEnd).trim();
    if (tail) {
        values[values.length - 1] += `\n\n${tail}`;
    }

    return new vscode.NotebookData(
        values.map(v => new vscode.NotebookCellData(vscode.NotebookCellKind.Code, v, CELL_LANGUAGE))
    );
}

/**
 * Returns the offset just past a statement's terminating `;` (skipping only whitespace after
 * the statement's range). If no semicolon follows, returns the statement end unchanged, so the
 * gap up to the next statement is treated as that next statement's leading comment block.
 */
function terminatorEnd(text: string, endOffset: number): number {
    let j = endOffset;
    while (j < text.length && (text[j] === ' ' || text[j] === '\t' || text[j] === '\r' || text[j] === '\n')) {
        j++;
    }
    return text[j] === ';' ? j + 1 : endOffset;
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
