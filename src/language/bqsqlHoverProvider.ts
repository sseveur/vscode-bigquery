import { CancellationToken, Hover, HoverProvider, MarkdownString, Position, ProviderResult, TextDocument } from "vscode";
import { parse } from "@bstruct/bqsql-parser";
import { BqsqlDocument, BqsqlDocumentItem } from "./bqsqlDocument";
import { isBigQueryLanguage } from "../services/languageUtils";
import { bigqueryTableSchemaService } from "../extension";
import { BigqueryTableSchema } from "../services/bigqueryTableSchema";
import { extractCteColumns, getCteNames, CteColumn } from "../services/cteExtractor";

export class BqsqlHoverProvider implements HoverProvider {

    provideHover(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Hover> {

        if (!isBigQueryLanguage(document.languageId)) { return; }

        const documentContent = document.getText();
        const parsed = parse(documentContent) as BqsqlDocument;

        // Find TableIdentifier at the current position
        const tableIdentifier = this.findTableIdentifierAtPosition(parsed.items, position.line, position.character, documentContent);
        if (!tableIdentifier) {
            return null;
        }

        // Check if this is a CTE reference
        const cteName = this.extractCteReference(tableIdentifier, documentContent);
        if (cteName) {
            // Verify it's actually a CTE defined in this query
            const definedCtes = getCteNames(documentContent);
            if (definedCtes.some(name => name.toLowerCase() === cteName.toLowerCase())) {
                const columns = extractCteColumns(documentContent, cteName);
                return new Hover(this.formatCteAsMarkdown(cteName, columns));
            }
        }

        // Get schema from cache (for BigQuery tables)
        const schema = bigqueryTableSchemaService.getSchemaFromCache(documentContent, tableIdentifier);
        if (schema.length === 0) {
            // Try to preload schema for next hover
            bigqueryTableSchemaService.preLoadSchemaToCache(documentContent, tableIdentifier);

            // Show a loading message with the table name
            const tableName = this.extractTableName(documentContent, tableIdentifier);
            if (tableName) {
                const loadingMd = new MarkdownString();
                loadingMd.appendMarkdown(`**\`${tableName}\`**\n\n`);
                loadingMd.appendMarkdown(`*Loading schema... hover again to see columns*`);
                return new Hover(loadingMd);
            }
            return null;
        }

        // Build hover content
        const markdown = this.formatSchemaAsMarkdown(schema);
        return new Hover(markdown);
    }

    private findTableIdentifierAtPosition(items: BqsqlDocumentItem[], line: number, character: number, documentContent: string): BqsqlDocumentItem | null {
        for (const item of items) {
            if (item.item_type === "TableIdentifier") {
                // Check if position is within any of the table identifier's child ranges
                if (this.isPositionInTableIdentifier(item, line, character, documentContent)) {
                    return item;
                }
            }

            // Recursively search nested items
            if (item.items && item.items.length > 0) {
                const found = this.findTableIdentifierAtPosition(item.items, line, character, documentContent);
                if (found) {
                    return found;
                }
            }
        }
        return null;
    }

    private isPositionInTableIdentifier(tableIdentifier: BqsqlDocumentItem, line: number, character: number, documentContent: string): boolean {
        // For backtick-quoted identifiers, we need to check the full range
        // The parser may store the entire `project.dataset.table` as one item

        for (const child of tableIdentifier.items) {
            if (child.range && child.range.length >= 3) {
                const [rangeLine, rangeStart, rangeEnd] = child.range;
                if (rangeLine === line && character >= rangeStart && character <= rangeEnd) {
                    return true;
                }
            }

            // Also check nested items for complex identifiers
            if (child.items && child.items.length > 0) {
                for (const grandChild of child.items) {
                    if (grandChild.range && grandChild.range.length >= 3) {
                        const [rangeLine, rangeStart, rangeEnd] = grandChild.range;
                        if (rangeLine === line && character >= rangeStart && character <= rangeEnd) {
                            return true;
                        }
                    }
                }
            }
        }

        // Fallback: calculate the overall range from all children
        const ranges = this.getAllRanges(tableIdentifier);
        for (const range of ranges) {
            if (range[0] === line && character >= range[1] && character <= range[2]) {
                return true;
            }
        }

        return false;
    }

    private getAllRanges(item: BqsqlDocumentItem): number[][] {
        const ranges: number[][] = [];

        if (item.range && item.range.length >= 3) {
            ranges.push(item.range);
        }

        if (item.items) {
            for (const child of item.items) {
                ranges.push(...this.getAllRanges(child));
            }
        }

        return ranges;
    }

    private extractTableName(documentContent: string, tableIdentifier: BqsqlDocumentItem): string | null {
        const lines = documentContent.split('\n');
        const ranges = this.getAllRanges(tableIdentifier);

        if (ranges.length === 0) return null;

        // Get text from the ranges
        const parts: string[] = [];
        for (const range of ranges) {
            try {
                const text = lines[range[0]].substring(range[1], range[2]);
                if (text) parts.push(text);
            } catch { }
        }

        if (parts.length === 0) return null;

        // Join and clean up
        let tableName = parts.join('');
        // Remove backticks for display
        tableName = tableName.replace(/`/g, '');
        return tableName;
    }

    private formatSchemaAsMarkdown(schema: BigqueryTableSchema[]): MarkdownString {
        if (schema.length === 0) {
            return new MarkdownString("No schema information available");
        }

        const firstColumn = schema[0];
        const tableName = `${firstColumn.project_id}.${firstColumn.dataset_name}.${firstColumn.table_name}`;

        let md = `**\`${tableName}\`**\n\n`;
        md += `| Column | Type | Description |\n`;
        md += `|--------|------|-------------|\n`;

        // Sort by ordinal position
        const sortedSchema = [...schema].sort((a, b) =>
            parseInt(a.ordinal_position) - parseInt(b.ordinal_position)
        );

        for (const col of sortedSchema) {
            const description = col.description || '';
            const escapedDesc = description.replace(/\|/g, '\\|').replace(/\n/g, ' ');
            md += `| ${col.column_name} | \`${col.data_type}\` | ${escapedDesc} |\n`;
        }

        // Add footer with column count and partition info
        const partitionCols = schema.filter(c => c.is_partitioning_column === 'YES');
        let footer = `\n*${schema.length} column${schema.length !== 1 ? 's' : ''}`;
        if (partitionCols.length > 0) {
            footer += ` • Partitioned by: ${partitionCols.map(c => c.column_name).join(', ')}`;
        }
        footer += '*';
        md += footer;

        const markdown = new MarkdownString(md);
        markdown.isTrusted = true;
        return markdown;
    }

    /**
     * Check if the table identifier is a CTE reference (contains TableCteId)
     * Returns the CTE name if it is, null otherwise
     */
    private extractCteReference(tableIdentifier: BqsqlDocumentItem, documentContent: string): string | null {
        for (const child of tableIdentifier.items || []) {
            if (child.item_type === "TableCteId") {
                // Extract the CTE name from the range
                if (child.range && child.range.length >= 3) {
                    const lines = documentContent.split('\n');
                    try {
                        return lines[child.range[0]].substring(child.range[1], child.range[2]);
                    } catch {
                        return null;
                    }
                }
            }
        }
        return null;
    }

    /**
     * Format CTE columns as markdown for hover display
     */
    private formatCteAsMarkdown(cteName: string, columns: CteColumn[]): MarkdownString {
        let md = `**CTE: \`${cteName}\`**\n\n`;

        if (columns.length === 0) {
            md += `*No columns detected*`;
        } else {
            md += `| Column |\n`;
            md += `|--------|\n`;

            for (const col of columns) {
                md += `| ${col.name} |\n`;
            }

            md += `\n*${columns.length} column${columns.length !== 1 ? 's' : ''}*`;
        }

        const markdown = new MarkdownString(md);
        markdown.isTrusted = true;
        return markdown;
    }
}
