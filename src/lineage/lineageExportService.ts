import * as vscode from 'vscode';

/**
 * Service for saving exported lineage files
 * The actual conversion (SVG→PNG/PDF) happens in the browser via lineageExport.js
 * This service handles file save dialogs only
 */
export class LineageExportService {
    /**
     * Show save dialog with file filters
     */
    static async showSaveDialog(
        defaultFilename: string,
        format: 'png' | 'pdf'
    ): Promise<vscode.Uri | undefined> {
        let defaultUri: vscode.Uri | undefined;
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            defaultUri = vscode.Uri.joinPath(
                vscode.workspace.workspaceFolders[0].uri,
                defaultFilename
            );
        }

        return await vscode.window.showSaveDialog({
            title: `Save lineage as ${format.toUpperCase()}`,
            filters: {
                [format.toUpperCase()]: [format]
            },
            defaultUri
        });
    }
}
