import { CancellationToken, Hover, HoverProvider, MarkdownString, Position, ProviderResult, TextDocument } from "vscode";
import { parse } from "@bstruct/bqsql-parser";
import { BqsqlDocument, BqsqlDocumentItem } from "./bqsqlDocument";
import { isBigQueryLanguage } from "../services/languageUtils";
import { bigqueryTableSchemaService } from "../extension";
import { BigqueryTableSchema } from "../services/bigqueryTableSchema";

export class BqsqlHoverProvider implements HoverProvider {

    provideHover(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Hover> {

        if (!isBigQueryLanguage(document.languageId)) { return; }

        const documentContent = document.getText();
        const parsed = parse(documentContent) as BqsqlDocument;

        // Find TableIdentifier at the current position
        const tableIdentifier = this.findTableIdentifierAtPosition(parsed.items, position.line, position.character);
        if (!tableIdentifier) {
            return null;
        }

        // Get schema from cache
        const schema = bigqueryTableSchemaService.getSchemaFromCache(documentContent, tableIdentifier);
        if (schema.length === 0) {
            // Try to preload schema for next hover
            bigqueryTableSchemaService.preLoadSchemaToCache(documentContent, tableIdentifier);
            return null;
        }

        // Build hover content
        const markdown = this.formatSchemaAsMarkdown(schema);
        return new Hover(markdown);
    }

    private findTableIdentifierAtPosition(items: BqsqlDocumentItem[], line: number, character: number): BqsqlDocumentItem | null {
        for (const item of items) {
            if (item.item_type === "TableIdentifier") {
                // Check if position is within any of the table identifier's child ranges
                if (this.isPositionInTableIdentifier(item, line, character)) {
                    return item;
                }
            }

            // Recursively search nested items
            if (item.items && item.items.length > 0) {
                const found = this.findTableIdentifierAtPosition(item.items, line, character);
                if (found) {
                    return found;
                }
            }
        }
        return null;
    }

    private isPositionInTableIdentifier(tableIdentifier: BqsqlDocumentItem, line: number, character: number): boolean {
        // Check each child element's range
        for (const child of tableIdentifier.items) {
            if (child.range && child.range.length >= 3) {
                const [rangeLine, rangeStart, rangeEnd] = child.range;
                if (rangeLine === line && character >= rangeStart && character <= rangeEnd) {
                    return true;
                }
            }
        }
        return false;
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
}
