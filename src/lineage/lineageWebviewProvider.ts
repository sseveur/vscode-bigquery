import * as vscode from 'vscode';
import { MultiLineageResult } from '../services/lineageGraph';
import { calculateLayout } from './dagLayout';
import { columnsCardHeight, renderGraphToSvg } from './svgRenderer';
import { resolveLineageColumns } from './lineageColumns';
import { bigQueryColumnLookup } from '../services/columnResolver';
import { getBigQueryClient } from '../extensionCommands';
import { getLayoutConfig } from './dagLayout';
import { exportFilename, LineageSection, renderLineageHtml } from './lineageHtml';
import { LineageExportService } from './lineageExportService';
import { getContentSecurityPolicy, getNonce, reportCspViolation } from '../utils/webviewSecurity';

const VIEW_TYPE = 'bigquery-lineage';

let currentPanel: vscode.WebviewPanel | undefined;
let messageHandlerDisposable: vscode.Disposable | undefined;
let configChangeDisposable: vscode.Disposable | undefined;
let sourceDocument: vscode.TextDocument | undefined;

// Rendered sections of the open panel, indexed like the webview's queryIndex, for export
let currentSvgData: LineageSection[] | null = null;

/**
 * Show lineage panel for multiple queries (stacked vertically)
 */
export function showMultiLineagePanel(result: MultiLineageResult, context: vscode.ExtensionContext): void {
    const column = vscode.ViewColumn.Beside;

    // Store reference to the source document before panel takes focus
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        sourceDocument = editor.document;
    }

    // If panel already exists, reveal and update it
    if (currentPanel) {
        currentPanel.reveal(column);
        updateMultiPanelContent(currentPanel, result, context.extensionUri);
        return;
    }

    // Create new panel
    currentPanel = vscode.window.createWebviewPanel(
        VIEW_TYPE,
        'Data Lineage',
        column,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    updateMultiPanelContent(currentPanel, result, context.extensionUri);

    // Handle messages from webview
    messageHandlerDisposable = currentPanel.webview.onDidReceiveMessage(message => {
        if (message.type === 'navigate') {
            navigateToPosition(message.line, message.column, message.fullName);
        } else if (message.type === 'scrollToQuery') {
            navigateToLine(message.line);
        } else if (message.type === 'exportPngData') {
            handleExportPngData(message);
        } else if (message.type === 'exportAllPngData') {
            handleExportAllPngData(message);
        } else if (message.type === 'loadColumns') {
            void postColumnsSvg(message.queryIndex);
        } else if (message.type === 'cspViolation') {
            reportCspViolation('lineage', message.directive, message.blocked);
        } else if (message.type === 'exportError') {
            vscode.window.showErrorMessage(`Failed to export: ${message.error}`);
        }
    });

    // Push export theme changes to webview in real-time
    configChangeDisposable = vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('vscode-bigquery.lineageExportTheme') && currentPanel) {
            const theme = vscode.workspace.getConfiguration('vscode-bigquery').get<string>('lineageExportTheme', 'dark');
            currentPanel.webview.postMessage({ type: 'themeChanged', theme });
        }
    });

    // Handle panel disposal
    currentPanel.onDidDispose(() => {
        currentPanel = undefined;
        sourceDocument = undefined;
        currentSvgData = null;
        if (messageHandlerDisposable) {
            messageHandlerDisposable.dispose();
            messageHandlerDisposable = undefined;
        }
        if (configChangeDisposable) {
            configChangeDisposable.dispose();
            configChangeDisposable = undefined;
        }
    });
}

function updateMultiPanelContent(panel: vscode.WebviewPanel, result: MultiLineageResult, extensionUri: vscode.Uri): void {
    // Layout + SVG once per query; the page and the PNG/PDF export share them
    const sections: LineageSection[] = result.queries
        .filter(q => q.graph.nodes.length > 0)
        .map(queryInfo => {
            const { width, height } = calculateLayout(queryInfo.graph);
            return { queryInfo, svg: renderGraphToSvg(queryInfo.graph, width, height) };
        });
    currentSvgData = sections;
    columnsSvgCache.clear();

    const exportTheme = vscode.workspace.getConfiguration('vscode-bigquery').get<string>('lineageExportTheme', 'dark');
    const nonce = getNonce();
    panel.webview.html = renderLineageHtml(sections, exportTheme, {
        // SVG nodes carry style="" attributes; the PNG/PDF export draws the SVG through a blob: <img>
        csp: getContentSecurityPolicy(panel.webview, nonce, { allowUnsafeInlineStyles: true, allowBlobImages: true }),
        nonce,
        codiconFontUri: panel.webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'codicon.ttf')).toString(),
    });
}

/**
 * Handle export PNG data received from webview (single image)
 */
async function handleExportPngData(message: {
    format: 'png' | 'pdf';
    pngBase64: string;
    width: number;
    height: number;
    queryIndex?: number;
}): Promise<void> {
    const queryIndex = message.queryIndex;
    const queryInfo = currentSvgData && queryIndex !== undefined ? currentSvgData[queryIndex]?.queryInfo : undefined;
    const lineRange = queryInfo ? `${queryInfo.startLine}-${queryInfo.endLine}` : undefined;
    const filename = exportFilename(message.format, queryIndex, lineRange);

    if (message.format === 'png') {
        await LineageExportService.exportToPng(message.pngBase64, filename);
    } else {
        await LineageExportService.exportToPdf(message.pngBase64, message.width, message.height, filename);
    }
}

/**
 * Handle export all PNG data received from webview (multiple images)
 */
async function handleExportAllPngData(message: {
    format: 'png' | 'pdf';
    items: Array<{ pngBase64: string; width: number; height: number; queryIndex: number }>;
}): Promise<void> {
    if (message.format === 'png') {
        const pngDataItems = message.items.map(item => ({
            pngBase64: item.pngBase64,
            queryIndex: item.queryIndex,
            lineRange: currentSvgData?.[item.queryIndex]?.queryInfo
                ? `${currentSvgData[item.queryIndex].queryInfo!.startLine}-${currentSvgData[item.queryIndex].queryInfo!.endLine}`
                : ''
        }));
        await LineageExportService.exportMultipleToPng(pngDataItems, 'lineage_all_queries.png');
    } else {
        const pdfDataItems = message.items.map(item => ({
            pngBase64: item.pngBase64,
            width: item.width,
            height: item.height,
            title: `Query ${item.queryIndex + 1}`
        }));
        await LineageExportService.exportMultipleToMultiPagePdf(pdfDataItems, 'lineage_all_queries.pdf');
    }
}

/**
 * Navigate to a specific line in the source document
 */
async function navigateToLine(line: number): Promise<void> {
    if (!sourceDocument) {
        return;
    }

    const editor = await vscode.window.showTextDocument(sourceDocument, {
        viewColumn: vscode.ViewColumn.One,
        preserveFocus: false
    });

    if (line > 0) {
        const position = new vscode.Position(line - 1, 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(
            new vscode.Range(position, position),
            vscode.TextEditorRevealType.InCenter
        );
    }
}

/**
 * Navigate to a specific position in the source document
 */
async function navigateToPosition(line?: number, column?: number, fullName?: string): Promise<void> {
    // Use stored source document
    if (!sourceDocument) {
        vscode.window.showWarningMessage('No source document available');
        return;
    }

    // Show the document first to get an editor
    const editor = await vscode.window.showTextDocument(sourceDocument, {
        viewColumn: vscode.ViewColumn.One,
        preserveFocus: false
    });

    // If we have exact position, use it
    if (line && line > 0) {
        const position = new vscode.Position(line - 1, (column || 1) - 1);

        // Find the end of the table name for selection
        const lineText = sourceDocument.lineAt(line - 1).text;
        let endColumn = (column || 1) - 1;

        // Try to select the full table name
        if (fullName) {
            const searchStart = Math.max(0, (column || 1) - 1);
            const nameToFind = fullName.split('.').pop() || fullName;
            const idx = lineText.toLowerCase().indexOf(nameToFind.toLowerCase(), searchStart);
            if (idx >= 0) {
                endColumn = idx + nameToFind.length;
            }
        }

        const endPosition = new vscode.Position(line - 1, endColumn);
        editor.selection = new vscode.Selection(position, endPosition);
        editor.revealRange(
            new vscode.Range(position, endPosition),
            vscode.TextEditorRevealType.InCenter
        );
        return;
    }

    // Fallback: search for the table name if no position
    if (fullName) {
        const text = sourceDocument.getText();
        const searchTerm = fullName.split('.').pop() || fullName;
        const regex = new RegExp(`\\b${escapeRegex(searchTerm)}\\b`, 'i');
        const match = regex.exec(text);

        if (match) {
            const position = sourceDocument.positionAt(match.index);
            const endPosition = sourceDocument.positionAt(match.index + match[0].length);
            editor.selection = new vscode.Selection(position, endPosition);
            editor.revealRange(
                new vscode.Range(position, endPosition),
                vscode.TextEditorRevealType.InCenter
            );
        }
    }
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** "Columns" view SVG per section, built on first request and dropped when the panel re-renders. */
const columnsSvgCache = new Map<number, Promise<string>>();

/** Answers the webview's Columns toggle: `columnsSvg` with the SVG, or `columnsError`. */
async function postColumnsSvg(queryIndex: number): Promise<void> {
    const section = currentSvgData?.[queryIndex];
    const panel = currentPanel;
    if (!section || !panel) { return; }
    if (!columnsSvgCache.has(queryIndex)) {
        columnsSvgCache.set(queryIndex, buildColumnsSvg(section));
    }
    try {
        const svg = await columnsSvgCache.get(queryIndex)!;
        await panel.webview.postMessage({ type: 'columnsSvg', queryIndex, svg });
    } catch (e: any) {
        columnsSvgCache.delete(queryIndex);
        await panel.webview.postMessage({ type: 'columnsError', queryIndex, error: e?.message ?? String(e) });
    }
}

async function buildColumnsSvg(section: LineageSection): Promise<string> {
    // Own copy: the layout writes positions and heights, the compact view keeps its own
    const graph = JSON.parse(JSON.stringify(section.queryInfo.graph)) as LineageSection['queryInfo']['graph'];
    const bqClient = await getBigQueryClient();
    const defaultProjectId = (await bqClient.getProjectId()) ?? undefined;
    await resolveLineageColumns(graph, section.queryInfo.sqlText, bigQueryColumnLookup(bqClient), defaultProjectId);
    const header = getLayoutConfig().nodeHeight;
    for (const node of graph.nodes) { node.height = columnsCardHeight(node, header); }
    const { width, height } = calculateLayout(graph);
    return renderGraphToSvg(graph, width, height);
}

