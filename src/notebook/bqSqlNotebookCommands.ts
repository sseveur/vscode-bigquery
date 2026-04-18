import * as vscode from 'vscode';
import { BigQueryClient } from '../services/bigqueryClient';
import { Authentication } from '../services/authentication';
import { DownloadCsv } from '../tableResultsPanel/downloadCsv';
import { DownloadJsonl } from '../tableResultsPanel/downloadJsonl';
import { SendToPubsub } from '../tableResultsPanel/sendToPubsub';
import { CopyToClipboard } from '../tableResultsPanel/copyToClipboard';
import { CellRegistry } from './bqSqlNotebookCellRegistry';

/**
 * Returns the cell execution state for a cell URI string passed as the first
 * argument of a cell status bar command.
 */
async function resolveState(registry: CellRegistry, cellUri: string | undefined) {
    if (!cellUri) {
        vscode.window.showWarningMessage('No cell selected.');
        return null;
    }
    const state = registry.get(cellUri);
    if (!state) {
        vscode.window.showWarningMessage('Run the cell first to produce results.');
        return null;
    }
    const projectId = await Authentication.getDefaultProjectId();
    const client = new BigQueryClient(projectId);
    return { state, client };
}

export function cellDownloadCsv(registry: CellRegistry) {
    return async function (cellUri?: string) {
        const resolved = await resolveState(registry, cellUri);
        if (!resolved) { return; }
        await DownloadCsv.download(resolved.client, resolved.state.jobReference);
    };
}

export function cellDownloadJsonl(registry: CellRegistry) {
    return async function (cellUri?: string) {
        const resolved = await resolveState(registry, cellUri);
        if (!resolved) { return; }
        await DownloadJsonl.download(resolved.client, resolved.state.jobReference);
    };
}

export function cellSendPubsub(registry: CellRegistry) {
    return async function (cellUri?: string) {
        const resolved = await resolveState(registry, cellUri);
        if (!resolved) { return; }
        await SendToPubsub.sendJobResult(resolved.client, resolved.state.jobReference);
    };
}

export function cellCopyMarkdown(registry: CellRegistry) {
    return async function (cellUri?: string) {
        const resolved = await resolveState(registry, cellUri);
        if (!resolved) { return; }
        await CopyToClipboard.copy(resolved.client, resolved.state.jobReference);
    };
}
