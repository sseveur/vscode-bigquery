import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { JobReference } from '../services/queryResultsMapping';

const STATE_KEY = 'bqsql-notebook-cells';
const MAX_PERSISTED_CELLS_PER_NOTEBOOK = 200;

export interface CellExecutionState {
    notebookUri: string;
    cellUri: string;
    queryHash: string;
    queryText: string;
    jobReference: JobReference;
    fields: Array<{ name: string; type?: string; mode?: string; fields?: any[] }>;
    totalRows: number;
    bytesProcessed: number;
    durationMs: number;
}

interface PersistedCell {
    queryHash: string;
    jobReference: JobReference;
    fields: CellExecutionState['fields'];
    totalRows: number;
    bytesProcessed: number;
    durationMs: number;
    outputHtml: string;
    timestamp: number;
}

type PersistedNotebooks = Record<string, PersistedCell[]>;

export function hashQuery(text: string): string {
    return crypto.createHash('sha1').update(text.trim()).digest('hex');
}

/**
 * Tracks cell execution state so exports, load-more, and cancel can act on
 * the right job reference. Also persists rendered outputs to globalState so
 * results survive VS Code restarts.
 */
export class CellRegistry {
    private readonly inMemory = new Map<string, CellExecutionState>();

    constructor(private readonly globalState: vscode.Memento) { }

    get(cellUri: string): CellExecutionState | undefined {
        return this.inMemory.get(cellUri);
    }

    set(cellUri: string, state: CellExecutionState): void {
        this.inMemory.set(cellUri, state);
    }

    deleteForNotebook(notebookUri: string): void {
        for (const [key, state] of this.inMemory.entries()) {
            if (state.notebookUri === notebookUri) {
                this.inMemory.delete(key);
            }
        }
    }

    async persist(state: CellExecutionState, outputHtml: string): Promise<void> {
        const all = this.globalState.get<PersistedNotebooks>(STATE_KEY, {});
        const list = all[state.notebookUri] || [];

        const cell: PersistedCell = {
            queryHash: state.queryHash,
            jobReference: state.jobReference,
            fields: state.fields,
            totalRows: state.totalRows,
            bytesProcessed: state.bytesProcessed,
            durationMs: state.durationMs,
            outputHtml,
            timestamp: Date.now()
        };

        const filtered = list.filter(c => c.queryHash !== state.queryHash);
        filtered.unshift(cell);

        all[state.notebookUri] = filtered.slice(0, MAX_PERSISTED_CELLS_PER_NOTEBOOK);
        await this.globalState.update(STATE_KEY, all);
    }

    getPersisted(notebookUri: string): PersistedCell[] {
        const all = this.globalState.get<PersistedNotebooks>(STATE_KEY, {});
        return all[notebookUri] || [];
    }

    /**
     * Hydrate the in-memory registry from persisted data for the given notebook
     * and return the cells that had saved outputs so the caller can apply them.
     */
    hydrate(notebook: vscode.NotebookDocument): Array<{ cell: vscode.NotebookCell; persisted: PersistedCell }> {
        const persisted = this.getPersisted(notebook.uri.toString());
        if (persisted.length === 0) {
            return [];
        }

        const matches: Array<{ cell: vscode.NotebookCell; persisted: PersistedCell }> = [];
        for (const cell of notebook.getCells()) {
            if (cell.kind !== vscode.NotebookCellKind.Code) {
                continue;
            }
            const hash = hashQuery(cell.document.getText());
            const match = persisted.find(p => p.queryHash === hash);
            if (!match) {
                continue;
            }

            this.inMemory.set(cell.document.uri.toString(), {
                notebookUri: notebook.uri.toString(),
                cellUri: cell.document.uri.toString(),
                queryHash: match.queryHash,
                queryText: cell.document.getText(),
                jobReference: match.jobReference,
                fields: match.fields,
                totalRows: match.totalRows,
                bytesProcessed: match.bytesProcessed,
                durationMs: match.durationMs
            });

            matches.push({ cell, persisted: match });
        }
        return matches;
    }

    async clearPersisted(notebookUri: string): Promise<void> {
        const all = this.globalState.get<PersistedNotebooks>(STATE_KEY, {});
        delete all[notebookUri];
        await this.globalState.update(STATE_KEY, all);
    }
}
