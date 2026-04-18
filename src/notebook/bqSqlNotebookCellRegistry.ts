import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { JobReference } from '../services/queryResultsMapping';

const STATE_KEY = 'bqsql-notebook-cells';
const MIGRATION_FLAG_KEY = 'bqsql-notebook-cells-v2.0.2-migrated';
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
    outputHtml?: string;
    timestamp: number;
}

type PersistedNotebooks = Record<string, PersistedCell[]>;

/**
 * One-time migration for v2.0.2: earlier versions persisted full rendered
 * HTML per notebook cell which could balloon globalState to gigabytes.
 * Scans every globalState key, sums size, and clears any single key over
 * 5 MB (with best-effort outputHtml stripping first for notebook cells).
 * Flag so migration only runs once per installation.
 */
const SIZE_THRESHOLD_BYTES = 5 * 1024 * 1024;
const PROTECTED_KEYS = new Set<string>([
    // Never wipe these — they are small pointers / preferences.
    'bqsql-notebook-cells-v2-migrated',
    'bqsql-notebook-cells-v2.0.2-migrated',
]);

export async function runCellRegistryMigration(globalState: vscode.Memento): Promise<void> {
    if (globalState.get<boolean>(MIGRATION_FLAG_KEY)) { return; }

    // Pass 1: strip outputHtml from notebook cells (non-destructive of job refs).
    const all = globalState.get<PersistedNotebooks>(STATE_KEY);
    if (all && typeof all === 'object') {
        const cleaned: PersistedNotebooks = {};
        for (const [uri, cells] of Object.entries(all)) {
            if (!Array.isArray(cells)) { continue; }
            cleaned[uri] = cells.map(c => {
                const copy = { ...c };
                delete copy.outputHtml;
                return copy;
            });
        }
        await globalState.update(STATE_KEY, cleaned);
    }

    // Pass 2: nuke any other key whose serialized value exceeds threshold.
    try {
        const keys = globalState.keys();
        for (const key of keys) {
            if (PROTECTED_KEYS.has(key)) { continue; }
            let size = 0;
            try {
                const value = globalState.get(key);
                if (value === undefined) { continue; }
                size = JSON.stringify(value).length;
            } catch { continue; }
            if (size > SIZE_THRESHOLD_BYTES) {
                console.warn(`[bigquery-studio] Clearing oversized globalState key "${key}" (${(size / 1024 / 1024).toFixed(1)} MB)`);
                await globalState.update(key, undefined);
            }
        }
    } catch { /* Memento.keys may not exist on some VS Code versions */ }

    await globalState.update(MIGRATION_FLAG_KEY, true);
}

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

    async persist(state: CellExecutionState): Promise<void> {
        const all = this.globalState.get<PersistedNotebooks>(STATE_KEY, {});
        const list = all[state.notebookUri] || [];

        const cell: PersistedCell = {
            queryHash: state.queryHash,
            jobReference: state.jobReference,
            fields: state.fields,
            totalRows: state.totalRows,
            bytesProcessed: state.bytesProcessed,
            durationMs: state.durationMs,
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
