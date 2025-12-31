import { AuthenticationListItem } from '../services/authenticationListItem';

/**
 * Escapes HTML special characters to prevent XSS attacks.
 */
function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Escapes a string for safe use in HTML attributes (specifically for data- attributes).
 */
function escapeAttr(str: string): string {
    return escapeHtml(str);
}

export class AuthenticationGrid extends Object {

    private items: AuthenticationListItem[];

    constructor(items: AuthenticationListItem[]) {
        super();
        this.items = items;
    }

    override toString(): string {
        const headerCellStyle = 'background-color: var(--list-hover-background);';

        let html = `<vscode-data-grid generate-header="sticky" grid-template-columns="50% 20% 30%">`;

        // Header row
        html += `<vscode-data-grid-row row-type="header">`;
        html += `<vscode-data-grid-cell cell-type="columnheader" style="${headerCellStyle}" grid-column="1">account</vscode-data-grid-cell>`;
        html += `<vscode-data-grid-cell cell-type="columnheader" style="${headerCellStyle}" grid-column="2">status</vscode-data-grid-cell>`;
        html += `<vscode-data-grid-cell cell-type="columnheader" style="${headerCellStyle}" grid-column="3">actions</vscode-data-grid-cell>`;
        html += `</vscode-data-grid-row>`;

        // Data rows
        for (const item of this.items) {
            const escapedAccount = escapeHtml(item.account);
            const escapedAttrAccount = escapeAttr(item.account);

            html += `<vscode-data-grid-row>`;
            html += `<vscode-data-grid-cell style="${headerCellStyle}" grid-column="1">${escapedAccount}</vscode-data-grid-cell>`;
            html += `<vscode-data-grid-cell style="${headerCellStyle}" grid-column="2">${escapeHtml(item.status)}</vscode-data-grid-cell>`;

            // Actions cell - use data attributes instead of inline onclick to prevent XSS
            html += `<vscode-data-grid-cell style="${headerCellStyle}" grid-column="3">`;
            if (item.status === '') {
                html += `<vscode-button appearance="secondary" style="width:75px;margin-bottom:2px;" class="auth-action-btn" data-command="activate" data-value="${escapedAttrAccount}">activate</vscode-button>`;
            }
            html += `<vscode-button appearance="secondary" style="width:75px" class="auth-action-btn" data-command="revoke" data-value="${escapedAttrAccount}">revoke</vscode-button>`;
            html += `</vscode-data-grid-cell>`;

            html += `</vscode-data-grid-row>`;
        }

        html += `</vscode-data-grid>`;
        return html;
    }

    /**
     * Returns inline script that sets up event listeners for action buttons.
     * This approach is safer than inline onclick handlers as it doesn't embed user data in JavaScript.
     */
    static getEventListenerScript(nonce: string): string {
        return `<script nonce="${nonce}">
            document.addEventListener('DOMContentLoaded', function() {
                document.querySelectorAll('.auth-action-btn').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        var command = this.getAttribute('data-command');
                        var value = this.getAttribute('data-value');
                        vscode.postMessage({ command: command, value: value });
                    });
                });
            });
        </script>`;
    }

}
