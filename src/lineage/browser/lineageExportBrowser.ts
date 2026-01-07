/**
 * Browser-side lineage export module
 * Runs in VS Code webview context
 * Uses canvg for SVG→Canvas and jsPDF for PDF generation
 */

import { jsPDF } from 'jspdf';
import { Canvg } from 'canvg';

// System font stack for cross-platform compatibility
const SYSTEM_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

// Theme color mappings for CSS variable replacement
const darkColorMap: Record<string, string> = {
    'var(--vscode-editor-background, #1e1e1e)': '#1e1e1e',
    'var(--vscode-foreground, #ccc)': '#cccccc',
    'var(--vscode-descriptionForeground, #888)': '#888888',
    'var(--vscode-descriptionForeground, #666)': '#888888',
    'var(--vscode-descriptionForeground)': '#888888',
    'var(--vscode-foreground)': '#cccccc',
    'var(--vscode-editor-background)': '#1e1e1e',
    'var(--vscode-panel-border)': '#3e3e3e',
    'var(--vscode-sideBar-background)': '#252526',
    'var(--vscode-list-hoverBackground)': '#2a2d2e',
    'var(--vscode-font-family)': SYSTEM_FONT,
    'var(--vscode-editor-font-family)': SYSTEM_FONT
};

const lightColorMap: Record<string, string> = {
    'var(--vscode-editor-background, #1e1e1e)': '#ffffff',
    'var(--vscode-foreground, #ccc)': '#000000',
    'var(--vscode-descriptionForeground, #888)': '#666666',
    'var(--vscode-descriptionForeground, #666)': '#666666',
    'var(--vscode-descriptionForeground)': '#666666',
    'var(--vscode-foreground)': '#000000',
    'var(--vscode-editor-background)': '#ffffff',
    'var(--vscode-panel-border)': '#d0d0d0',
    'var(--vscode-sideBar-background)': '#f3f3f3',
    'var(--vscode-list-hoverBackground)': '#e8e8e8',
    'var(--vscode-font-family)': SYSTEM_FONT,
    'var(--vscode-editor-font-family)': SYSTEM_FONT
};

/**
 * Preprocess SVG to replace CSS variables with actual colors
 */
function preprocessSvg(svgString: string, theme: 'dark' | 'light'): string {
    const colorMap = theme === 'light' ? lightColorMap : darkColorMap;
    let processed = svgString;

    // First, replace known CSS variables
    for (const [cssVar, color] of Object.entries(colorMap)) {
        const escapedVar = cssVar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        processed = processed.replace(new RegExp(escapedVar, 'g'), color);
    }

    // Then, replace any remaining CSS variables with fallback values or defaults
    // Pattern: var(--name, fallback) or var(--name)
    processed = processed.replace(/var\(--[^,)]+,\s*([^)]+)\)/g, '$1');
    processed = processed.replace(/var\(--vscode-[^)]+\)/g, theme === 'light' ? '#000000' : '#cccccc');

    return processed;
}

/**
 * Parse SVG dimensions from string
 */
function parseSvgDimensions(svgString: string): { width: number; height: number } {
    const widthMatch = svgString.match(/width="(\d+(?:\.\d+)?)"/);
    const heightMatch = svgString.match(/height="(\d+(?:\.\d+)?)"/);

    const width = widthMatch ? parseFloat(widthMatch[1]) : 800;
    const height = heightMatch ? parseFloat(heightMatch[1]) : 600;

    return { width, height };
}

/**
 * Convert SVG element to PNG by cloning and cleaning in DOM
 */
async function svgToPng(svgString: string, theme: 'dark' | 'light'): Promise<string> {
    // Create a temporary container
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.innerHTML = svgString;
    document.body.appendChild(container);

    try {
        const svgElement = container.querySelector('svg');
        if (!svgElement) {
            throw new Error('No SVG element found');
        }

        // Clone the SVG
        const clone = svgElement.cloneNode(true) as SVGSVGElement;

        // Remove all data-* attributes and title elements from clone
        clone.querySelectorAll('*').forEach(el => {
            Array.from(el.attributes).forEach(attr => {
                if (attr.name.startsWith('data-')) {
                    el.removeAttribute(attr.name);
                }
            });
        });
        clone.querySelectorAll('title').forEach(t => t.remove());

        // Apply theme colors directly to elements (replace CSS variables)
        const colorMap = theme === 'light' ? lightColorMap : darkColorMap;

        // Process all elements with fill, stroke, or style attributes
        clone.querySelectorAll('*').forEach(el => {
            ['fill', 'stroke', 'color'].forEach(attr => {
                const value = el.getAttribute(attr);
                if (value && value.includes('var(')) {
                    for (const [cssVar, color] of Object.entries(colorMap)) {
                        if (value.includes(cssVar.replace(/var\(([^)]+)\)/, '$1').split(',')[0])) {
                            el.setAttribute(attr, color);
                            break;
                        }
                    }
                    // Fallback: extract fallback value or use default
                    const fallbackMatch = value.match(/var\([^,]+,\s*([^)]+)\)/);
                    if (fallbackMatch && el.getAttribute(attr)?.includes('var(')) {
                        el.setAttribute(attr, fallbackMatch[1].trim());
                    }
                }
            });

            // Set font-family on text elements
            if (el.tagName === 'text') {
                el.setAttribute('font-family', SYSTEM_FONT);
            }
        });

        // Get dimensions
        const width = parseFloat(clone.getAttribute('width') || '800');
        const height = parseFloat(clone.getAttribute('height') || '600');

        // Serialize the cleaned clone
        const serializer = new XMLSerializer();
        const cleanSvgString = serializer.serializeToString(clone);

        // Create canvas at 10x resolution for high quality export
        // (32x exceeds browser canvas size limits causing empty exports)
        const canvas = document.createElement('canvas');
        const scale = 10;
        canvas.width = width * scale;
        canvas.height = height * scale;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to get canvas context');
        }

        // Fill background
        ctx.fillStyle = theme === 'light' ? '#ffffff' : '#1e1e1e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(scale, scale);

        // Render with canvg
        const v = await Canvg.from(ctx, cleanSvgString);
        await v.render();

        return canvas.toDataURL('image/png');
    } finally {
        document.body.removeChild(container);
    }
}

/**
 * Create single-page PDF from SVG
 */
async function svgToPdf(svgString: string, theme: 'dark' | 'light'): Promise<string> {
    // Convert SVG to PNG first
    const pngDataUrl = await svgToPng(svgString, theme);

    // Get dimensions for PDF page (use original SVG dimensions)
    const { width, height } = parseSvgDimensions(svgString);

    // Ensure we have valid dimensions
    const pdfWidth = width || 800;
    const pdfHeight = height || 600;

    // Create PDF with SVG dimensions
    const pdf = new jsPDF({
        orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
        unit: 'pt',
        format: [pdfWidth, pdfHeight]
    });

    // Add PNG image to PDF
    // Use 'PNG' format explicitly with the base64 data (not the full data URL)
    const base64Data = pngDataUrl.split(',')[1];
    pdf.addImage(base64Data, 'PNG', 0, 0, pdfWidth, pdfHeight);

    // Return as base64 data URL
    return pdf.output('datauristring');
}

/**
 * Create multi-page PDF from multiple SVGs
 */
async function svgsToMultiPagePdf(
    svgStrings: string[],
    theme: 'dark' | 'light'
): Promise<string> {
    let pdf: jsPDF | null = null;

    for (let i = 0; i < svgStrings.length; i++) {
        const svgString = svgStrings[i];

        // Convert SVG to PNG
        const pngDataUrl = await svgToPng(svgString, theme);

        // Get dimensions with fallbacks
        const { width, height } = parseSvgDimensions(svgString);
        const pdfWidth = width || 800;
        const pdfHeight = height || 600;

        if (i === 0) {
            // Create PDF with first page
            pdf = new jsPDF({
                orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
                unit: 'pt',
                format: [pdfWidth, pdfHeight]
            });
        } else {
            // Add new page for subsequent graphs
            pdf!.addPage([pdfWidth, pdfHeight], pdfWidth > pdfHeight ? 'landscape' : 'portrait');
        }

        // Add PNG image to current page
        // Use 'PNG' format explicitly with the base64 data (not the full data URL)
        const base64Data = pngDataUrl.split(',')[1];
        pdf!.addImage(base64Data, 'PNG', 0, 0, pdfWidth, pdfHeight);
    }

    // Return as base64 data URL
    return pdf!.output('datauristring');
}

/**
 * Generate timestamped filename
 */
function generateFilename(
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
 * Extract base64 data from data URL
 */
function extractBase64(dataUrl: string): string {
    const commaIndex = dataUrl.indexOf(',');
    return commaIndex >= 0 ? dataUrl.substring(commaIndex + 1) : dataUrl;
}

// Export for use in webview
const LineageExport = {
    svgToPng,
    svgToPdf,
    svgsToMultiPagePdf,
    generateFilename,
    extractBase64,
    preprocessSvg,
    parseSvgDimensions
};

export default LineageExport;
