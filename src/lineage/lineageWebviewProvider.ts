import * as vscode from 'vscode';
import { LineageGraph, MultiLineageResult, QueryLineageInfo } from '../services/lineageGraph';
import { calculateLayout } from './dagLayout';
import { renderGraphToSvg, getGraphStyles, renderLegend } from './svgRenderer';
import { LineageExportService } from './lineageExportService';

const VIEW_TYPE = 'bigquery-lineage';

let currentPanel: vscode.WebviewPanel | undefined;
let messageHandlerDisposable: vscode.Disposable | undefined;
let configChangeDisposable: vscode.Disposable | undefined;
let sourceDocument: vscode.TextDocument | undefined;

// Store SVG strings for export functionality
let currentSvgData: Array<{
    svg: string;
    queryInfo?: QueryLineageInfo;
}> | null = null;

export function showLineagePanel(graph: LineageGraph, context: vscode.ExtensionContext): void {
    const column = vscode.ViewColumn.Beside;

    // Store reference to the source document before panel takes focus
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        sourceDocument = editor.document;
    }

    // If panel already exists, reveal and update it
    if (currentPanel) {
        currentPanel.reveal(column);
        updatePanelContent(currentPanel, graph);
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

    updatePanelContent(currentPanel, graph);

    // Handle messages from webview
    messageHandlerDisposable = currentPanel.webview.onDidReceiveMessage(message => {
        if (message.type === 'navigate') {
            navigateToPosition(message.line, message.column, message.fullName);
        } else if (message.type === 'exportPngData') {
            handleExportPngData(message);
        } else if (message.type === 'exportAllPngData') {
            handleExportAllPngData(message);
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
        updateMultiPanelContent(currentPanel, result);
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

    updateMultiPanelContent(currentPanel, result);

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

function updateMultiPanelContent(panel: vscode.WebviewPanel, result: MultiLineageResult): void {
    // Filter to queries with lineage
    const queriesWithLineage = result.queries.filter(q => q.graph.nodes.length > 0);

    // Store SVGs for export
    currentSvgData = queriesWithLineage.map(queryInfo => {
        const layoutResult = calculateLayout(queryInfo.graph);
        const { width, height } = layoutResult;
        const svgContent = renderGraphToSvg(queryInfo.graph, width, height);
        return { svg: svgContent, queryInfo };
    });

    panel.webview.html = getMultiQueryHtmlContent(result);
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
    const filename = generateExportFilename(message.format, queryIndex, lineRange);

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
 * Generate export filename with timestamp and optional query info
 */
function generateExportFilename(
    format: 'png' | 'pdf',
    queryIndex?: number,
    lineRange?: string
): string {
    const date = new Date();
    const timestamp =
        `${date.getFullYear()}` +
        `${String(date.getMonth() + 1).padStart(2, '0')}` +
        `${String(date.getDate()).padStart(2, '0')}_` +
        `${String(date.getHours()).padStart(2, '0')}` +
        `${String(date.getMinutes()).padStart(2, '0')}` +
        `${String(date.getSeconds()).padStart(2, '0')}`;

    if (queryIndex !== undefined) {
        const lineRangePart = lineRange ? `_lines${lineRange}` : '';
        return `lineage_query${queryIndex + 1}${lineRangePart}_${timestamp}.${format}`;
    }

    return `lineage_query_${timestamp}.${format}`;
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

function updatePanelContent(panel: vscode.WebviewPanel, graph: LineageGraph): void {
    // Calculate layout and render SVG
    const layoutResult = calculateLayout(graph);
    const { width, height } = layoutResult;
    const svgContent = renderGraphToSvg(graph, width, height);

    // Store SVG for export
    currentSvgData = [{ svg: svgContent }];

    panel.webview.html = getHtmlContent(graph);
}

function getHtmlContent(graph: LineageGraph): string {
    // Calculate layout positions
    const layoutResult = calculateLayout(graph);
    const { width, height } = layoutResult;

    // Render SVG
    const svgContent = renderGraphToSvg(graph, width, height);
    const styles = getGraphStyles();
    const legend = renderLegend();

    // Count nodes by type
    const sourceCount = graph.nodes.filter(n => n.nodeType === 'SOURCE').length;
    const cteCount = graph.nodes.filter(n => n.nodeType === 'CTE').length;
    const targetCount = graph.nodes.filter(n => n.nodeType === 'TARGET').length;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Data Lineage</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 20px;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .header-left {
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .header h2 {
            margin: 0;
            font-size: 16px;
            font-weight: 600;
        }

        .zoom-controls {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .zoom-btn {
            width: 28px;
            height: 28px;
            border: 1px solid var(--vscode-button-secondaryBackground);
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .zoom-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .zoom-level {
            min-width: 45px;
            text-align: center;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }

        .export-controls {
            display: flex;
            align-items: center;
            gap: 4px;
            margin-left: 12px;
        }

        .export-btn {
            height: 28px;
            padding: 0 12px;
            border: 1px solid var(--vscode-button-secondaryBackground);
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            white-space: nowrap;
        }

        .export-btn:hover:not(:disabled) {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .export-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .legend {
            display: flex;
            gap: 16px;
            font-size: 11px;
        }

        .legend-item {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .legend-color {
            width: 12px;
            height: 12px;
            border-radius: 3px;
        }

        .graph-container {
            overflow: auto;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            background-color: var(--vscode-editor-background);
            min-height: 250px;
            max-height: calc(100vh - 220px);
        }

        .graph-wrapper {
            transform-origin: top left;
            transition: transform 0.1s ease-out;
        }

        ${styles}

        .query-preview {
            margin-top: 20px;
            padding: 12px 16px;
            background-color: var(--vscode-textBlockQuote-background);
            border-left: 3px solid var(--vscode-textBlockQuote-border);
            border-radius: 4px;
        }

        .query-preview-label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 6px;
        }

        .query-preview-text {
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
            white-space: pre-wrap;
            word-break: break-all;
            color: var(--vscode-foreground);
        }

        .summary {
            margin-top: 16px;
            padding: 10px 14px;
            background-color: var(--vscode-inputValidation-infoBackground);
            border: 1px solid var(--vscode-inputValidation-infoBorder);
            border-radius: 4px;
            font-size: 12px;
            display: flex;
            gap: 16px;
        }

        .summary-item {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .summary-item strong {
            font-weight: 600;
        }

        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 200px;
            color: var(--vscode-descriptionForeground);
        }

        .empty-state-icon {
            font-size: 48px;
            margin-bottom: 12px;
            opacity: 0.5;
        }

        .empty-state-text {
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-left">
            <h2>Data Lineage</h2>
            <div class="zoom-controls">
                <button class="zoom-btn" id="zoom-out" title="Zoom out">−</button>
                <span class="zoom-level" id="zoom-level">100%</span>
                <button class="zoom-btn" id="zoom-in" title="Zoom in">+</button>
                <button class="zoom-btn" id="zoom-reset" title="Reset zoom">⟲</button>
            </div>
            <div class="export-controls">
                <button class="export-btn" id="export-png" title="Download as PNG"${graph.nodes.length === 0 ? ' disabled' : ''}>↓ PNG</button>
                <button class="export-btn" id="export-pdf" title="Download as PDF"${graph.nodes.length === 0 ? ' disabled' : ''}>↓ PDF</button>
            </div>
        </div>
        ${legend}
    </div>

    <div class="graph-container" id="graph-container">
        ${graph.nodes.length > 0 ? `<div class="graph-wrapper" id="graph-wrapper">${svgContent}</div>` : `
            <div class="empty-state">
                <div class="empty-state-icon">&#128269;</div>
                <div class="empty-state-text">No table references detected in query</div>
            </div>
        `}
    </div>

    <div class="query-preview">
        <div class="query-preview-label">Query Preview</div>
        <div class="query-preview-text">${escapeHtml(graph.queryPreview)}</div>
    </div>

    <div class="summary">
        <div class="summary-item">
            <strong>${sourceCount}</strong> source${sourceCount !== 1 ? 's' : ''}
        </div>
        ${cteCount > 0 ? `
        <div class="summary-item">
            <strong>${cteCount}</strong> CTE${cteCount !== 1 ? 's' : ''}
        </div>
        ` : ''}
        ${targetCount > 0 ? `
        <div class="summary-item">
            <strong>${targetCount}</strong> target${targetCount !== 1 ? 's' : ''}
        </div>
        ` : ''}
    </div>

    <script>
        (function() {
            // Acquire VS Code API
            const vscode = acquireVsCodeApi();

            // Export theme from extension settings
            var exportTheme = '${vscode.workspace.getConfiguration('vscode-bigquery').get<string>('lineageExportTheme', 'dark')}';

            // Listen for theme changes from extension host
            window.addEventListener('message', function(event) {
                if (event.data && event.data.type === 'themeChanged') {
                    exportTheme = event.data.theme;
                }
            });

            let scale = 1;
            const minScale = 0.25;
            const maxScale = 2;
            const step = 0.25;

            const wrapper = document.getElementById('graph-wrapper');
            const levelDisplay = document.getElementById('zoom-level');
            const container = document.getElementById('graph-container');

            function updateZoom() {
                if (wrapper) {
                    wrapper.style.transform = 'scale(' + scale + ')';
                    levelDisplay.textContent = Math.round(scale * 100) + '%';
                }
            }

            document.getElementById('zoom-in').addEventListener('click', function() {
                if (scale < maxScale) {
                    scale = Math.min(maxScale, scale + step);
                    updateZoom();
                }
            });

            document.getElementById('zoom-out').addEventListener('click', function() {
                if (scale > minScale) {
                    scale = Math.max(minScale, scale - step);
                    updateZoom();
                }
            });

            document.getElementById('zoom-reset').addEventListener('click', function() {
                scale = 1;
                updateZoom();
            });

            // Mouse wheel zoom
            if (container) {
                container.addEventListener('wheel', function(e) {
                    if (e.ctrlKey) {
                        e.preventDefault();
                        if (e.deltaY < 0 && scale < maxScale) {
                            scale = Math.min(maxScale, scale + step);
                        } else if (e.deltaY > 0 && scale > minScale) {
                            scale = Math.max(minScale, scale - step);
                        }
                        updateZoom();
                    }
                }, { passive: false });
            }

            // Click handler for nodes - navigate to source position
            document.querySelectorAll('.node').forEach(function(node) {
                node.style.cursor = 'pointer';
                node.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const line = parseInt(this.getAttribute('data-line')) || null;
                    const column = parseInt(this.getAttribute('data-column')) || null;
                    const fullName = this.getAttribute('data-fullname') || '';

                    vscode.postMessage({
                        type: 'navigate',
                        line: line,
                        column: column,
                        fullName: fullName
                    });
                });
            });

            // Color maps for export themes
            var darkColorMap = {
                '--vscode-editor-background': '#1e1e1e',
                '--vscode-foreground': '#cccccc',
                '--vscode-descriptionForeground': '#888888',
                '--vscode-panel-border': '#3e3e3e',
                '--vscode-sideBar-background': '#252526',
                '--vscode-list-hoverBackground': '#2a2d2e'
            };
            var lightColorMap = {
                '--vscode-editor-background': '#ffffff',
                '--vscode-foreground': '#000000',
                '--vscode-descriptionForeground': '#666666',
                '--vscode-panel-border': '#d0d0d0',
                '--vscode-sideBar-background': '#f3f3f3',
                '--vscode-list-hoverBackground': '#e8e8e8'
            };

            function resolveThemeColor(varName, fallback) {
                var colorMap = exportTheme === 'light' ? lightColorMap : darkColorMap;
                var key = '--' + varName;
                if (colorMap[key]) return colorMap[key];
                // Try computed style as last resort
                var value = getComputedStyle(document.documentElement).getPropertyValue(key).trim();
                return value || (fallback ? fallback.trim() : '');
            }

            // SVG to PNG conversion using Canvas API
            function svgToPngBase64(svgElement, scale) {
                scale = scale || 2;
                return new Promise(function(resolve, reject) {
                    var serializer = new XMLSerializer();
                    var svgStr = serializer.serializeToString(svgElement);

                    // Replace CSS variables with theme-appropriate colors
                    svgStr = svgStr.replace(/var\(--([^,)]+)(?:,\s*([^)]+))?\)/g, function(match, varName, fallback) {
                        var resolved = resolveThemeColor(varName.trim(), fallback);
                        return resolved || match;
                    });

                    // Set background color based on export theme
                    var bgColor = exportTheme === 'light' ? '#ffffff' : '#1e1e1e';

                    var blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
                    var url = URL.createObjectURL(blob);
                    var img = new Image();

                    img.onload = function() {
                        var canvas = document.createElement('canvas');
                        canvas.width = img.naturalWidth * scale;
                        canvas.height = img.naturalHeight * scale;
                        var ctx = canvas.getContext('2d');
                        ctx.fillStyle = bgColor;
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.scale(scale, scale);
                        ctx.drawImage(img, 0, 0);
                        URL.revokeObjectURL(url);
                        resolve({
                            dataUrl: canvas.toDataURL('image/png'),
                            width: img.naturalWidth,
                            height: img.naturalHeight
                        });
                    };

                    img.onerror = function() {
                        URL.revokeObjectURL(url);
                        reject(new Error('Failed to render SVG to image'));
                    };

                    img.src = url;
                });
            }

            // Export button handlers
            var exportPngBtn = document.getElementById('export-png');
            var exportPdfBtn = document.getElementById('export-pdf');

            function handleExport(format) {
                var svg = document.querySelector('.graph-wrapper svg');
                if (!svg) return;
                svgToPngBase64(svg).then(function(result) {
                    vscode.postMessage({
                        type: 'exportPngData',
                        format: format,
                        pngBase64: result.dataUrl,
                        width: result.width,
                        height: result.height
                    });
                }).catch(function(err) {
                    vscode.postMessage({ type: 'exportError', error: err.message });
                });
            }

            if (exportPngBtn) {
                exportPngBtn.addEventListener('click', function() { handleExport('png'); });
            }

            if (exportPdfBtn) {
                exportPdfBtn.addEventListener('click', function() { handleExport('pdf'); });
            }
        })();
    </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Generate HTML content for multi-query lineage view
 */
function getMultiQueryHtmlContent(result: MultiLineageResult): string {
    const styles = getGraphStyles();
    const legend = renderLegend();

    // Filter to only queries with lineage data
    const queriesWithLineage = result.queries.filter(q => q.graph.nodes.length > 0);

    // Build sections for each query
    const querySections = queriesWithLineage
        .map((queryInfo, displayIndex) => renderQuerySection(queryInfo, displayIndex))
        .join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Data Lineage</title>
    <style>
        @font-face {
            font-family: 'codicon';
            src: url('https://microsoft.github.io/vscode-codicons/dist/codicon.ttf') format('truetype');
        }
        .codicon {
            font-family: 'codicon';
            font-size: 16px;
            line-height: 1;
            display: inline-block;
        }
        .codicon-chevron-down:before { content: "\\eab4"; }
        .codicon-chevron-right:before { content: "\\eab6"; }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 20px;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
            position: sticky;
            top: 0;
            background-color: var(--vscode-editor-background);
            z-index: 100;
        }

        .header-left {
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .header h2 {
            margin: 0;
            font-size: 16px;
            font-weight: 600;
        }

        .query-count {
            font-size: 12px;
            padding: 4px 8px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            border-radius: 10px;
        }

        .queries-container {
            display: flex;
            flex-direction: column;
            gap: 24px;
            overflow-y: auto;
            flex: 1;
            padding-bottom: 40px;
        }

        .query-section {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            max-height: 500px;
        }

        .query-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            background-color: var(--vscode-sideBar-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            cursor: pointer;
        }

        .query-header:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .query-title {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .query-number {
            font-size: 11px;
            font-weight: 600;
            padding: 2px 8px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            border-radius: 4px;
        }

        .query-lines {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }

        .query-preview-text {
            font-family: var(--vscode-editor-font-family);
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            max-width: 400px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .query-stats {
            display: flex;
            gap: 12px;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }

        .query-body {
            padding: 16px;
            flex: 1;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
        }

        .query-section.collapsed .query-body {
            display: none;
        }

        .query-section.collapsed .query-header {
            border-bottom: none;
        }

        .collapse-toggle {
            width: 20px;
            height: 20px;
            border: none;
            background: transparent;
            color: var(--vscode-foreground);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            margin-right: 4px;
            border-radius: 3px;
        }

        .collapse-toggle:hover {
            background: var(--vscode-toolbar-hoverBackground);
        }

        .collapse-toggle .codicon {
            font-size: 14px;
        }

        .graph-container {
            overflow: auto;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            background-color: var(--vscode-editor-background);
            min-height: 300px;
            flex: 1;
        }

        .graph-wrapper {
            transform-origin: top left;
        }

        .section-controls {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 8px;
        }

        .zoom-controls {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .zoom-btn {
            width: 24px;
            height: 24px;
            border: 1px solid var(--vscode-button-secondaryBackground);
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .zoom-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .zoom-level {
            min-width: 40px;
            text-align: center;
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
        }

        .export-controls {
            display: flex;
            align-items: center;
            gap: 4px;
            margin-left: 12px;
        }

        .export-btn {
            height: 24px;
            padding: 0 10px;
            border: 1px solid var(--vscode-button-secondaryBackground);
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
            display: flex;
            align-items: center;
            justify-content: center;
            white-space: nowrap;
        }

        .export-btn:hover:not(:disabled) {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .export-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .query-actions {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .export-btn-small {
            height: 22px;
            padding: 0 8px;
            border: 1px solid var(--vscode-button-secondaryBackground);
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border-radius: 3px;
            cursor: pointer;
            font-size: 10px;
            text-transform: uppercase;
            font-weight: 600;
            white-space: nowrap;
        }

        .export-btn-small:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        ${styles}

        .legend {
            display: flex;
            gap: 16px;
            font-size: 11px;
        }

        .legend-item {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .legend-color {
            width: 12px;
            height: 12px;
            border-radius: 3px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-left">
            <h2>Data Lineage</h2>
            <span class="query-count">${queriesWithLineage.length} ${queriesWithLineage.length === 1 ? 'query' : 'queries'} with lineage</span>
            <div class="export-controls">
                <button class="export-btn" id="export-all-png" title="Download all as separate PNG files">↓ All PNG</button>
                <button class="export-btn" id="export-all-pdf" title="Download all as multi-page PDF">↓ All PDF</button>
            </div>
        </div>
        ${legend}
    </div>

    <div class="queries-container">
        ${querySections}
    </div>

    <script>
        (function() {
            const vscode = acquireVsCodeApi();

            // Export theme from extension settings
            var exportTheme = '${vscode.workspace.getConfiguration('vscode-bigquery').get<string>('lineageExportTheme', 'dark')}';

            // Listen for theme changes from extension host
            window.addEventListener('message', function(event) {
                if (event.data && event.data.type === 'themeChanged') {
                    exportTheme = event.data.theme;
                }
            });

            // Per-section zoom state
            const zoomStates = {};

            // Initialize zoom for each section
            document.querySelectorAll('.query-section').forEach((section, index) => {
                zoomStates[index] = 1;

                const wrapper = section.querySelector('.graph-wrapper');
                const levelDisplay = section.querySelector('.zoom-level');
                const container = section.querySelector('.graph-container');

                function updateZoom() {
                    if (wrapper) {
                        wrapper.style.transform = 'scale(' + zoomStates[index] + ')';
                        levelDisplay.textContent = Math.round(zoomStates[index] * 100) + '%';
                    }
                }

                section.querySelector('.zoom-in')?.addEventListener('click', function(e) {
                    e.stopPropagation();
                    if (zoomStates[index] < 2) {
                        zoomStates[index] = Math.min(2, zoomStates[index] + 0.25);
                        updateZoom();
                    }
                });

                section.querySelector('.zoom-out')?.addEventListener('click', function(e) {
                    e.stopPropagation();
                    if (zoomStates[index] > 0.25) {
                        zoomStates[index] = Math.max(0.25, zoomStates[index] - 0.25);
                        updateZoom();
                    }
                });

                section.querySelector('.zoom-reset')?.addEventListener('click', function(e) {
                    e.stopPropagation();
                    zoomStates[index] = 1;
                    updateZoom();
                });

                // Mouse wheel zoom
                if (container) {
                    container.addEventListener('wheel', function(e) {
                        if (e.ctrlKey) {
                            e.preventDefault();
                            if (e.deltaY < 0 && zoomStates[index] < 2) {
                                zoomStates[index] = Math.min(2, zoomStates[index] + 0.25);
                            } else if (e.deltaY > 0 && zoomStates[index] > 0.25) {
                                zoomStates[index] = Math.max(0.25, zoomStates[index] - 0.25);
                            }
                            updateZoom();
                        }
                    }, { passive: false });
                }
            });

            // Click handler for collapse toggle buttons
            document.querySelectorAll('.collapse-toggle').forEach(function(toggle) {
                toggle.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const section = this.closest('.query-section');
                    if (section) {
                        section.classList.toggle('collapsed');
                        const icon = this.querySelector('.codicon');
                        if (icon) {
                            if (section.classList.contains('collapsed')) {
                                icon.classList.remove('codicon-chevron-down');
                                icon.classList.add('codicon-chevron-right');
                            } else {
                                icon.classList.remove('codicon-chevron-right');
                                icon.classList.add('codicon-chevron-down');
                            }
                        }
                    }
                });
            });

            // Click handler for nodes - navigate to source position
            document.querySelectorAll('.node').forEach(function(node) {
                node.style.cursor = 'pointer';
                node.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const line = parseInt(this.getAttribute('data-line')) || null;
                    const column = parseInt(this.getAttribute('data-column')) || null;
                    const fullName = this.getAttribute('data-fullname') || '';

                    vscode.postMessage({
                        type: 'navigate',
                        line: line,
                        column: column,
                        fullName: fullName
                    });
                });
            });

            // Click handler for query headers - navigate to query start
            document.querySelectorAll('.query-header').forEach(function(header) {
                header.addEventListener('click', function(e) {
                    // Don't trigger if clicking on zoom controls, collapse toggle, or export buttons
                    if (e.target.closest('.zoom-controls')) return;
                    if (e.target.closest('.collapse-toggle')) return;
                    if (e.target.closest('.export-btn-small')) return;
                    if (e.target.closest('.export-btn')) return;

                    const line = parseInt(this.getAttribute('data-start-line')) || 1;
                    vscode.postMessage({
                        type: 'scrollToQuery',
                        line: line
                    });
                });
            });

            // Color maps for export themes
            var darkColorMap = {
                '--vscode-editor-background': '#1e1e1e',
                '--vscode-foreground': '#cccccc',
                '--vscode-descriptionForeground': '#888888',
                '--vscode-panel-border': '#3e3e3e',
                '--vscode-sideBar-background': '#252526',
                '--vscode-list-hoverBackground': '#2a2d2e'
            };
            var lightColorMap = {
                '--vscode-editor-background': '#ffffff',
                '--vscode-foreground': '#000000',
                '--vscode-descriptionForeground': '#666666',
                '--vscode-panel-border': '#d0d0d0',
                '--vscode-sideBar-background': '#f3f3f3',
                '--vscode-list-hoverBackground': '#e8e8e8'
            };

            function resolveThemeColor(varName, fallback) {
                var colorMap = exportTheme === 'light' ? lightColorMap : darkColorMap;
                var key = '--' + varName;
                if (colorMap[key]) return colorMap[key];
                var value = getComputedStyle(document.documentElement).getPropertyValue(key).trim();
                return value || (fallback ? fallback.trim() : '');
            }

            // SVG to PNG conversion using Canvas API
            function svgToPngBase64(svgElement, scale) {
                scale = scale || 2;
                return new Promise(function(resolve, reject) {
                    var serializer = new XMLSerializer();
                    var svgStr = serializer.serializeToString(svgElement);

                    svgStr = svgStr.replace(/var\(--([^,)]+)(?:,\s*([^)]+))?\)/g, function(match, varName, fallback) {
                        var resolved = resolveThemeColor(varName.trim(), fallback);
                        return resolved || match;
                    });

                    var bgColor = exportTheme === 'light' ? '#ffffff' : '#1e1e1e';

                    var blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
                    var url = URL.createObjectURL(blob);
                    var img = new Image();

                    img.onload = function() {
                        var canvas = document.createElement('canvas');
                        canvas.width = img.naturalWidth * scale;
                        canvas.height = img.naturalHeight * scale;
                        var ctx = canvas.getContext('2d');
                        ctx.fillStyle = bgColor;
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.scale(scale, scale);
                        ctx.drawImage(img, 0, 0);
                        URL.revokeObjectURL(url);
                        resolve({
                            dataUrl: canvas.toDataURL('image/png'),
                            width: img.naturalWidth,
                            height: img.naturalHeight
                        });
                    };

                    img.onerror = function() {
                        URL.revokeObjectURL(url);
                        reject(new Error('Failed to render SVG to image'));
                    };

                    img.src = url;
                });
            }

            // Export all buttons
            function handleExportAll(format) {
                var sections = document.querySelectorAll('.query-section');
                var promises = [];
                sections.forEach(function(section) {
                    var svg = section.querySelector('.graph-wrapper svg');
                    var queryIndex = parseInt(section.getAttribute('data-query-index'));
                    if (svg && !isNaN(queryIndex)) {
                        promises.push(svgToPngBase64(svg).then(function(result) {
                            return { pngBase64: result.dataUrl, width: result.width, height: result.height, queryIndex: queryIndex };
                        }));
                    }
                });
                Promise.all(promises).then(function(items) {
                    if (items.length > 0) {
                        vscode.postMessage({
                            type: 'exportAllPngData',
                            format: format,
                            items: items
                        });
                    }
                }).catch(function(err) {
                    vscode.postMessage({ type: 'exportError', error: err.message });
                });
            }

            document.getElementById('export-all-png')?.addEventListener('click', function() {
                handleExportAll('png');
            });

            document.getElementById('export-all-pdf')?.addEventListener('click', function() {
                handleExportAll('pdf');
            });

            // Per-query export buttons
            document.querySelectorAll('.export-btn-small').forEach(function(btn) {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var queryIndex = parseInt(this.getAttribute('data-query-index'));
                    var format = this.getAttribute('data-format');
                    var section = this.closest('.query-section');
                    var svg = section ? section.querySelector('.graph-wrapper svg') : null;
                    if (!svg) return;
                    svgToPngBase64(svg).then(function(result) {
                        vscode.postMessage({
                            type: 'exportPngData',
                            format: format,
                            pngBase64: result.dataUrl,
                            width: result.width,
                            height: result.height,
                            queryIndex: queryIndex
                        });
                    }).catch(function(err) {
                        vscode.postMessage({ type: 'exportError', error: err.message });
                    });
                });
            });
        })();
    </script>
</body>
</html>`;
}

/**
 * Render a single query section with its lineage graph
 */
function renderQuerySection(queryInfo: QueryLineageInfo, displayIndex: number): string {
    const { graph, startLine, endLine, sqlText } = queryInfo;

    // Calculate layout for this graph
    const layoutResult = calculateLayout(graph);
    const { width, height } = layoutResult;

    // Render SVG
    const svgContent = renderGraphToSvg(graph, width, height);

    // Count nodes by type
    const sourceCount = graph.nodes.filter(n => n.nodeType === 'SOURCE').length;
    const cteCount = graph.nodes.filter(n => n.nodeType === 'CTE').length;
    const targetCount = graph.nodes.filter(n => n.nodeType === 'TARGET').length;

    // Create query preview (first 80 chars)
    const preview = sqlText.replace(/\s+/g, ' ').trim().substring(0, 80);
    const previewDisplay = preview + (sqlText.length > 80 ? '...' : '');

    return `
        <div class="query-section" data-query-index="${displayIndex}">
            <div class="query-header" data-start-line="${startLine}">
                <div class="query-title">
                    <button class="collapse-toggle" title="Collapse/Expand">
                        <span class="codicon codicon-chevron-down"></span>
                    </button>
                    <span class="query-number">Query ${displayIndex + 1}</span>
                    <span class="query-lines">Lines ${startLine}-${endLine}</span>
                    <span class="query-preview-text">${escapeHtml(previewDisplay)}</span>
                </div>
                <div class="query-actions">
                    <button class="export-btn-small" data-query-index="${displayIndex}" data-format="png" title="Download PNG">PNG</button>
                    <button class="export-btn-small" data-query-index="${displayIndex}" data-format="pdf" title="Download PDF">PDF</button>
                    <div class="query-stats">
                        <span>${sourceCount} source${sourceCount !== 1 ? 's' : ''}</span>
                        ${cteCount > 0 ? `<span>${cteCount} CTE${cteCount !== 1 ? 's' : ''}</span>` : ''}
                        ${targetCount > 0 ? `<span>${targetCount} target${targetCount !== 1 ? 's' : ''}</span>` : ''}
                    </div>
                </div>
            </div>
            <div class="query-body">
                <div class="section-controls">
                    <div class="zoom-controls">
                        <button class="zoom-btn zoom-out" title="Zoom out">-</button>
                        <span class="zoom-level">100%</span>
                        <button class="zoom-btn zoom-in" title="Zoom in">+</button>
                        <button class="zoom-btn zoom-reset" title="Reset zoom">R</button>
                    </div>
                </div>
                <div class="graph-container">
                    <div class="graph-wrapper">${svgContent}</div>
                </div>
            </div>
        </div>
    `;
}
