import { format } from 'sql-formatter';
import * as vscode from 'vscode';

export interface FormatOptions {
    tabWidth: number;
    useTabs: boolean;
    keywordCase: 'upper' | 'lower' | 'preserve';
    indentStyle: 'standard' | 'tabularLeft' | 'tabularRight';
    leadingCommas: boolean;
    expressionWidth: number;
    functionCase: 'upper' | 'lower' | 'preserve';
    logicalOperatorNewline: 'before' | 'after';
    logicalOperatorStyle: 'keywordAligned' | 'contentAligned' | 'indented';
    identifierCase: 'upper' | 'lower' | 'preserve';
    dataTypeCase: 'upper' | 'lower' | 'preserve';
    denseOperators: boolean;
    newlineBeforeSemicolon: boolean;
    inlineKeyClauses: boolean;
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
        expressionWidth: config.get<number>('formatExpressionWidth', 50),
        functionCase: config.get<'upper' | 'lower' | 'preserve'>('formatFunctionCase', 'preserve'),
        logicalOperatorNewline: config.get<'before' | 'after'>('formatLogicalOperatorNewline', 'before'),
        logicalOperatorStyle: config.get<'keywordAligned' | 'contentAligned' | 'indented'>('formatLogicalOperatorStyle', 'keywordAligned'),
        identifierCase: config.get<'upper' | 'lower' | 'preserve'>('formatIdentifierCase', 'preserve'),
        dataTypeCase: config.get<'upper' | 'lower' | 'preserve'>('formatDataTypeCase', 'preserve'),
        denseOperators: config.get<boolean>('formatDenseOperators', false),
        newlineBeforeSemicolon: config.get<boolean>('formatNewlineBeforeSemicolon', false),
        inlineKeyClauses: config.get<boolean>('formatInlineKeyClauses', false),
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
        expressionWidth: opts.expressionWidth,
        functionCase: opts.functionCase,
        logicalOperatorNewline: opts.logicalOperatorNewline,
        identifierCase: opts.identifierCase,
        dataTypeCase: opts.dataTypeCase,
        denseOperators: opts.denseOperators,
        newlineBeforeSemicolon: opts.newlineBeforeSemicolon,
    });

    // Transform logical operator positioning if not default
    if (opts.logicalOperatorStyle !== 'keywordAligned') {
        formatted = transformLogicalOperatorStyle(formatted, opts);
    }

    // Collapse GROUP BY / ORDER BY item lists onto one line (or wrap at commas within
    // expressionWidth). Runs before the leading-comma pass so any wrap-induced trailing
    // commas get converted consistently with the rest of the document.
    if (opts.inlineKeyClauses) {
        formatted = collapseKeyClauses(formatted, opts);
    }

    // Convert trailing commas to leading commas if enabled
    if (opts.leadingCommas) {
        formatted = convertToLeadingCommas(formatted, opts.tabWidth, opts.useTabs);
    }

    return formatted;
}

/** Matches a line starting with AND, OR, or ON (after whitespace). */
const LOGICAL_OP_LINE = /^(\s*)(AND|OR|ON)(\s+)(.*)/i;

/** Matches a JOIN line with an inline ON clause. */
const JOIN_INLINE_ON = /^(\s*(?:LEFT\s+|RIGHT\s+|FULL\s+|CROSS\s+|INNER\s+)?JOIN\s+.*?)\s+(ON)(\s+)(.*)/i;

/** Matches a clause keyword at the start of a line. Allows keyword at end of line (standard style). */
const CLAUSE_KEYWORD = /^(\s*)(SELECT|FROM|WHERE|HAVING|QUALIFY|GROUP\s+BY|ORDER\s+BY|LIMIT|WINDOW|(?:LEFT\s+|RIGHT\s+|FULL\s+|CROSS\s+|INNER\s+)?JOIN)(\s+|$)/i;

/** Multi-word SQL keywords for content-start detection. */
const MULTI_WORD_KEYWORD = /^((?:LEFT|RIGHT|FULL|CROSS|INNER)\s+JOIN|ORDER\s+BY|GROUP\s+BY|PARTITION\s+BY)\s*/i;

/**
 * Transforms AND/OR/ON positioning based on the selected logical operator style.
 *
 * For 'contentAligned': AND/OR/ON align with the content column of their parent clause.
 * For 'indented': AND/OR/ON are indented by tabWidth under their parent keyword.
 */
function transformLogicalOperatorStyle(sql: string, opts: FormatOptions): string {
    const lines = sql.split('\n');
    const indent = opts.useTabs ? '\t' : ' '.repeat(opts.tabWidth);

    // First pass: split inline ON from JOIN lines
    const expandedLines: string[] = [];
    for (const line of lines) {
        const joinMatch = line.match(JOIN_INLINE_ON);
        if (joinMatch) {
            const [, joinPart, onKeyword, , onCondition] = joinMatch;
            expandedLines.push(joinPart);
            const parentKeywordStart = joinPart.length - joinPart.trimStart().length;
            const contentStart = getContentStart(joinPart);
            if (opts.logicalOperatorStyle === 'contentAligned') {
                expandedLines.push(' '.repeat(contentStart) + onKeyword + ' ' + onCondition);
            } else {
                expandedLines.push(' '.repeat(parentKeywordStart) + indent + onKeyword + ' ' + onCondition);
            }
        } else {
            expandedLines.push(line);
        }
    }

    // Second pass: build clause context and re-indent AND/OR/ON lines
    interface ClauseContext {
        keywordStart: number;
        contentStart: number;  // -1 means "look ahead" (keyword on its own line)
        depth: number;
    }

    const result: string[] = [];
    let parenDepth = 0;
    let currentClause: ClauseContext | null = null;
    const clauseStack: ClauseContext[] = [];

    for (let i = 0; i < expandedLines.length; i++) {
        const line = expandedLines[i];
        const trimmed = line.trimStart();
        if (!trimmed) {
            result.push(line);
            continue;
        }

        const depthChange = countParenChanges(line);
        const lineStartDepth = parenDepth;

        // Check if this line is a clause keyword
        const clauseMatch = line.match(CLAUSE_KEYWORD);
        if (clauseMatch) {
            const keywordStart = clauseMatch[1].length;
            let contentStart = getContentStart(line);

            // If keyword is alone on its line (standard style), look ahead for content indent
            if (contentStart === keywordStart + clauseMatch[2].length || trimmed === clauseMatch[2]) {
                contentStart = findNextContentIndent(expandedLines, i + 1);
            }

            currentClause = { keywordStart, contentStart, depth: lineStartDepth };
            while (clauseStack.length > 0 && clauseStack[clauseStack.length - 1].depth >= lineStartDepth) {
                clauseStack.pop();
            }
            clauseStack.push(currentClause);
            result.push(line);
            parenDepth += depthChange;
            continue;
        }

        // Check if this line starts with AND/OR/ON
        const opMatch = line.match(LOGICAL_OP_LINE);
        if (opMatch && !isInsideStringOrComment(line)) {
            const [, , keyword, , rest] = opMatch;

            // Find the appropriate parent clause for current nesting depth
            let parent = currentClause;
            if (parent && lineStartDepth > parent.depth) {
                for (let j = clauseStack.length - 1; j >= 0; j--) {
                    if (clauseStack[j].depth <= lineStartDepth) {
                        parent = clauseStack[j];
                        break;
                    }
                }
            }

            if (parent) {
                let newIndent: string;
                if (lineStartDepth > parent.depth) {
                    // Inside deeper parens: align with preceding content line
                    newIndent = ' '.repeat(findPreviousContentIndent(result));
                } else if (opts.logicalOperatorStyle === 'contentAligned') {
                    newIndent = ' '.repeat(parent.contentStart);
                } else {
                    newIndent = ' '.repeat(parent.keywordStart) + indent;
                }
                result.push(newIndent + keyword + ' ' + rest);
            } else {
                result.push(line);
            }

            parenDepth += depthChange;
            continue;
        }

        result.push(line);
        parenDepth += depthChange;
    }

    return result.join('\n');
}

/**
 * Gets the column where content starts after the keyword on a line.
 * Handles multi-word keywords like "LEFT JOIN", "ORDER BY".
 * For "WHERE     foo" → 10. For "LEFT JOIN t" → 10 (in tabularLeft with padding).
 */
function getContentStart(line: string): number {
    const trimmed = line.trimStart();
    const leading = line.length - trimmed.length;

    // Try multi-word keywords first
    const multiMatch = trimmed.match(MULTI_WORD_KEYWORD);
    if (multiMatch) {
        return leading + multiMatch[0].length;
    }

    // Single-word keyword
    const singleMatch = trimmed.match(/^(\S+)\s+/);
    if (singleMatch) {
        return leading + singleMatch[0].length;
    }

    // Keyword alone on line (no content after)
    return leading + trimmed.length;
}

/**
 * Looks ahead from a given line index to find the indent of the next non-empty content line.
 * Used when a clause keyword is alone on its line (standard indent style).
 */
function findNextContentIndent(lines: string[], startIdx: number): number {
    for (let i = startIdx; i < lines.length; i++) {
        const trimmed = lines[i].trimStart();
        if (trimmed) {
            return lines[i].length - trimmed.length;
        }
    }
    return 0;
}

/**
 * Looks backward through already-processed lines to find the indent of the most recent
 * non-empty, non-logical-operator line. Used for AND/OR inside parenthesized groups
 * to align with sibling content.
 */
function findPreviousContentIndent(lines: string[]): number {
    for (let i = lines.length - 1; i >= 0; i--) {
        const trimmed = lines[i].trimStart();
        if (trimmed && !trimmed.match(/^(AND|OR|ON)\s/i)) {
            return lines[i].length - trimmed.length;
        }
    }
    return 0;
}

/**
 * Counts net parenthesis depth change in a line, ignoring parens inside strings/comments.
 */
function countParenChanges(line: string): number {
    let depth = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const prev = i > 0 ? line[i - 1] : '';

        if (char === "'" && !inDoubleQuote && prev !== '\\') {
            inSingleQuote = !inSingleQuote;
        } else if (char === '"' && !inSingleQuote && prev !== '\\') {
            inDoubleQuote = !inDoubleQuote;
        } else if (!inSingleQuote && !inDoubleQuote) {
            if (char === '(') { depth++; }
            else if (char === ')') { depth--; }
        }
    }

    // Check for line comment
    if (!inSingleQuote && !inDoubleQuote) {
        const commentIdx = line.indexOf('--');
        if (commentIdx >= 0) {
            // Recount ignoring everything after the comment
            depth = 0;
            inSingleQuote = false;
            inDoubleQuote = false;
            for (let i = 0; i < commentIdx; i++) {
                const char = line[i];
                const prev = i > 0 ? line[i - 1] : '';
                if (char === "'" && !inDoubleQuote && prev !== '\\') {
                    inSingleQuote = !inSingleQuote;
                } else if (char === '"' && !inSingleQuote && prev !== '\\') {
                    inDoubleQuote = !inDoubleQuote;
                } else if (!inSingleQuote && !inDoubleQuote) {
                    if (char === '(') { depth++; }
                    else if (char === ')') { depth--; }
                }
            }
        }
    }

    return depth;
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

/** Matches a GROUP BY / ORDER BY clause keyword at the start of a line, capturing the
 *  leading indent, the keyword (case preserved), the whitespace after it, and any inline
 *  content that follows on the same line (tabular indent styles put the first item here). */
const INLINE_CLAUSE_KEYWORD = /^([ \t]*)(GROUP\s+BY|ORDER\s+BY)([ \t]*)(.*)$/i;

/**
 * Collapses GROUP BY / ORDER BY item lists that sql-formatter exploded onto one line each.
 * Items are re-joined onto a single line when their combined width is within
 * `expressionWidth`; otherwise they are greedily wrapped at comma boundaries (trailing
 * commas, aligned under the first item). SELECT and PARTITION BY are intentionally left
 * untouched. A clause whose body contains a line comment is left expanded (a `--` comment
 * cannot be inlined).
 */
function collapseKeyClauses(sql: string, opts: FormatOptions): string {
    const lines = sql.split('\n');
    const out: string[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const m = line.match(INLINE_CLAUSE_KEYWORD);
        if (!m) {
            out.push(line);
            i++;
            continue;
        }

        const [, indentStr, keyword, , firstInline] = m;

        // Gather the clause body: the inline part (if any) plus all following item lines,
        // stopping at the next clause keyword / closing paren / semicolon / blank line.
        const segments: string[] = [];
        if (firstInline.trim()) { segments.push(firstInline.trim()); }

        let j = i + 1;
        for (; j < lines.length; j++) {
            const trimmed = lines[j].trim();
            if (!trimmed) { break; }
            if (trimmed.match(CLAUSE_KEYWORD)) { break; }
            if (trimmed.startsWith(')') || trimmed.startsWith(';')) { break; }
            if (/^(UNION|INTERSECT|EXCEPT)\b/i.test(trimmed)) { break; }
            segments.push(trimmed);
        }

        // A line comment anywhere in the gathered block forces the clause to stay expanded.
        const hasComment = firstInline.includes('--') || segments.some(s => s.includes('--'));
        if (hasComment) {
            out.push(line);
            i++;
            continue;
        }

        // Normalize each segment (drop surrounding commas), then split the joined body on
        // top-level commas so items keep parenthesized/quoted commas intact.
        const body = segments
            .map(s => s.replace(/^,\s*/, '').replace(/\s*,\s*$/, ''))
            .join(',');
        const items = splitTopLevelCommas(body).map(s => s.trim()).filter(s => s.length > 0);

        if (items.length === 0) {
            out.push(line);
            i++;
            continue;
        }

        // Prefix = everything up to where the first item begins, so wrapped lines align.
        let prefix: string;
        if (firstInline.trim()) {
            prefix = line.slice(0, line.length - firstInline.length);
        } else {
            prefix = `${indentStr}${keyword} `;
        }
        const contentIndent = ' '.repeat(prefix.length);

        // Single line when the joined items fit expressionWidth; else greedy comma wrap.
        const joined = items.join(', ');
        if (joined.length <= opts.expressionWidth) {
            out.push(prefix + joined);
        } else {
            let cur = prefix;
            let curLen = 0; // content length on the current line (excludes prefix)
            for (let k = 0; k < items.length; k++) {
                const item = items[k];
                const sep = curLen > 0 ? ', ' : '';
                if (curLen > 0 && curLen + sep.length + item.length > opts.expressionWidth) {
                    out.push(cur + ',');            // more items follow → trailing comma
                    cur = contentIndent + item;
                    curLen = item.length;
                } else {
                    cur += sep + item;
                    curLen += sep.length + item.length;
                }
            }
            out.push(cur);
        }

        i = j;
    }

    return out.join('\n');
}

/** Splits `text` on commas that sit at the top level — outside parens/brackets and string
 *  literals. Used to break clause bodies into items without cutting inside `f(a, b)`. */
function splitTopLevelCommas(text: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let inSingle = false;
    let inDouble = false;
    let start = 0;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const prev = i > 0 ? text[i - 1] : '';
        if (ch === "'" && !inDouble && prev !== '\\') { inSingle = !inSingle; }
        else if (ch === '"' && !inSingle && prev !== '\\') { inDouble = !inDouble; }
        else if (!inSingle && !inDouble) {
            if (ch === '(' || ch === '[') { depth++; }
            else if (ch === ')' || ch === ']') { depth--; }
            else if (ch === ',' && depth === 0) {
                parts.push(text.slice(start, i));
                start = i + 1;
            }
        }
    }
    parts.push(text.slice(start));
    return parts;
}
