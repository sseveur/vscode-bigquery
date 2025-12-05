import * as vscode from 'vscode';
import { getExtensionUri } from '../extension';
import { SimpleQueryRowsResponseError } from '../services/simpleQueryRowsResponseError';
import { TableMetadata } from '../services/tableMetadata';
// import { SchemaGrid } from './schemaGrid.ts';

//https://github.com/microsoft/vscode-webview-ui-toolkit/blob/main/docs/getting-started.md

export class SchemaRender {

    private webView: vscode.Webview;

    constructor(webView: vscode.Webview) {
        this.webView = webView;
    }

    public render(metadataPromise: Promise<any>) {

        try {

            //set waiting gif
            this.webView.html = this.getWaitingHtml();

            metadataPromise
                .then(async (metadata: TableMetadata) => {

                    const html = await this.getResultsHtml(metadata);
                    this.webView.html = html;

                })
                .catch(exception => {
                    this.webView.html = this.getExceptionHtml(exception);
                });

        } catch (error: any) {
            this.webView.html = this.getExceptionHtml(error.message);
            // vscode.window.showErrorMessage(`Unexpected error!\n${error.message}`);
        }
    }

    private getWaitingHtml(): string {

        const toolkitUri = this.getUri(this.webView, getExtensionUri(), [
            "resources",
            "toolkit.min.js",
        ]);

        return `<!DOCTYPE html>
		<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<script type="module" src="${toolkitUri}"></script>
			</head>
			<body>
                <vscode-progress-ring></vscode-progress-ring>
			</body>
		</html>`;

    }

    private getExceptionHtml(exception: any): string {

        const extensionUri = getExtensionUri();

        const toolkitUri = this.getUri(this.webView, extensionUri, [
            "resources",
            "toolkit.min.js",
        ]);

        if (exception.errors) {

            const errors = (exception as SimpleQueryRowsResponseError).errors;

            const rows = JSON.stringify(errors.map(c => (
                {
                    "message": c.message,
                    "reason": c.reason,
                    "locationType": c.locationType
                }
            )));

            return `<!DOCTYPE html>
            <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <script type="module" src="${toolkitUri}"></script>
                </head>
                <body>
                <vscode-data-grid id="basic-grid" generate-header="sticky" aria-label="Default"></vscode-data-grid>
    
                <script>
                    document.getElementById('basic-grid').rowsData = ${rows};
                </script>
                </body>
            </html>`;

        } else {

            const rows = JSON.stringify([{ message: exception.message, stack: exception.stack }]);

            return `<!DOCTYPE html>
            <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <script type="module" src="${toolkitUri}"></script>
                </head>
                <body>
                <vscode-data-grid id="basic-grid" generate-header="sticky" aria-label="Default"></vscode-data-grid>
    
                <script>
                    document.getElementById('basic-grid').rowsData = ${rows};
                </script>
                </body>
            </html>`;

        }
    }

    private async getResultsHtml(tableMetadata: TableMetadata): Promise<string> {

        const extensionUri = getExtensionUri();

        const toolkitUri = this.getUri(this.webView, extensionUri, [
            "resources",
            "toolkit.min.js",
        ]);

        const codiconsUri = this.getUri(this.webView, extensionUri, [
            'resources',
            'codicon.css']
        );

        // Build schema fields table if available
        let schemaFieldsHtml = '';
        if (tableMetadata.schema && tableMetadata.schema.fields) {
            const fieldsRows = tableMetadata.schema.fields.map((field: any) => `
                <tr>
                    <td>${field.name}</td>
                    <td>${field.type}</td>
                    <td>${field.mode || 'NULLABLE'}</td>
                    <td>${field.description || ''}</td>
                </tr>
            `).join('');

            schemaFieldsHtml = `
                <div class="section">
                    <div class="section-title">
                        <span class="codicon codicon-symbol-field"></span>
                        Schema Fields
                    </div>
                    <table class="schema-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Type</th>
                                <th>Mode</th>
                                <th>Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${fieldsRows}
                        </tbody>
                    </table>
                </div>
            `;
        }

        return `<!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <script type="module" src="${toolkitUri}"></script>
                <link href="${codiconsUri}" rel="stylesheet" />
                <style>
                    body {
                        padding: 16px;
                        font-family: var(--vscode-font-family);
                        font-size: var(--vscode-font-size);
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-editor-background);
                    }
                    .section {
                        margin-bottom: 24px;
                    }
                    .section-title {
                        font-size: 13px;
                        font-weight: 600;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        color: var(--vscode-descriptionForeground);
                        margin-bottom: 12px;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        border-bottom: 1px solid var(--vscode-widget-border);
                        padding-bottom: 8px;
                    }
                    .info-grid {
                        display: grid;
                        grid-template-columns: 160px 1fr;
                        gap: 8px 16px;
                    }
                    .info-label {
                        font-weight: 500;
                        color: var(--vscode-descriptionForeground);
                    }
                    .info-value {
                        color: var(--vscode-foreground);
                        word-break: break-all;
                    }
                    .schema-table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 12px;
                    }
                    .schema-table th,
                    .schema-table td {
                        text-align: left;
                        padding: 8px 12px;
                        border: 1px solid var(--vscode-widget-border);
                    }
                    .schema-table th {
                        background-color: var(--vscode-editor-inactiveSelectionBackground);
                        font-weight: 600;
                    }
                    .schema-table tr:hover {
                        background-color: var(--vscode-list-hoverBackground);
                    }
                </style>
            </head>
            <body>
                <div class="section">
                    <div class="section-title">
                        <span class="codicon codicon-table"></span>
                        Table Information
                    </div>
                    <div class="info-grid">
                        <div class="info-label">Project ID</div>
                        <div class="info-value">${tableMetadata.tableReference.projectId}</div>

                        <div class="info-label">Dataset ID</div>
                        <div class="info-value">${tableMetadata.tableReference.datasetId}</div>

                        <div class="info-label">Table ID</div>
                        <div class="info-value">${tableMetadata.tableReference.tableId}</div>

                        <div class="info-label">Location</div>
                        <div class="info-value">${tableMetadata.location}</div>

                        <div class="info-label">Number of Rows</div>
                        <div class="info-value">${Number(tableMetadata.numRows).toLocaleString()}</div>

                        <div class="info-label">Creation Time</div>
                        <div class="info-value">${new Date(Number(tableMetadata.creationTime)).toLocaleString()}</div>

                        <div class="info-label">Last Modified</div>
                        <div class="info-value">${new Date(Number(tableMetadata.lastModifiedTime)).toLocaleString()}</div>
                    </div>
                </div>

                ${schemaFieldsHtml}
            </body>
        </html>`;

    }

    private getUri(webview: vscode.Webview, extensionUri: vscode.Uri, pathList: string[]) {
        return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, ...pathList));
    }

}