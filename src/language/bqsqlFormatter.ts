import { format } from 'sql-formatter';
import * as vscode from 'vscode';

export interface FormatOptions {
    tabWidth: number;
    useTabs: boolean;
    keywordCase: 'upper' | 'lower' | 'preserve';
    indentStyle: 'standard' | 'tabularLeft' | 'tabularRight';
    leadingCommas: boolean;
}

export function getFormatOptions(): FormatOptions {
    const config = vscode.workspace.getConfiguration('vscode-bigquery');
    const editorConfig = vscode.workspace.getConfiguration('editor');

    return {
        tabWidth: editorConfig.get<number>('tabSize', 4),
        useTabs: !editorConfig.get<boolean>('insertSpaces', true),
        keywordCase: config.get<'upper' | 'lower' | 'preserve'>('formatKeywordCase', 'upper'),
        indentStyle: config.get<'standard' | 'tabularLeft' | 'tabularRight'>('formatIndentStyle', 'standard'),
        leadingCommas: config.get<boolean>('formatLeadingCommas', true),
    };
}

export function formatBigQuerySQL(sql: string, options?: Partial<FormatOptions>): string {
    const opts = { ...getFormatOptions(), ...options };

    let formatted = format(sql, {
        language: 'bigquery',
        tabWidth: opts.tabWidth,
        useTabs: opts.useTabs,
        keywordCase: opts.keywordCase,
        indentStyle: opts.indentStyle,
        linesBetweenQueries: 2,
    });

    // Convert trailing commas to leading commas if enabled
    if (opts.leadingCommas) {
        formatted = convertToLeadingCommas(formatted, opts.tabWidth, opts.useTabs);
    }

    return formatted;
}

/**
 * Converts trailing comma style to leading comma style.
 * Example:
 *   SELECT
 *     a,
 *     b,
 *     c
 *
 * Becomes:
 *   SELECT
 *     a
 *     , b
 *     , c
 */
function convertToLeadingCommas(sql: string, tabWidth: number, useTabs: boolean): string {
    const lines = sql.split('\n');
    const result: string[] = [];
    const indent = useTabs ? '\t' : ' '.repeat(tabWidth);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trimEnd();

        // Check if line ends with a comma (but not inside a string or comment)
        if (trimmedLine.endsWith(',') && !isInsideStringOrComment(trimmedLine)) {
            // Remove trailing comma from current line
            const lineWithoutComma = trimmedLine.slice(0, -1);
            result.push(lineWithoutComma);

            // Add comma to the beginning of the next non-empty line
            if (i + 1 < lines.length) {
                const nextLine = lines[i + 1];
                const leadingWhitespace = nextLine.match(/^(\s*)/)?.[1] || '';
                const nextContent = nextLine.trimStart();

                if (nextContent) {
                    // Replace the next line with leading comma
                    lines[i + 1] = leadingWhitespace + ', ' + nextContent;
                }
            }
        } else {
            result.push(line);
        }
    }

    return result.join('\n');
}

/**
 * Simple heuristic to check if we're likely inside a string or comment.
 * This is not perfect but handles common cases.
 */
function isInsideStringOrComment(line: string): boolean {
    // Count unescaped quotes - if odd, we're inside a string
    let singleQuotes = 0;
    let doubleQuotes = 0;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const prevChar = i > 0 ? line[i - 1] : '';

        if (char === "'" && prevChar !== '\\') {
            singleQuotes++;
        } else if (char === '"' && prevChar !== '\\') {
            doubleQuotes++;
        }
    }

    // If odd number of quotes, we're inside a string
    if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0) {
        return true;
    }

    // Check for line comments
    if (line.includes('--')) {
        const commentIndex = line.indexOf('--');
        // Only consider it a comment if it's not inside quotes
        const beforeComment = line.substring(0, commentIndex);
        const quotesBeforeComment = (beforeComment.match(/'/g) || []).length;
        if (quotesBeforeComment % 2 === 0) {
            return true;
        }
    }

    return false;
}
