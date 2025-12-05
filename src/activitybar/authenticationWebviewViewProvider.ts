import * as vscode from 'vscode';
import { getExtensionUri } from '../extension';
import * as commands from '../extensionCommands';
import { Authentication } from '../services/authentication';
import { AuthenticationListItem } from '../services/authenticationListItem';

export class BigqueryAuthenticationWebviewViewProvider implements vscode.WebviewViewProvider {

    private disposableEvent: vscode.Disposable | null = null;
    public webviewView: vscode.WebviewView | null = null;
    private context: vscode.WebviewViewResolveContext<unknown> | null = null;
    private token: vscode.CancellationToken | null = null;

    resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext<unknown>, token: vscode.CancellationToken, forceShowConsole: boolean = false): Thenable<void> | void {

        this.webviewView = webviewView;
        this.context = context;
        this.token = token;

        webviewView.webview.options = { enableScripts: true };

        //dispose event regardless of successful query or not
        if (this.disposableEvent) { this.disposableEvent.dispose(); }

        const toolkitUri = this.getUri(webviewView.webview, getExtensionUri(), [
            'resources',
            'toolkit.min.js',
        ]);

        const codiconsUri = this.getUri(webviewView.webview, getExtensionUri(), [
            'resources',
            'codicon.css',
        ]);

        //in case that the search result needs pagination, this event is enabled
        this.disposableEvent = webviewView.webview.onDidReceiveMessage(this.listenerOnDidReceiveMessage);

        Authentication
            .list(forceShowConsole)
            .then(result => {
                webviewView.webview.html = this.getHtml(toolkitUri, codiconsUri, result);
            })
            .catch(error => {
                webviewView.webview.html = this.getErrorHtml(toolkitUri, codiconsUri, error);
            });

    }

    private getStyles(): string {
        return `
            <style>
                * {
                    box-sizing: border-box;
                }
                body {
                    padding: 0 12px 12px 12px;
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    color: var(--vscode-foreground);
                }
                .section {
                    margin-bottom: 16px;
                }
                .section-title {
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    color: var(--vscode-descriptionForeground);
                    margin-bottom: 8px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .section-title .codicon {
                    font-size: 14px;
                }
                .account-card {
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-widget-border);
                    border-radius: 6px;
                    padding: 12px;
                    margin-bottom: 8px;
                    transition: border-color 0.15s ease;
                }
                .account-card:hover {
                    border-color: var(--vscode-focusBorder);
                }
                .account-card.active {
                    border-left: 3px solid var(--vscode-charts-green);
                }
                .account-header {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 8px;
                }
                .account-avatar {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background: var(--vscode-button-secondaryBackground);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 14px;
                    color: var(--vscode-button-secondaryForeground);
                    flex-shrink: 0;
                }
                .account-info {
                    flex: 1;
                    min-width: 0;
                }
                .account-email {
                    font-size: 12px;
                    font-weight: 500;
                    color: var(--vscode-foreground);
                    word-break: break-all;
                    line-height: 1.3;
                }
                .account-status {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 10px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                    padding: 2px 6px;
                    border-radius: 3px;
                    margin-top: 4px;
                }
                .status-active {
                    background: color-mix(in srgb, var(--vscode-charts-green) 20%, transparent);
                    color: var(--vscode-charts-green);
                }
                .status-inactive {
                    background: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                }
                .account-actions {
                    display: flex;
                    gap: 6px;
                    margin-top: 10px;
                }
                .account-actions vscode-button {
                    flex: 1;
                }
                .auth-buttons {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .auth-button {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 12px;
                    background: var(--vscode-button-secondaryBackground);
                    border: 1px solid var(--vscode-widget-border);
                    border-radius: 6px;
                    color: var(--vscode-button-secondaryForeground);
                    cursor: pointer;
                    transition: all 0.15s ease;
                    font-size: 12px;
                    text-align: left;
                }
                .auth-button:hover {
                    background: var(--vscode-button-secondaryHoverBackground);
                    border-color: var(--vscode-focusBorder);
                }
                .auth-button .codicon {
                    font-size: 16px;
                    opacity: 0.8;
                }
                .auth-button-text {
                    flex: 1;
                }
                .auth-button-title {
                    font-weight: 500;
                }
                .auth-button-desc {
                    font-size: 10px;
                    opacity: 0.7;
                    margin-top: 2px;
                }
                .footer {
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                    padding-top: 12px;
                    border-top: 1px solid var(--vscode-widget-border);
                }
                .footer a {
                    color: var(--vscode-textLink-foreground);
                    text-decoration: none;
                }
                .footer a:hover {
                    text-decoration: underline;
                }
                .empty-state {
                    text-align: center;
                    padding: 20px;
                    color: var(--vscode-descriptionForeground);
                }
                .empty-state .codicon {
                    font-size: 32px;
                    margin-bottom: 8px;
                    opacity: 0.5;
                }
            </style>
        `;
    }

    private renderAccountCards(accounts: AuthenticationListItem[]): string {
        if (accounts.length === 0) {
            return `
                <div class="empty-state">
                    <div class="codicon codicon-account"></div>
                    <div>No accounts configured</div>
                </div>
            `;
        }

        return accounts.map(account => {
            const isActive = account.status === 'ACTIVE';
            const initial = account.account.charAt(0).toUpperCase();

            return `
                <div class="account-card ${isActive ? 'active' : ''}">
                    <div class="account-header">
                        <div class="account-avatar">
                            <span class="codicon codicon-account"></span>
                        </div>
                        <div class="account-info">
                            <div class="account-email">${account.account}</div>
                            <div class="account-status ${isActive ? 'status-active' : 'status-inactive'}">
                                <span class="codicon codicon-${isActive ? 'verified-filled' : 'circle-outline'}"></span>
                                ${isActive ? 'Active' : 'Inactive'}
                            </div>
                        </div>
                    </div>
                    <div class="account-actions">
                        ${!isActive ? `<vscode-button appearance="secondary" onclick="vscode.postMessage({command:'activate', value: '${account.account}'})">
                            <span class="codicon codicon-check"></span>&nbsp;Activate
                        </vscode-button>` : ''}
                        <vscode-button appearance="secondary" onclick="vscode.postMessage({command:'revoke', value: '${account.account}'})">
                            <span class="codicon codicon-trash"></span>&nbsp;Revoke
                        </vscode-button>
                    </div>
                </div>
            `;
        }).join('');
    }

    private getHtml(toolkitUri: vscode.Uri, codiconsUri: vscode.Uri, accounts: AuthenticationListItem[]): string {
        return `<!DOCTYPE html>
            <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <script type="module" src="${toolkitUri}"></script>
                    <link rel="stylesheet" href="${codiconsUri}">
                    ${this.getStyles()}
                </head>
                <body>
                    <div class="section">
                        <div class="section-title">
                            <span class="codicon codicon-verified-filled"></span>
                            Authenticated Accounts
                        </div>
                        ${this.renderAccountCards(accounts)}
                    </div>

                    <div class="section">
                        <div class="section-title">
                            <span class="codicon codicon-add"></span>
                            Add Authentication
                        </div>
                        <div class="auth-buttons">
                            <div class="auth-button" onclick="vscode.postMessage('user_login')">
                                <span class="codicon codicon-sign-in"></span>
                                <div class="auth-button-text">
                                    <div class="auth-button-title">User Login</div>
                                    <div class="auth-button-desc">Sign in with your Google account</div>
                                </div>
                            </div>
                            <div class="auth-button" onclick="vscode.postMessage('user_login_drive')">
                                <span class="codicon codicon-file"></span>
                                <div class="auth-button-text">
                                    <div class="auth-button-title">User Login + Google Drive</div>
                                    <div class="auth-button-desc">Include Google Drive access scope</div>
                                </div>
                            </div>
                            <div class="auth-button" onclick="vscode.postMessage('service_account_login')">
                                <span class="codicon codicon-key"></span>
                                <div class="auth-button-text">
                                    <div class="auth-button-title">Service Account</div>
                                    <div class="auth-button-desc">Use a service account JSON key file</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="footer">
                        <p>Authentication is powered by the <a href="https://cloud.google.com/sdk/docs/install">gcloud CLI</a>.</p>
                        <p>Having issues? Check the <a href="#" onclick="vscode.postMessage('troubleshoot'); return false;">troubleshooting guide</a> or run <a href="#" onclick="vscode.postMessage('gcloud_init'); return false;">gcloud init</a>.</p>
                    </div>

                    <script>
                        const vscode = acquireVsCodeApi();
                    </script>
                </body>
            </html>`;
    }

    private getErrorHtml(toolkitUri: vscode.Uri, codiconsUri: vscode.Uri, error: any): string {
        return `<!DOCTYPE html>
            <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <script type="module" src="${toolkitUri}"></script>
                    <link rel="stylesheet" href="${codiconsUri}">
                    ${this.getStyles()}
                </head>
                <body>
                    <div class="section">
                        <div class="empty-state" style="color: var(--vscode-errorForeground);">
                            <div class="codicon codicon-error"></div>
                            <div style="margin-bottom: 8px;">Authentication Error</div>
                            <div style="font-size: 11px; opacity: 0.8;">${error.stderr || 'Unable to connect to gcloud CLI'}</div>
                        </div>
                    </div>

                    <div class="footer">
                        <p>Authentication requires the <a href="https://cloud.google.com/sdk/docs/install">gcloud CLI</a> to be installed.</p>
                        <p>Need help? Check the <a href="#" onclick="vscode.postMessage('troubleshoot'); return false;">troubleshooting guide</a>.</p>
                    </div>

                    <script>
                        const vscode = acquireVsCodeApi();
                    </script>
                </body>
            </html>`;
    }

    private getUri(webview: vscode.Webview, extensionUri: vscode.Uri, pathList: string[]) {
        return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, ...pathList));
    }

    /* This function will run as an event triggered when the JS on the webview triggers
     * the `postMessage` method
    */
    listenerOnDidReceiveMessage(message: any): void {

        switch (message.command || message) {
            case 'user_login':
                vscode.commands.executeCommand(commands.COMMAND_USER_LOGIN);
                break;
            case 'user_login_drive':
                vscode.commands.executeCommand(commands.COMMAND_USER_LOGIN_WITH_DRIVE);
                break;
            case 'gcloud_init':
                vscode.commands.executeCommand(commands.COMMAND_GCLOUD_INIT);
                break;
            case 'troubleshoot':
                vscode.commands.executeCommand(commands.AUTHENTICATION_TROUBLESHOOT);
                break;
            case 'service_account_login':
                vscode.commands.executeCommand(commands.COMMAND_SERVICE_ACCOUNT_LOGIN);
                break;
            case 'activate':
                Authentication.activate(message.value)
                    .then(result => {
                        vscode.commands.executeCommand(commands.COMMAND_AUTHENTICATION_REFRESH);
                    });
                break;
            case 'revoke':
                Authentication.revoke(message.value)
                    .then(result => {
                        vscode.commands.executeCommand(commands.COMMAND_AUTHENTICATION_REFRESH);
                    });
                break;
            default:
                console.error(`Unexpected message "${message}"`);
        }

    }

    refresh() {
        if (this.webviewView !== null && this.context !== null && this.token !== null) {
            this.resolveWebviewView(this.webviewView, this.context, this.token, true);
        }
    }

}
