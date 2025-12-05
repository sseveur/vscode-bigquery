import * as vscode from 'vscode';
import { QueryHistoryItem, QueryHistoryService, formatQueryPreview, formatBytes, formatDuration } from '../services/queryHistoryService';

export class QueryHistoryTreeDataProvider implements vscode.TreeDataProvider<QueryHistoryTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<QueryHistoryTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private historyService: QueryHistoryService;

    constructor(historyService: QueryHistoryService) {
        this.historyService = historyService;

        // Listen for history changes
        this.historyService.onDidChange(() => {
            this.refresh();
        });
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: QueryHistoryTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: QueryHistoryTreeItem): Thenable<QueryHistoryTreeItem[]> {
        if (!element) {
            // Root level - return date groups
            const groups = this.historyService.getGroupedByDate();
            const items: QueryHistoryTreeItem[] = [];

            // Preserve order: Today, Yesterday, This Week, Older
            const orderedGroups = ['Today', 'Yesterday', 'This Week', 'Older'];
            for (const groupName of orderedGroups) {
                if (groups.has(groupName)) {
                    items.push(new QueryHistoryTreeItem(
                        groupName,
                        vscode.TreeItemCollapsibleState.Expanded,
                        'group',
                        undefined,
                        groups.get(groupName)!
                    ));
                }
            }

            if (items.length === 0) {
                items.push(new QueryHistoryTreeItem(
                    'No query history',
                    vscode.TreeItemCollapsibleState.None,
                    'empty'
                ));
            }

            return Promise.resolve(items);
        }

        // Group children - return query items
        if (element.type === 'group' && element.children) {
            return Promise.resolve(
                element.children.map(item => new QueryHistoryTreeItem(
                    formatQueryPreview(item.query),
                    vscode.TreeItemCollapsibleState.None,
                    'query',
                    item
                ))
            );
        }

        return Promise.resolve([]);
    }
}

export class QueryHistoryTreeItem extends vscode.TreeItem {
    public readonly type: 'group' | 'query' | 'empty';
    public readonly historyItem?: QueryHistoryItem;
    public readonly children?: QueryHistoryItem[];

    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        type: 'group' | 'query' | 'empty',
        historyItem?: QueryHistoryItem,
        children?: QueryHistoryItem[]
    ) {
        super(label, collapsibleState);

        this.type = type;
        this.historyItem = historyItem;
        this.children = children;

        if (type === 'group') {
            this.iconPath = new vscode.ThemeIcon('calendar');
            this.contextValue = 'history-group';
        } else if (type === 'query' && historyItem) {
            const isSuccess = historyItem.status === 'success';
            this.iconPath = new vscode.ThemeIcon(isSuccess ? 'check' : 'error',
                isSuccess ? undefined : new vscode.ThemeColor('errorForeground'));
            this.contextValue = 'history-query';

            // Description shows bytes and duration
            const bytesStr = formatBytes(historyItem.bytesProcessed);
            const durationStr = formatDuration(historyItem.durationMs);
            this.description = `${bytesStr}, ${durationStr}`;

            // Tooltip shows full query and metadata
            const time = new Date(historyItem.timestamp).toLocaleString();
            this.tooltip = new vscode.MarkdownString();
            this.tooltip.appendMarkdown(`**Query** (${time})\n\n`);
            this.tooltip.appendCodeblock(historyItem.query, 'sql');
            this.tooltip.appendMarkdown(`\n\n**Project:** ${historyItem.projectId}`);
            this.tooltip.appendMarkdown(`\n**Bytes:** ${bytesStr}`);
            this.tooltip.appendMarkdown(`\n**Duration:** ${durationStr}`);
            if (historyItem.errorMessage) {
                this.tooltip.appendMarkdown(`\n\n**Error:** ${historyItem.errorMessage}`);
            }

            // Click to show full query
            this.command = {
                command: 'vscode-bigquery.history-show',
                title: 'Show Query',
                arguments: [historyItem]
            };
        } else if (type === 'empty') {
            this.iconPath = new vscode.ThemeIcon('info');
        }
    }
}
