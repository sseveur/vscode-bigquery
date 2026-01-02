import { parse } from '@bstruct/bqsql-parser';
import * as vscode from 'vscode';
import { FoldingRangeProvider, FoldingRange, TextDocument, CancellationToken, ProviderResult } from 'vscode';
import { BqsqlDocument, BqsqlDocumentItem } from './bqsqlDocument';
import { isBigQueryLanguage } from '../services/languageUtils';

export class BqsqlFoldingRangeProvider implements FoldingRangeProvider {

    provideFoldingRanges(document: TextDocument, token: CancellationToken): ProviderResult<FoldingRange[]> {

        if (!isBigQueryLanguage(document.languageId)) {
            return null;
        }

        const text = document.getText();
        const ranges: FoldingRange[] = [];

        try {
            const parsed = parse(text) as BqsqlDocument;

            // Find top-level statements
            const statements = this.findTopLevelStatements(parsed.items);

            for (const stmt of statements) {
                const foldingRange = this.createFoldingRangeForStatement(stmt, text);
                if (foldingRange) {
                    ranges.push(foldingRange);
                }
            }

            // If parser found statements but couldn't create ranges (no range data),
            // fall back to regex
            if (statements.length > 0 && ranges.length === 0) {
                return this.findFoldingRangesRegex(text);
            }

        } catch (error) {
            // Parser failed - fall back to regex-based detection
            return this.findFoldingRangesRegex(text);
        }

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
            return null;
        }

        const startLine = stmt.range[0];
        const statementStartOffset = stmt.range[1];
        const statementEndOffset = stmt.range[2];

        let endLine = stmt.range[0]; // Default to start line

        // Find the semicolon after the statement
        const remainingText = text.substring(statementEndOffset);
        const semicolonMatch = remainingText.match(/;/);

        if (semicolonMatch && semicolonMatch.index !== undefined) {
            // Found semicolon - count lines from statement end to semicolon
            const semicolonOffset = statementEndOffset + semicolonMatch.index;
            endLine = this.offsetToLine(text, semicolonOffset);
        } else {
            // No semicolon - use statement's last line
            endLine = this.offsetToLine(text, statementEndOffset);
        }

        // Only create folding range if there are multiple lines
        if (endLine > startLine) {
            return new FoldingRange(startLine, endLine);
        }

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
     * Fallback: Regex-based folding detection with hierarchical support
     * Used when WASM parser fails
     */
    private findFoldingRangesRegex(text: string): FoldingRange[] {
        const ranges: FoldingRange[] = [];
        const lines = text.split('\n');

        // 1. Top-level statements (CREATE/SELECT to semicolon) - PARENT
        ranges.push(...this.findTopLevelStatementRanges(lines));

        // 2. CTE definitions (WITH cte AS (...)) - CHILD
        ranges.push(...this.findCteFoldingRanges(lines));

        // 3. SELECT statements (SELECT column list) - CHILD/GRANDCHILD
        ranges.push(...this.findSelectFoldingRanges(lines));

        // 4. FROM clauses (FROM ... JOIN ... JOIN) - CHILD/GRANDCHILD
        ranges.push(...this.findFromClauseFoldingRanges(lines));

        // 5. Individual JOINs (each JOIN can be collapsed separately) - GRANDCHILD
        ranges.push(...this.findJoinFoldingRanges(lines));

        return ranges;
    }

    /**
     * Find top-level statement ranges (CREATE/SELECT to semicolon)
     */
    private findTopLevelStatementRanges(lines: string[]): FoldingRange[] {
        const ranges: FoldingRange[] = [];
        let statementStartLine: number | null = null;
        const statementStartKeywords = /^\s*(SELECT|CREATE|INSERT|UPDATE|DELETE|MERGE|DROP|ALTER|TRUNCATE)\b/i;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (statementStartKeywords.test(line) && statementStartLine === null) {
                statementStartLine = i;
            }

            if (line.includes(';') && statementStartLine !== null) {
                if (i > statementStartLine) {
                    ranges.push(new FoldingRange(statementStartLine, i));
                }
                statementStartLine = null;
            }
        }

        if (statementStartLine !== null && lines.length - 1 > statementStartLine) {
            ranges.push(new FoldingRange(statementStartLine, lines.length - 1));
        }

        return ranges;
    }

    /**
     * Find CTE folding ranges (WITH cte_name AS (...))
     * Each CTE can be collapsed independently
     * Handles various formatting styles: WITH cte AS (, , cte AS (, cte AS ( on new line
     */
    private findCteFoldingRanges(lines: string[]): FoldingRange[] {
        const ranges: FoldingRange[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Match: identifier AS (
            // This catches: WITH cte AS (, , cte AS (, or just cte AS ( on new line
            // More flexible than requiring WITH or comma at start
            const cteMatch = line.match(/\b(\w+)\s+AS\s*\(/i);

            if (cteMatch) {
                const cteName = cteMatch[1];
                const startLine = i;
                const openParenPos = line.indexOf('(', cteMatch.index!);

                // Find matching closing parenthesis by counting parens
                let parenCount = 1;
                let endLine = i;
                let charPos = openParenPos + 1;

                outerLoop: for (let j = i; j < lines.length && parenCount > 0; j++) {
                    const scanLine = j === i ? line.substring(charPos) : lines[j];

                    for (let k = 0; k < scanLine.length; k++) {
                        const char = scanLine[k];

                        // Skip string literals to avoid counting parens inside strings
                        if (char === "'" || char === '"' || char === '`') {
                            const quote = char;
                            k++; // Skip opening quote
                            while (k < scanLine.length && scanLine[k] !== quote) {
                                if (scanLine[k] === '\\') k++; // Skip escaped char
                                k++;
                            }
                            continue;
                        }

                        if (char === '(') parenCount++;
                        if (char === ')') {
                            parenCount--;
                            if (parenCount === 0) {
                                endLine = j;
                                break outerLoop;
                            }
                        }
                    }
                    charPos = 0; // Reset for subsequent lines
                }

                if (endLine > startLine) {
                    ranges.push(new FoldingRange(startLine, endLine));
                }
            }
        }

        return ranges;
    }

    /**
     * Find SELECT statement folding ranges
     * Each SELECT (column list) can be collapsed independently
     * Folds from SELECT to FROM/WHERE/GROUP BY/etc.
     */
    private findSelectFoldingRanges(lines: string[]): FoldingRange[] {
        const ranges: FoldingRange[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Match SELECT keyword at start of line
            // Include DISTINCT, ALL, etc.
            if (/^\s*SELECT\b/i.test(line)) {
                const startLine = i;
                let endLine = i;

                // Continue until we hit a clause that ends the SELECT column list
                // Note: Don't include ) because functions like SAFE_DIVIDE(...) have closing parens
                const endKeywords = /^\s*(FROM|WHERE|GROUP\s+BY|ORDER\s+BY|HAVING|LIMIT|UNION|EXCEPT|INTERSECT|;)\b/i;

                for (let j = i + 1; j < lines.length; j++) {
                    const nextLine = lines[j].trim();

                    // Empty lines are allowed
                    if (nextLine === '') {
                        continue;
                    }

                    // Check if line ends SELECT column list
                    if (endKeywords.test(nextLine)) {
                        break;
                    }

                    // This line is part of SELECT column list (columns, expressions, commas, CASE statements, etc.)
                    endLine = j;
                }

                if (endLine > startLine) {
                    ranges.push(new FoldingRange(startLine, endLine));
                }
            }
        }

        return ranges;
    }

    /**
     * Find FROM clause folding ranges (multi-line FROM with JOINs)
     * Each FROM clause can be collapsed independently
     */
    private findFromClauseFoldingRanges(lines: string[]): FoldingRange[] {
        const ranges: FoldingRange[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Match FROM keyword at start of line
            if (/^\s*FROM\b/i.test(line)) {
                const startLine = i;
                let endLine = i;

                // Continue until we hit a keyword that ends FROM clause
                const endKeywords = /^\s*(WHERE|GROUP\s+BY|ORDER\s+BY|HAVING|LIMIT|UNION|EXCEPT|INTERSECT|SELECT|WITH|;|\))/i;

                for (let j = i + 1; j < lines.length; j++) {
                    const nextLine = lines[j].trim();

                    // Empty lines are allowed
                    if (nextLine === '') {
                        continue;
                    }

                    // Check if line ends FROM clause
                    if (endKeywords.test(nextLine)) {
                        break;
                    }

                    // Check if line is part of FROM clause (JOIN, ON, USING, table name, comma)
                    if (/^\s*(INNER|LEFT|RIGHT|FULL|CROSS|OUTER)?\s*(OUTER\s+)?JOIN\b/i.test(nextLine) ||
                        /^\s*ON\b/i.test(nextLine) ||
                        /^\s*USING\b/i.test(nextLine) ||
                        /^\s*AND\b/i.test(nextLine) ||
                        /^\s*OR\b/i.test(nextLine) ||
                        /^[,`\w]/.test(nextLine)) { // Continuation (comma, table name, backtick)
                        endLine = j;
                    } else {
                        // Unknown line, assume end of FROM clause
                        break;
                    }
                }

                if (endLine > startLine) {
                    ranges.push(new FoldingRange(startLine, endLine));
                }
            }
        }

        return ranges;
    }

    /**
     * Find individual JOIN folding ranges
     * Each JOIN can be collapsed independently (JOIN line + ON/USING clause)
     */
    private findJoinFoldingRanges(lines: string[]): FoldingRange[] {
        const ranges: FoldingRange[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Match JOIN keyword (any type: INNER, LEFT, RIGHT, FULL, CROSS, OUTER)
            if (/^\s*(INNER|LEFT|RIGHT|FULL|CROSS|OUTER)?\s*(OUTER\s+)?JOIN\b/i.test(line)) {
                const startLine = i;
                let endLine = i;

                // Continue until we hit another JOIN, a clause keyword, or empty/unrelated line
                const endKeywords = /^\s*(JOIN|WHERE|GROUP\s+BY|ORDER\s+BY|HAVING|LIMIT|UNION|EXCEPT|INTERSECT|SELECT|;|\))/i;

                for (let j = i + 1; j < lines.length; j++) {
                    const nextLine = lines[j].trim();

                    // Empty lines allowed
                    if (nextLine === '') {
                        continue;
                    }

                    // Check if line ends this JOIN
                    if (endKeywords.test(nextLine)) {
                        break;
                    }

                    // Check if line is part of this JOIN (ON, USING, AND, OR)
                    if (/^\s*ON\b/i.test(nextLine) ||
                        /^\s*USING\b/i.test(nextLine) ||
                        /^\s*AND\b/i.test(nextLine) ||
                        /^\s*OR\b/i.test(nextLine)) {
                        endLine = j;
                    } else {
                        // Unknown line, assume end of JOIN
                        break;
                    }
                }

                if (endLine > startLine) {
                    ranges.push(new FoldingRange(startLine, endLine));
                }
            }
        }

        return ranges;
    }
}
