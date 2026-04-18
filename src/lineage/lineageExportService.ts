import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Service for exporting lineage charts as PNG or PDF files.
 * Accepts pre-rendered PNG data (base64 data URLs) from the webview.
 */
export class LineageExportService {
    /**
     * Export single PNG from base64 data URL
     */
    static async exportToPng(
        pngBase64: string,
        defaultFilename: string
    ): Promise<void> {
        try {
            const uri = await this.showSaveDialog(defaultFilename, 'png');
            if (!uri) {
                return;
            }

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Exporting lineage to PNG...`,
                cancellable: false
            }, async () => {
                const pngBuffer = this.base64ToBuffer(pngBase64);
                fs.writeFileSync(uri.fsPath, pngBuffer);
            });

            vscode.window.showInformationMessage(`Lineage exported to: ${path.basename(defaultFilename)}`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to export PNG: ${error.message}`);
        }
    }

    /**
     * Export single PDF from base64 PNG data URL
     */
    static async exportToPdf(
        pngBase64: string,
        width: number,
        height: number,
        defaultFilename: string
    ): Promise<void> {
        try {
            const uri = await this.showSaveDialog(defaultFilename, 'pdf');
            if (!uri) {
                return;
            }

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Exporting lineage to PDF...`,
                cancellable: false
            }, async () => {
                const pdfBuffer = await this.createPdfFromPng(pngBase64, width, height);
                fs.writeFileSync(uri.fsPath, pdfBuffer);
            });

            vscode.window.showInformationMessage(`Lineage exported to: ${path.basename(defaultFilename)}`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to export PDF: ${error.message}`);
        }
    }

    /**
     * Export multiple PNGs from base64 data URLs
     */
    static async exportMultipleToPng(
        pngDataItems: Array<{ pngBase64: string; queryIndex: number; lineRange: string }>,
        baseFilename: string
    ): Promise<void> {
        try {
            const uri = await this.showSaveDialog(baseFilename, 'png');
            if (!uri) {
                return;
            }

            const dirPath = path.dirname(uri.fsPath);
            let exportedCount = 0;

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Exporting ${pngDataItems.length} lineage charts...`,
                cancellable: false
            }, async (progress) => {
                const increment = 100 / pngDataItems.length;

                for (const { pngBase64, queryIndex, lineRange } of pngDataItems) {
                    const filename = this.generateFilename('png', queryIndex, lineRange);
                    const fullPath = path.join(dirPath, filename);

                    const pngBuffer = this.base64ToBuffer(pngBase64);
                    fs.writeFileSync(fullPath, pngBuffer);
                    exportedCount++;

                    progress.report({
                        increment,
                        message: `${exportedCount}/${pngDataItems.length}`
                    });
                }
            });

            vscode.window.showInformationMessage(`Exported ${exportedCount} lineage chart${exportedCount !== 1 ? 's' : ''}`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to export PNGs: ${error.message}`);
        }
    }

    /**
     * Export multiple PNGs to a multi-page PDF
     */
    static async exportMultipleToMultiPagePdf(
        pngDataItems: Array<{ pngBase64: string; width: number; height: number; title: string }>,
        defaultFilename: string
    ): Promise<void> {
        try {
            const uri = await this.showSaveDialog(defaultFilename, 'pdf');
            if (!uri) {
                return;
            }

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Creating multi-page PDF...`,
                cancellable: false
            }, async (progress) => {
                const { jsPDF } = await import('jspdf');

                let pdf: InstanceType<typeof jsPDF> | null = null;
                const increment = 100 / pngDataItems.length;

                for (let i = 0; i < pngDataItems.length; i++) {
                    const { pngBase64, width, height } = pngDataItems[i];

                    if (i === 0) {
                        pdf = new jsPDF({
                            orientation: width > height ? 'landscape' : 'portrait',
                            unit: 'pt',
                            format: [width, height]
                        });
                    } else {
                        pdf!.addPage([width, height], width > height ? 'landscape' : 'portrait');
                    }

                    pdf!.addImage(pngBase64, 'PNG', 0, 0, width, height);

                    progress.report({
                        increment,
                        message: `${i + 1}/${pngDataItems.length}`
                    });
                }

                const pdfBuffer = Buffer.from(pdf!.output('arraybuffer'));
                fs.writeFileSync(uri.fsPath, pdfBuffer);
            });

            vscode.window.showInformationMessage(`Exported ${pngDataItems.length} lineage${pngDataItems.length !== 1 ? 's' : ''} to PDF`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to export PDF: ${error.message}`);
        }
    }

    /**
     * Convert base64 data URL to Buffer
     */
    private static base64ToBuffer(dataUrl: string): Buffer {
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
        return Buffer.from(base64Data, 'base64');
    }

    /**
     * Create a single-page PDF from a PNG data URL
     */
    private static async createPdfFromPng(pngBase64: string, width: number, height: number): Promise<Buffer> {
        const { jsPDF } = await import('jspdf');

        const pdf = new jsPDF({
            orientation: width > height ? 'landscape' : 'portrait',
            unit: 'pt',
            format: [width, height]
        });

        pdf.addImage(pngBase64, 'PNG', 0, 0, width, height);

        return Buffer.from(pdf.output('arraybuffer'));
    }

    /**
     * Generate filename with timestamp and optional query info
     */
    private static generateFilename(
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
     * Show save dialog with file filters
     */
    private static async showSaveDialog(
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
