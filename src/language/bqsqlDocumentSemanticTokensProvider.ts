import { parse } from "@bstruct/bqsql-parser";
import { CancellationToken, DocumentSemanticTokensProvider, Event, Position, Range, ProviderResult, SemanticTokens, SemanticTokensBuilder, TextDocument, SemanticTokensLegend } from "vscode";
import { bigqueryTableSchemaService } from "../extension";
import { BqsqlDocument, BqsqlDocumentItem } from "./bqsqlDocument";
import { isBigQueryLanguage } from "../services/languageUtils";

interface CommentRange {
    startLine: number;
    startChar: number;
    endLine: number;
    endChar: number;
}

export class BqsqlDocumentSemanticTokensProvider implements DocumentSemanticTokensProvider {

    onDidChangeSemanticTokens?: Event<void> | undefined;

    provideDocumentSemanticTokens(document: TextDocument, token: CancellationToken): ProviderResult<SemanticTokens> {

        if (!isBigQueryLanguage(document.languageId)) { return null; }

        const tokensBuilder = new SemanticTokensBuilder(BqsqlDocumentSemanticTokensProvider.getSemanticTokensLegend());

        const text = document.getText();
        const blockCommentRanges = this.findBlockCommentRanges(text);

        const parsed = parse(text) as BqsqlDocument;

        const qTableIdentifier = this.findTableIdentifiers(parsed.items);
        if (qTableIdentifier.length > 0) {
            for (let index = 0; index < qTableIdentifier.length; index++) {
                const element = qTableIdentifier[index];

                let _ = bigqueryTableSchemaService.preLoadSchemaToCache(document.getText(), element).then().catch(ex => console.error(ex));
            }
        }

        this.buildTokens(tokensBuilder, parsed.items, blockCommentRanges, document);

        return tokensBuilder.build();

    }

    findBlockCommentRanges(text: string): CommentRange[] {
        const ranges: CommentRange[] = [];
        const lines = text.split('\n');
        let inBlockComment = false;
        let startLine = 0;
        let startChar = 0;

        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const line = lines[lineNum];
            let charIndex = 0;

            while (charIndex < line.length) {
                if (!inBlockComment) {
                    const startIndex = line.indexOf('/*', charIndex);
                    if (startIndex !== -1) {
                        inBlockComment = true;
                        startLine = lineNum;
                        startChar = startIndex;
                        charIndex = startIndex + 2;
                    } else {
                        break;
                    }
                }

                if (inBlockComment) {
                    const endIndex = line.indexOf('*/', charIndex);
                    if (endIndex !== -1) {
                        ranges.push({
                            startLine,
                            startChar,
                            endLine: lineNum,
                            endChar: endIndex + 2
                        });
                        inBlockComment = false;
                        charIndex = endIndex + 2;
                    } else {
                        break;
                    }
                }
            }
        }

        // Handle unclosed block comment at end of file
        if (inBlockComment) {
            const lastLine = lines.length - 1;
            ranges.push({
                startLine,
                startChar,
                endLine: lastLine,
                endChar: lines[lastLine].length
            });
        }

        return ranges;
    }

    isInsideBlockComment(line: number, char: number, ranges: CommentRange[]): boolean {
        for (const range of ranges) {
            if (line < range.startLine || line > range.endLine) {
                continue;
            }
            if (line === range.startLine && char < range.startChar) {
                continue;
            }
            if (line === range.endLine && char >= range.endChar) {
                continue;
            }
            return true;
        }
        return false;
    }

    findTableIdentifiers(items: BqsqlDocumentItem[]): BqsqlDocumentItem[] {

        let documentItems: BqsqlDocumentItem[] = [];
        for (let index = 0; index < items.length; index++) {
            const element: BqsqlDocumentItem = items[index];
            if (element.item_type === "TableIdentifier") {
                documentItems.push(element);
            } else {
                if (element.items.length > 0) {
                    documentItems.push(...this.findTableIdentifiers(element.items));
                }
            }
        }

        return documentItems;
    }

    static getSemanticTokensLegend(): SemanticTokensLegend {
        const tokenTypes = ['comment', 'string', 'keyword', 'number', 'operator', 'type', 'function', 'method'];
        const tokenModifiers: string[] = [];
        return new SemanticTokensLegend(
            tokenTypes,
            tokenModifiers
        );
    }

    private static readonly LOGICAL_KEYWORDS = new Set([
        'AND', 'OR', 'NOT', 'IN', 'BETWEEN', 'LIKE', 'EXISTS', 'IS',
        'NULL', 'TRUE', 'FALSE', 'ALL', 'ANY', 'SOME',
    ]);

    buildTokens(tokensBuilder: SemanticTokensBuilder, items: BqsqlDocumentItem[], blockCommentRanges: CommentRange[], document?: TextDocument) {
        for (let index = 0; index < items.length; index++) {
            const element = items[index];
            if (element.range && element.range.length > 0) {
                // Skip tokens inside block comments
                if (this.isInsideBlockComment(element.range[0], element.range[1], blockCommentRanges)) {
                    continue;
                }

                const range = new Range(new Position(element.range[0], element.range[1]), new Position(element.range[0], element.range[2]));
                if (element.item_type === 'Keyword' || element.item_type === 'KeywordAs') {
                    tokensBuilder.push(range, 'keyword', []);
                } else if (element.item_type === 'Number') {
                    tokensBuilder.push(range, 'number', []);
                } else if (element.item_type === 'Operator') {
                    let tokenType: string = 'operator';
                    if (document) {
                        const text = document.getText(range).toUpperCase();
                        if (BqsqlDocumentSemanticTokensProvider.LOGICAL_KEYWORDS.has(text)) {
                            tokenType = 'keyword';
                        }
                    }
                    tokensBuilder.push(range, tokenType, []);
                }
            }

            if (element.items.length > 0) {
                this.buildTokens(tokensBuilder, element.items, blockCommentRanges, document);
            }
        }
    }

}