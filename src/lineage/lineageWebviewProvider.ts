import * as vscode from 'vscode';
import { LineageGraph } from '../services/lineageGraph';
import { calculateLayout } from './dagLayout';
import { renderGraphToSvg, getGraphStyles, renderLegend } from './svgRenderer';

const VIEW_TYPE = 'bigquery-lineage';

let currentPanel: vscode.WebviewPanel | undefined;
let messageHandlerDisposable: vscode.Disposable | undefined;
let sourceDocument: vscode.TextDocument | undefined;

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
        }
    });

    // Handle panel disposal
    currentPanel.onDidDispose(() => {
        currentPanel = undefined;
        sourceDocument = undefined;
        if (messageHandlerDisposable) {
            messageHandlerDisposable.dispose();
            messageHandlerDisposable = undefined;
        }
    });
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
