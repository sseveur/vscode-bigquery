import * as vscode from 'vscode';
import { getExtensionUri } from '../extension';
import { COMMAND_DOWNLOAD_CSV, COMMAND_DOWNLOAD_JSONL, COMMAND_SEND_PUBSUB, COMMAND_COPY_CLIPBOARD } from '../extensionCommands';
import { ResultsGridRenderRequestV2 } from './resultsGridRenderRequestV2';

export class ResultsGridRender {

    private webViewPanel: vscode.WebviewPanel;

    constructor(webViewPanel: vscode.WebviewPanel) {
        this.webViewPanel = webViewPanel;
    }

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
            if (!cssVar || typeof v !== 'string') { continue; }
            const raw = v.trim();
            if (!raw) { continue; }
            if (raw.length > 80) { continue; }
            if (!/^[A-Za-z0-9 ,.()%#\-]+$/.test(raw)) { continue; }
            lines.push(`${cssVar}: ${raw};`);
        }
        return lines.length ? `:root { ${lines.join(' ')} }` : '';
    }

    private buildHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
        const gridJs = this.getUri(webview, extensionUri, ['resources', 'grid-v2.js']);
        const gridCss = this.getUri(webview, extensionUri, ['resources', 'grid-v2.css']);
        const colorOverrides = this.buildGridColorOverrides();
        const nonce = this.makeNonce();
        const csp = [
            "default-src 'none'",
            `style-src ${webview.cspSource} 'nonce-${nonce}'`,
            `script-src ${webview.cspSource}`,
            `connect-src ${webview.cspSource} https://bigquery.googleapis.com`,
            `img-src ${webview.cspSource} data:`,
            `font-src ${webview.cspSource}`,
        ].join('; ');
        return `<!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="${csp}">
                <link rel="stylesheet" href="${gridCss}">
                ${colorOverrides ? `<style nonce="${nonce}">${colorOverrides}</style>` : ''}
            </head>
            <body>
                <div id="q1"></div>
                <script src="${gridJs}"></script>
            </body>
        </html>`;
    }

    private makeNonce(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let s = '';
        for (let i = 0; i < 32; i++) { s += chars[Math.floor(Math.random() * chars.length)]; }
        return s;
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
