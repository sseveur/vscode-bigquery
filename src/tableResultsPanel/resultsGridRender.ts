import * as vscode from 'vscode';
import { getExtensionUri } from '../extension';
import { COMMAND_DOWNLOAD_CSV, COMMAND_DOWNLOAD_JSONL, COMMAND_SEND_PUBSUB, COMMAND_COPY_CLIPBOARD } from '../extensionCommands';
import { ResultsGridRenderRequestV2 } from './resultsGridRenderRequestV2';

//https://github.com/microsoft/vscode-webview-ui-toolkit/blob/main/docs/getting-started.md

export class ResultsGridRender {

    private webViewPanel: vscode.WebviewPanel;

    constructor(webViewPanel: vscode.WebviewPanel) {
        this.webViewPanel = webViewPanel;
        // const listener = this.webViewPanel.webview.onDidReceiveMessage(this.listenerResultsOnDidReceiveMessage, this);
        // webViewPanel.onDidDispose(c => { listener.dispose(); });
    }

    // public renderLoadingIcon() {
    //     this.webViewPanel.webview.html = this.getWaitingHtml(50, false, 0, 0);
    // }

    public static executeCommand(c: any) {
        if ((c as any).command) {
            const command = (c as any).command;
            const data = {
                tableReference: (c as any).table_reference,
                jobReference: (c as any).job_reference,
                command: command,
            };

            switch (command) {
                case "download_csv": { vscode.commands.executeCommand(COMMAND_DOWNLOAD_CSV, data); break; }
                case "download_jsonl": { vscode.commands.executeCommand(COMMAND_DOWNLOAD_JSONL, data); break; }
                case "send_pubsub": { vscode.commands.executeCommand(COMMAND_SEND_PUBSUB, data); break; }
                case "copy_to_clipboard": { vscode.commands.executeCommand(COMMAND_COPY_CLIPBOARD, data); break; }
            }
        }
    }

    private isExperimentalGridEnabled(): boolean {
        return vscode.workspace
            .getConfiguration('vscode-bigquery')
            .get<boolean>('experimentalGrid', false);
    }

    private buildGridColorOverrides(): string {
        const cfg = vscode.workspace.getConfiguration('vscode-bigquery').get<Record<string, string>>('gridColors', {});
        if (!cfg || typeof cfg !== 'object') { return ''; }
        const keyToVar: Record<string, string> = {
            number: '--bq-color-number',
            boolean: '--bq-color-boolean',
            timestamp: '--bq-color-timestamp',
            struct: '--bq-color-struct',
            bytes: '--bq-color-bytes',
            string: '--bq-color-string',
            null: '--bq-color-null',
        };
        const lines: string[] = [];
        for (const [k, v] of Object.entries(cfg)) {
            const cssVar = keyToVar[k];
            if (!cssVar || typeof v !== 'string' || !v.trim()) { continue; }
            const sanitized = v.replace(/[<>]/g, '');
            lines.push(`${cssVar}: ${sanitized};`);
        }
        return lines.length ? `:root { ${lines.join(' ')} }` : '';
    }

    private buildHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
        const useV2 = this.isExperimentalGridEnabled();
        if (useV2) {
            const gridJs = this.getUri(webview, extensionUri, ['resources', 'grid-v2.js']);
            const gridCss = this.getUri(webview, extensionUri, ['resources', 'grid-v2.css']);
            const colorOverrides = this.buildGridColorOverrides();
            return `<!DOCTYPE html>
            <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <link rel="stylesheet" href="${gridCss}">
                    ${colorOverrides ? `<style>${colorOverrides}</style>` : ''}
                </head>
                <body>
                    <div id="q1"></div>
                    <script src="${gridJs}"></script>
                </body>
            </html>`;
        }

        const gridJs = this.getUri(webview, extensionUri, ['resources', 'grid.js']);
        const gridCss = this.getUri(webview, extensionUri, ['resources', 'grid.css']);
        const gridRenderWasm = this.getUri(webview, extensionUri, ['resources', 'grid_render_bg.wasm']);
        return `<!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <link rel="stylesheet" href="${gridCss}">
                <script>
                    const vscode = acquireVsCodeApi();
                    window.GRID_RENDER_WASM_URL = '${gridRenderWasm}';
                </script>
            </head>
            <body style="padding:0;">
                <div id="q1"></div>
                <script type="module" src="${gridJs}"></script>
                <script>
                    vscode.postMessage({command:'load_complete'});
                </script>
            </body>
        </html>`;
    }

    public render1(): Promise<boolean> {

        const extensionUri = getExtensionUri();

        return new Promise((resolve, reject) => {

            const timer = setTimeout(() => {
                reject(null);
            }, 10 * 1000);

            this.webViewPanel.webview.onDidReceiveMessage(c => {
                if ((c as any).command === 'load_complete') {
                    clearTimeout(timer);
                    resolve(true);
                } else {
                    ResultsGridRender.executeCommand(c);
                }
            });

            this.webViewPanel.webview.html = this.buildHtml(this.webViewPanel.webview, extensionUri);
        });
    }

    public render2() {

        const extensionUri = getExtensionUri();

        this.webViewPanel.webview.onDidReceiveMessage(c => {
            if ((c as any).command !== 'load_complete') {
                ResultsGridRender.executeCommand(c);
            }
        });

        this.webViewPanel.webview.html = this.buildHtml(this.webViewPanel.webview, extensionUri);
    }

    public postMessage(message: ResultsGridRenderRequestV2): Thenable<boolean> {
        return this.webViewPanel.webview.postMessage(message);
    }

    private getUri(webview: vscode.Webview, extensionUri: vscode.Uri, pathList: string[]) {
        return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, ...pathList));
    }

    reveal(viewColumn?: vscode.ViewColumn, preserveFocus?: boolean): void {
        this.webViewPanel.reveal(viewColumn, preserveFocus);
    }

}