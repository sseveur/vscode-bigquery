import * as vscode from 'vscode';
import { BigQueryClient } from '../services/bigqueryClient';
import { Authentication } from '../services/authentication';
import {
    describeJob,
    jobEntryDescription,
    jobEntryLabel,
    JobHistoryEntry,
} from '../services/jobHistoryService';

const PAGE_SIZE = 50;

/**
 * Server-side Job History: every job the project ran (any tool, any client), straight from
 * jobs.list — unlike the local Query History view, which only knows queries run in VS Code.
 */
export class JobHistoryTreeDataProvider implements vscode.TreeDataProvider<JobHistoryTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<JobHistoryTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private entries: JobHistoryEntry[] = [];
    private nextPageToken: string | undefined;
    private allUsers = false;
    private error: string | undefined;
    private loaded = false;
    private loading = false;

    refresh(): void {
        this.entries = [];
        this.nextPageToken = undefined;
        this.loaded = false;
        this.error = undefined;
        this._onDidChangeTreeData.fire();
    }

    toggleAllUsers(): void {
        this.allUsers = !this.allUsers;
        vscode.window.setStatusBarMessage(
            `BigQuery job history: ${this.allUsers ? 'all users' : 'only my jobs'}`, 3000);
        this.refresh();
    }

    async loadMore(): Promise<void> {
        await this.fetchPage();
        this._onDidChangeTreeData.fire();
    }

    private async fetchPage(): Promise<void> {
        if (this.loading) { return; }
        this.loading = true;
        try {
            const projectId = await Authentication.getDefaultProjectId();
            const client = new BigQueryClient(projectId);
            const page = await client.listJobs({
                maxResults: PAGE_SIZE,
                pageToken: this.nextPageToken,
                allUsers: this.allUsers,
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.entries.push(...page.jobs.map((j: any) => describeJob(j.metadata ?? {})));
            this.nextPageToken = page.nextPageToken;
            this.error = undefined;
        } catch (err) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.error = (err as any)?.message ?? String(err);
        } finally {
            this.loading = false;
            this.loaded = true;
        }
    }

    getTreeItem(element: JobHistoryTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: JobHistoryTreeItem): Promise<JobHistoryTreeItem[]> {
        if (element) { return []; }

        if (!this.loaded) { await this.fetchPage(); }

        if (this.error) {
            return [new JobHistoryTreeItem(`Failed to list jobs: ${this.error}`, 'empty')];
        }
        if (this.entries.length === 0) {
            return [new JobHistoryTreeItem('No jobs found', 'empty')];
        }

        const items = this.entries.map(e => new JobHistoryTreeItem(jobEntryLabel(e), 'job', e));
        if (this.nextPageToken) {
            items.push(new JobHistoryTreeItem(`Load ${PAGE_SIZE} more…`, 'more'));
        }
        return items;
    }
}

export class JobHistoryTreeItem extends vscode.TreeItem {
    public readonly type: 'job' | 'more' | 'empty';
    public readonly entry?: JobHistoryEntry;

    constructor(label: string, type: 'job' | 'more' | 'empty', entry?: JobHistoryEntry) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.type = type;
        this.entry = entry;

        if (type === 'job' && entry) {
            this.iconPath = iconFor(entry);
            this.description = jobEntryDescription(entry);
            this.contextValue = entry.hasResults ? 'job-history-job-results' : 'job-history-job';
            this.tooltip = buildTooltip(entry);
            this.command = {
                command: 'vscode-bigquery.job-history-show',
                title: 'Show Job',
                arguments: [this],
            };
        } else if (type === 'more') {
            this.iconPath = new vscode.ThemeIcon('ellipsis');
            this.command = {
                command: 'vscode-bigquery.job-history-load-more',
                title: 'Load more',
            };
        } else if (type === 'empty') {
            this.iconPath = new vscode.ThemeIcon('info');
        }
    }
}

function iconFor(e: JobHistoryEntry): vscode.ThemeIcon {
    if (e.errorMessage) {
        return new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
    }
    if (e.state === 'RUNNING' || e.state === 'PENDING') {
        return new vscode.ThemeIcon('sync');
    }
    return new vscode.ThemeIcon('check');
}

function buildTooltip(e: JobHistoryEntry): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    const when = e.creationTime ? new Date(e.creationTime).toLocaleString() : 'unknown time';
    md.appendMarkdown(`**${e.statementType ?? e.jobType}** (${when})\n\n`);
    if (e.query) { md.appendCodeblock(e.query, 'sql'); }
    md.appendMarkdown(`\n**Job:** ${e.jobReference.jobId}`);
    if (e.user) { md.appendMarkdown(`\n\n**User:** ${e.user}`); }
    md.appendMarkdown(`\n\n**State:** ${e.state}`);
    if (e.errorMessage) { md.appendMarkdown(`\n\n**Error:** ${e.errorMessage}`); }
    return md;
}
