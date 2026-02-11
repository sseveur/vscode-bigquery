import * as vscode from 'vscode';
import { BigQuery } from '@google-cloud/bigquery';
import { getBigQueryClient, SETTING_PROJECTS, SETTING_TABLES } from '../extensionCommands';
import { Authentication } from './authentication';
import { TableReference } from './tableMetadata';

export interface TableIndexEntry {
    projectId: string;
    datasetId: string;
    tableId: string;
}

interface TableIndexData {
    entries: TableIndexEntry[];
    builtAt: number;
}

const STORAGE_KEY = 'bigquery-table-index';

export class TableIndexService {
    private globalState: vscode.Memento;

    constructor(globalState: vscode.Memento) {
        this.globalState = globalState;
    }

    public getIndex(): TableIndexEntry[] {
        const data = this.globalState.get<TableIndexData>(STORAGE_KEY);
        return data?.entries || [];
    }

    public getBuiltAt(): number | null {
        const data = this.globalState.get<TableIndexData>(STORAGE_KEY);
        return data?.builtAt || null;
    }

    public search(term: string): TableIndexEntry[] {
        const lowerTerm = term.toLowerCase();
        return this.getIndex().filter(e =>
            e.tableId.toLowerCase().includes(lowerTerm)
        );
    }

    public async buildIndex(): Promise<number> {
        return vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Building table index...', cancellable: true },
            async (progress, cancellationToken) => {
                const entries: TableIndexEntry[] = [];

                const bqClient = await getBigQueryClient();
                const bqProjects = await bqClient.getProjects();

                let projectIds = this.getProjectsFromSettings();
                for (const project of bqProjects.projects || []) {
                    const projectId = (project.id || 'xxx').toLowerCase();
                    if (projectIds.indexOf(projectId) < 0) {
                        projectIds.push(projectId);
                    }
                }

                const totalProjects = projectIds.length;

                for (let i = 0; i < projectIds.length; i++) {
                    if (cancellationToken.isCancellationRequested) { break; }

                    const projectId = projectIds[i];
                    progress.report({ message: `Scanning ${projectId} (${i + 1}/${totalProjects})...`, increment: (100 / totalProjects) });

                    try {
                        const bigqueryClient = new BigQuery({ projectId });
                        const datasets = await bigqueryClient.getDatasets({ all: true, filter: '' });
                        const datasetList = datasets[0].filter(c => c.id !== null && (!c.id?.startsWith('_')));

                        // Fetch tables from all datasets in parallel
                        const datasetPromises = datasetList.map(async dataset => {
                            if (cancellationToken.isCancellationRequested) { return; }
                            try {
                                const datasetId = dataset.id ?? 'xxx';
                                const getTablesResponse = await dataset.getTables();
                                const tables = getTablesResponse[0]
                                    .filter(c => c.id !== null && (!c.id?.startsWith('_')));

                                for (const table of tables) {
                                    entries.push({
                                        projectId,
                                        datasetId,
                                        tableId: table.id ?? 'xxx'
                                    });
                                }
                            } catch (error) { }
                        });

                        await Promise.all(datasetPromises);
                    } catch (error) { }
                }

                await this.globalState.update(STORAGE_KEY, {
                    entries,
                    builtAt: Date.now()
                } as TableIndexData);

                return entries.length;
            }
        );
    }

    public async clearIndex(): Promise<void> {
        await this.globalState.update(STORAGE_KEY, undefined);
    }

    private getProjectsFromSettings(): string[] {
        let projects = (vscode.workspace
            .getConfiguration()
            .get(SETTING_PROJECTS) as string[] || [])
            .map(c => (c as string).toLowerCase());

        const tables = (vscode.workspace
            .getConfiguration()
            .get(SETTING_TABLES) as string[] || [])
            .map(c => (c as string).toLowerCase())
            .map(c => c.split('.'))
            .filter(c => c.length === 3)
            .map(c => c[0]);

        for (const projectId of tables) {
            if (projects.indexOf(projectId) < 0) {
                projects.push(projectId);
            }
        }

        return projects;
    }
}
