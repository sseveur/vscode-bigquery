import { parse } from '@bstruct/bqsql-parser';
import * as vscode from 'vscode';
import { FoldingRangeProvider, FoldingRange, TextDocument, CancellationToken, ProviderResult } from 'vscode';
import { BqsqlDocument, BqsqlDocumentItem } from './bqsqlDocument';
import { isBigQueryLanguage } from '../services/languageUtils';

export class BqsqlFoldingRangeProvider implements FoldingRangeProvider {

    provideFoldingRanges(document: TextDocument, token: CancellationToken): ProviderResult<FoldingRange[]> {

        if (!isBigQueryLanguage(document.languageId)) {
            console.log('[Folding] Not a BigQuery language:', document.languageId);
            return null;
        }

        const text = document.getText();
        const ranges: FoldingRange[] = [];

        try {
            console.log('[Folding] Parsing document...');
            const parsed = parse(text) as BqsqlDocument;

            // Find top-level statements
            const statements = this.findTopLevelStatements(parsed.items);
            console.log('[Folding] Found', statements.length, 'statements');

            for (const stmt of statements) {
                const foldingRange = this.createFoldingRangeForStatement(stmt, text);
                if (foldingRange) {
                    console.log('[Folding] Created range:', foldingRange.start, '->', foldingRange.end);
                    ranges.push(foldingRange);
                }
            }

        } catch (error) {
            // Parser failed - fall back to regex-based detection
            console.log('[Folding] Parser failed, using regex fallback:', error);
            return this.findFoldingRangesRegex(text);
        }

        console.log('[Folding] Returning', ranges.length, 'folding ranges');
        return ranges;
    }

    /**
     * Find top-level statements (Query, QueryWith, CreateTable, etc.)
     */
    private findTopLevelStatements(items: BqsqlDocumentItem[]): BqsqlDocumentItem[] {
        const statements: BqsqlDocumentItem[] = [];

        for (const item of items) {
            // Top-level statement types from parser
            if (this.isStatement(item.item_type)) {
                statements.push(item);
            }
        }

        return statements;
    }

    /**
     * Check if item_type represents a foldable statement
     */
    private isStatement(itemType: string): boolean {
        const statementTypes = [
            'Query',
            'QuerySelect',
            'QueryWith',
            'CreateTable',
            'CreateView',
            'CreateFunction',
            'CreateProcedure',
            'CreateMaterializedView',
            'InsertStatement',
            'UpdateStatement',
            'DeleteStatement',
            'MergeStatement',
            'TruncateStatement',
            'DropStatement',
            'AlterStatement'
        ];
        return statementTypes.includes(itemType);
    }

    /**
     * Create folding range for a statement
     * Start: First line of statement
     * End: Line containing semicolon (or last line of statement range)
     */
    private createFoldingRangeForStatement(stmt: BqsqlDocumentItem, text: string): FoldingRange | null {
        if (!stmt.range || stmt.range.length < 3) {
            console.log('[Folding] Statement has no range data');
            return null;
        }

        const startLine = stmt.range[0];
        const statementStartOffset = stmt.range[1];
        const statementEndOffset = stmt.range[2];

        console.log('[Folding] Statement range:', startLine, 'offset:', statementStartOffset, '->', statementEndOffset);

        let endLine = stmt.range[0]; // Default to start line

        // Find the semicolon after the statement
        const remainingText = text.substring(statementEndOffset);
        const semicolonMatch = remainingText.match(/;/);

        if (semicolonMatch && semicolonMatch.index !== undefined) {
            // Found semicolon - count lines from statement end to semicolon
            const semicolonOffset = statementEndOffset + semicolonMatch.index;
            endLine = this.offsetToLine(text, semicolonOffset);
            console.log('[Folding] Found semicolon at offset', semicolonOffset, '-> line', endLine);
        } else {
            // No semicolon - use statement's last line
            endLine = this.offsetToLine(text, statementEndOffset);
            console.log('[Folding] No semicolon, using end offset line:', endLine);
        }

        console.log('[Folding] Final range: line', startLine, '->', endLine);

        // Only create folding range if there are multiple lines
        if (endLine > startLine) {
            console.log('[Folding] ✓ Creating folding range');
            return new FoldingRange(startLine, endLine);
        }

        console.log('[Folding] ✗ Single line statement, no folding');
        return null;
    }

    /**
     * Convert byte offset to line number (0-based)
     */
    private offsetToLine(text: string, offset: number): number {
        let line = 0;
        for (let i = 0; i < offset && i < text.length; i++) {
            if (text[i] === '\n') {
                line++;
            }
        }
        return line;
    }

    /**
     * Fallback: Regex-based folding detection
     * Used when WASM parser fails
     */
    private findFoldingRangesRegex(text: string): FoldingRange[] {
        console.log('[Folding] Using regex fallback');
        const ranges: FoldingRange[] = [];
        const lines = text.split('\n');

        let statementStartLine: number | null = null;
        const statementKeywords = /^\s*(SELECT|WITH|CREATE|INSERT|UPDATE|DELETE|MERGE|DROP|ALTER|TRUNCATE)\b/i;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Check if line starts a new statement
            if (statementKeywords.test(line)) {
                // If we had a previous statement, close it
                if (statementStartLine !== null && i > statementStartLine + 1) {
                    ranges.push(new FoldingRange(statementStartLine, i - 1));
                }
                statementStartLine = i;
            }

            // Check if line contains semicolon (statement end)
            if (line.includes(';') && statementStartLine !== null) {
                if (i > statementStartLine) {
                    ranges.push(new FoldingRange(statementStartLine, i));
                }
                statementStartLine = null;
            }
        }

        // Handle last statement without semicolon
        if (statementStartLine !== null && lines.length - 1 > statementStartLine) {
            ranges.push(new FoldingRange(statementStartLine, lines.length - 1));
        }

        console.log('[Folding] Regex found', ranges.length, 'ranges');
        return ranges;
    }
}
