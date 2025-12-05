import * as vscode from 'vscode';

export interface QueryHistoryItem {
    id: string;
    query: string;
    timestamp: number;  // Unix timestamp in ms
    bytesProcessed: number;
    durationMs: number;
    projectId: string;
    status: 'success' | 'error';
    errorMessage?: string;
}

const STORAGE_KEY = 'bigquery-query-history';
const MAX_HISTORY_ITEMS = 100;

export class QueryHistoryService {
    private globalState: vscode.Memento;
    private onDidChangeEmitter = new vscode.EventEmitter<void>();
    public readonly onDidChange = this.onDidChangeEmitter.event;

    constructor(globalState: vscode.Memento) {
        this.globalState = globalState;
    }

    public getHistory(): QueryHistoryItem[] {
        return this.globalState.get<QueryHistoryItem[]>(STORAGE_KEY, []);
    }

    public async addEntry(entry: Omit<QueryHistoryItem, 'id'>): Promise<void> {
        const history = this.getHistory();

        const newEntry: QueryHistoryItem = {
            ...entry,
            id: this.generateId(),
        };

        // Add to beginning (most recent first)
        history.unshift(newEntry);

        // Trim to max size
        if (history.length > MAX_HISTORY_ITEMS) {
            history.length = MAX_HISTORY_ITEMS;
        }

        await this.globalState.update(STORAGE_KEY, history);
        this.onDidChangeEmitter.fire();
    }

    public async removeEntry(id: string): Promise<void> {
        const history = this.getHistory();
        const filtered = history.filter(item => item.id !== id);
        await this.globalState.update(STORAGE_KEY, filtered);
        this.onDidChangeEmitter.fire();
    }

    public async clearHistory(): Promise<void> {
        await this.globalState.update(STORAGE_KEY, []);
        this.onDidChangeEmitter.fire();
    }

    public getGroupedByDate(): Map<string, QueryHistoryItem[]> {
        const history = this.getHistory();
        const groups = new Map<string, QueryHistoryItem[]>();

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTs = today.getTime();

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayTs = yesterday.getTime();

        const thisWeek = new Date(today);
        thisWeek.setDate(thisWeek.getDate() - 7);
        const thisWeekTs = thisWeek.getTime();

        for (const item of history) {
            let groupName: string;

            if (item.timestamp >= todayTs) {
                groupName = 'Today';
            } else if (item.timestamp >= yesterdayTs) {
                groupName = 'Yesterday';
            } else if (item.timestamp >= thisWeekTs) {
                groupName = 'This Week';
            } else {
                groupName = 'Older';
            }

            if (!groups.has(groupName)) {
                groups.set(groupName, []);
            }
            groups.get(groupName)!.push(item);
        }

        return groups;
    }

    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }
}

export function formatQueryPreview(query: string, maxLength: number = 50): string {
    // Normalize whitespace and truncate
    const normalized = query.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) {
        return normalized;
    }
    return normalized.substring(0, maxLength - 3) + '...';
}

export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, i);

    return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export function formatDuration(ms: number): string {
    if (ms < 1000) {
        return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(1)}s`;
}
