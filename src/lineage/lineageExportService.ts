import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Resvg } from '@resvg/resvg-js';
import { jsPDF } from 'jspdf';

/**
 * Service for exporting lineage charts as PNG or PDF files
 */
export class LineageExportService {
    /**
     * Export single SVG to PNG
     */
    static async exportToPng(
        svgString: string,
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
                const pngBuffer = await this.convertSvgToPng(svgString);
                fs.writeFileSync(uri.fsPath, pngBuffer);
            });

            vscode.window.showInformationMessage(`Lineage exported to: ${path.basename(defaultFilename)}`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to export PNG: ${error.message}`);
        }
    }

    /**
     * Export single SVG to PDF
     */
    static async exportToPdf(
        svgString: string,
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
                const pdfBuffer = await this.convertSvgToPdf(svgString);
                fs.writeFileSync(uri.fsPath, pdfBuffer);
            });

            vscode.window.showInformationMessage(`Lineage exported to: ${path.basename(defaultFilename)}`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to export PDF: ${error.message}`);
        }
    }

    /**
     * Export multiple SVGs to separate PNG files
     */
    static async exportMultipleToPng(
        svgStrings: Array<{ svg: string; queryIndex: number; lineRange: string }>,
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
                title: `Exporting ${svgStrings.length} lineage charts...`,
                cancellable: false
            }, async (progress) => {
                const increment = 100 / svgStrings.length;

                for (const { svg, queryIndex, lineRange } of svgStrings) {
                    const filename = this.generateFilename('png', queryIndex, lineRange);
                    const fullPath = path.join(dirPath, filename);

                    const pngBuffer = await this.convertSvgToPng(svg);
                    fs.writeFileSync(fullPath, pngBuffer);
                    exportedCount++;

                    progress.report({
                        increment,
                        message: `${exportedCount}/${svgStrings.length}`
                    });
                }
            });

            vscode.window.showInformationMessage(`Exported ${exportedCount} lineage chart${exportedCount !== 1 ? 's' : ''}`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to export PNGs: ${error.message}`);
        }
    }

    /**
     * Export multiple SVGs to multi-page PDF by converting each to PNG
     */
    static async exportMultipleToMultiPagePdf(
        svgStrings: Array<{ svg: string; title: string }>,
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
                let pdf: jsPDF | null = null;
                const increment = 100 / svgStrings.length;

                for (let i = 0; i < svgStrings.length; i++) {
                    const { svg } = svgStrings[i];

                    // Convert SVG to PNG
                    const pngBuffer = await this.convertSvgToPng(svg);
                    const pngBase64 = pngBuffer.toString('base64');
                    const imgData = `data:image/png;base64,${pngBase64}`;

                    // Get dimensions
                    const { width, height } = this.parseSvgDimensions(svg);

                    if (i === 0) {
                        // Create PDF with first page
                        pdf = new jsPDF({
                            orientation: width > height ? 'landscape' : 'portrait',
                            unit: 'pt',
                            format: [width, height]
                        });
                    } else {
                        // Add new page for subsequent graphs
                        pdf!.addPage([width, height], width > height ? 'landscape' : 'portrait');
                    }

                    // Add PNG image to current page
                    pdf!.addImage(imgData, 'PNG', 0, 0, width, height);

                    progress.report({
                        increment,
                        message: `${i + 1}/${svgStrings.length}`
                    });
                }

                const pdfBuffer = Buffer.from(pdf!.output('arraybuffer'));
                fs.writeFileSync(uri.fsPath, pdfBuffer);
            });

            vscode.window.showInformationMessage(`Exported ${svgStrings.length} lineage${svgStrings.length !== 1 ? 's' : ''} to PDF`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to export PDF: ${error.message}`);
        }
    }

    /**
     * Convert SVG string to PNG buffer using resvg-js
     */
    private static async convertSvgToPng(svgString: string): Promise<Buffer> {
        // Get theme setting
        const config = vscode.workspace.getConfiguration('vscode-bigquery');
        const theme = config.get<string>('lineageExportTheme', 'dark');

        // Preprocess SVG to replace CSS variables with actual colors
        const processedSvg = this.preprocessSvgForExport(svgString, theme);

        // Set background color based on theme
        const backgroundColor = theme === 'light' ? '#ffffff' : '#1e1e1e';

        // resvg-js uses Resvg class with renderSync
        const resvg = new Resvg(processedSvg, {
            fitTo: {
                mode: 'width',
                value: 1600  // 2x resolution for 800px wide graphs
            },
            font: {
                loadSystemFonts: true  // Enable system fonts to render text
            },
            background: backgroundColor
        });

        const pngData = resvg.render();
        const pngBuffer = pngData.asPng();

        return Buffer.from(pngBuffer);
    }

    /**
     * Preprocess SVG to replace CSS variables with actual colors
     * This is needed because resvg-js doesn't support CSS variables
     */
    private static preprocessSvgForExport(svgString: string, theme: string): string {
        // Map of VS Code theme variables to actual colors
        // Order matters - more specific patterns (with fallbacks) must come first
        const darkColorMap: { [key: string]: string } = {
            'var(--vscode-editor-background, #1e1e1e)': '#1e1e1e',
            'var(--vscode-foreground, #ccc)': '#cccccc',
            'var(--vscode-descriptionForeground, #888)': '#888888',
            'var(--vscode-descriptionForeground, #666)': '#888888',
            'var(--vscode-descriptionForeground)': '#888888',
            'var(--vscode-foreground)': '#cccccc',
            'var(--vscode-editor-background)': '#1e1e1e',
            'var(--vscode-panel-border)': '#3e3e3e',
            'var(--vscode-sideBar-background)': '#252526',
            'var(--vscode-list-hoverBackground)': '#2a2d2e'
        };

        const lightColorMap: { [key: string]: string } = {
            'var(--vscode-editor-background, #1e1e1e)': '#ffffff',
            'var(--vscode-foreground, #ccc)': '#000000',
            'var(--vscode-descriptionForeground, #888)': '#666666',
            'var(--vscode-descriptionForeground, #666)': '#666666',
            'var(--vscode-descriptionForeground)': '#666666',
            'var(--vscode-foreground)': '#000000',
            'var(--vscode-editor-background)': '#ffffff',
            'var(--vscode-panel-border)': '#d0d0d0',
            'var(--vscode-sideBar-background)': '#f3f3f3',
            'var(--vscode-list-hoverBackground)': '#e8e8e8'
        };

        const colorMap = theme === 'light' ? lightColorMap : darkColorMap;

        let processed = svgString;

        // Replace CSS variables (order matters - more specific first)
        for (const [cssVar, color] of Object.entries(colorMap)) {
            const escapedVar = cssVar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            processed = processed.replace(new RegExp(escapedVar, 'g'), color);
        }

        return processed;
    }

    /**
     * Convert SVG string to PDF buffer by embedding PNG
     * This is more reliable than svg2pdf.js in Node.js environment
     */
    private static async convertSvgToPdf(svgString: string): Promise<Buffer> {
        // Convert SVG to PNG first
        const pngBuffer = await this.convertSvgToPng(svgString);

        // Get SVG dimensions for PDF page size
        const { width, height } = this.parseSvgDimensions(svgString);

        // Create PDF with SVG dimensions
        const pdf = new jsPDF({
            orientation: width > height ? 'landscape' : 'portrait',
            unit: 'pt',
            format: [width, height]
        });

        // Convert PNG buffer to base64 data URL
        const pngBase64 = pngBuffer.toString('base64');
        const imgData = `data:image/png;base64,${pngBase64}`;

        // Add PNG image to PDF
        pdf.addImage(imgData, 'PNG', 0, 0, width, height);

        // Return as buffer
        const pdfBuffer = Buffer.from(pdf.output('arraybuffer'));
        return pdfBuffer;
    }

    /**
     * Parse SVG string to extract width and height
     */
    private static parseSvgDimensions(svgString: string): { width: number; height: number } {
        const widthMatch = svgString.match(/width="(\d+(?:\.\d+)?)"/);
        const heightMatch = svgString.match(/height="(\d+(?:\.\d+)?)"/);

        const width = widthMatch ? parseFloat(widthMatch[1]) : 800;
        const height = heightMatch ? parseFloat(heightMatch[1]) : 600;

        return { width, height };
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
