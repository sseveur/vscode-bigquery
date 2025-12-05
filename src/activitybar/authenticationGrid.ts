import { AuthenticationListItem } from '../services/authenticationListItem';

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
            html += `<vscode-data-grid-row>`;
            html += `<vscode-data-grid-cell style="${headerCellStyle}" grid-column="1">${item.account}</vscode-data-grid-cell>`;
            html += `<vscode-data-grid-cell style="${headerCellStyle}" grid-column="2">${item.status}</vscode-data-grid-cell>`;

            // Actions cell
            html += `<vscode-data-grid-cell style="${headerCellStyle}" grid-column="3">`;
            if (item.status === '') {
                html += `<vscode-button appearance="secondary" style="width:75px;margin-bottom:2px;" onclick="vscode.postMessage({'command':'activate', 'value': '${item.account}'})">activate</vscode-button>`;
            }
            html += `<vscode-button appearance="secondary" style="width:75px" onclick="vscode.postMessage({'command':'revoke', 'value': '${item.account}'})">revoke</vscode-button>`;
            html += `</vscode-data-grid-cell>`;

            html += `</vscode-data-grid-row>`;
        }

        html += `</vscode-data-grid>`;
        return html;
    }

}
