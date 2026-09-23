import { CancellationToken, Hover, HoverProvider, MarkdownString, Position, ProviderResult, TextDocument } from "vscode";
import { parse } from "@bstruct/bqsql-parser";
import { BqsqlDocument, BqsqlDocumentItem } from "./bqsqlDocument";
import { isBigQueryLanguage } from "../services/languageUtils";
import { bigqueryTableSchemaService } from "../extension";
import { BigqueryTableSchema } from "../services/bigqueryTableSchema";
import { extractCteColumns, getCteNames } from "../services/cteExtractor";
import { HoverCard, renderHoverCard } from "./hoverCards";
import { buildMultiQueryLineage } from "../services/lineageGraph";
import { resolveLineageColumns } from "../lineage/lineageColumns";

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
                return this.cteHover(documentContent, cteName, position.line + 1).then(card => new Hover(toMarkdown(card)));
            }
        }

        // Get schema from cache (for BigQuery tables)
        const schema = bigqueryTableSchemaService.getSchemaFromCache(documentContent, tableIdentifier);
        if (schema.length === 0) {
            // Try to preload schema for next hover
            bigqueryTableSchemaService.preLoadSchemaToCache(documentContent, tableIdentifier).catch(ex => console.error(ex));

            // Show a loading message with the table name
            const tableName = this.extractTableName(documentContent, tableIdentifier);
            if (tableName) {
                const parts = tableName.split('.');
                return new Hover(toMarkdown({
                    kind: 'SOURCE', name: parts[parts.length - 1], subtitle: parts.slice(0, -1).join('.') || undefined,
                    columns: [], note: 'Loading columns\u2026 hover again in a moment',
                }));
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

        if (ranges.length === 0) {return null;}

        // Get text from the ranges
        const parts: string[] = [];
        for (const range of ranges) {
            try {
                const text = lines[range[0]].substring(range[1], range[2]);
                if (text) {parts.push(text);}
            } catch { }
        }

        if (parts.length === 0) {return null;}

        // Join and clean up
        let tableName = parts.join('');
        // Remove backticks for display
        tableName = tableName.replace(/`/g, '');
        return tableName;
    }

    private formatSchemaAsMarkdown(schema: BigqueryTableSchema[]): MarkdownString {
        const first = schema[0];
        const partitioned = schema.filter(c => c.is_partitioning_column === 'YES').map(c => c.column_name);
        return toMarkdown({
            kind: 'SOURCE',
            name: first.table_name,
            subtitle: `${first.project_id}.${first.dataset_name}` + (partitioned.length ? ` \u00b7 partitioned by ${partitioned.join(', ')}` : ''),
            columns: [...schema]
                .sort((a, b) => Number(a.ordinal_position) - Number(b.ordinal_position))
                .map(c => ({ name: c.column_name, type: c.data_type, description: c.description || undefined })),
        });
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
     * CTE columns as the lineage Columns view resolves them: SELECT-list names, `*` expanded, and
     * types carried over from tables whose schema is already cached (never waits on the server).
     */
    private async cteHover(sql: string, cteName: string, line: number): Promise<HoverCard> {
        const card: HoverCard = { kind: 'CTE', name: cteName, columns: extractCteColumns(sql, cteName) };
        try {
            const query = buildMultiQueryLineage(sql).queries.find(q => line >= q.startLine && line <= q.endLine);
            const node = query?.graph.nodes.find(n => n.nodeType === 'CTE' && n.name.toLowerCase() === cteName.toLowerCase());
            if (query && node) {
                const cached = async (t: { projectId: string; datasetId: string; tableId: string }) =>
                    bigqueryTableSchemaService.getCachedColumns(t.projectId, t.datasetId, t.tableId);
                await resolveLineageColumns(query.graph, query.sqlText, cached, bigqueryTableSchemaService.getDefaultProjectId() ?? undefined);
                if (node.columns?.length) { card.columns = node.columns; }
                if (node.sourceLine) { card.subtitle = `line ${node.sourceLine}`; }
            }
        } catch { /* names from the SELECT list are still worth showing */ }
        return card;
    }
}

/**
 * Hover markdown is untrusted: names and types come from the catalog or the SQL, so they are
 * escaped and command links stay disabled. HTML is limited to VS Code's hover sanitizer.
 */
function toMarkdown(card: HoverCard): MarkdownString {
    const md = new MarkdownString(renderHoverCard(card));
    md.supportHtml = true;
    md.supportThemeIcons = true;
    md.isTrusted = false;
    return md;
}
