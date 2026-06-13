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
        logicalOperatorStyle: config.get<'keywordAligned' | 'contentAligned' | 'indented'>('formatLogicalOperatorStyle', 'indented'),
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

    // Normalize analytic window frames (ROWS/RANGE BETWEEN … PRECEDING AND … ). sql-formatter
    // leaves the frame trailing the window ORDER BY line and splits its "AND <upper bound>" onto
    // its own line where the downstream passes mistake the frame AND for a logical operator (#10).
    formatted = normalizeWindowFrames(formatted);

    // Transform logical operator positioning. Tabular indent styles always need the
    // pass: sql-formatter splits compound JOIN keywords ("INNER     JOIN") and leaves
    // ON/AND at a flat indent instead of the keyword gutter (#8).
    if (opts.logicalOperatorStyle !== 'keywordAligned' || opts.indentStyle !== 'standard') {
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

/** Matches a compound JOIN split by sql-formatter's tabular padding:
 *  "INNER     JOIN `t` s" — the first word was treated as the alignment keyword
 *  and JOIN pushed to the content column. */
const SPLIT_COMPOUND_JOIN = /^(\s*)(INNER|LEFT|RIGHT|FULL|CROSS)(\s{2,})((?:OUTER\s+)?JOIN)\b\s*(.*)$/i;

/** Matches a JOIN line with an inline ON clause. */
const JOIN_INLINE_ON = /^(\s*(?:(?:LEFT|RIGHT|FULL)(?:\s+OUTER)?\s+|CROSS\s+|INNER\s+)?JOIN\s+.*?)\s+(ON)(\s+)(.*)/i;

/** Matches a clause keyword at the start of a line. Allows keyword at end of line (standard style). */
const CLAUSE_KEYWORD = /^(\s*)(SELECT|FROM|WHERE|HAVING|QUALIFY|GROUP\s+BY|ORDER\s+BY|LIMIT|WINDOW|(?:(?:LEFT|RIGHT|FULL)(?:\s+OUTER)?\s+|CROSS\s+|INNER\s+)?JOIN)(\s+|$)/i;

/** Multi-word SQL keywords for content-start detection. */
const MULTI_WORD_KEYWORD = /^((?:LEFT|RIGHT|FULL)(?:\s+OUTER)?\s+JOIN|(?:CROSS|INNER)\s+JOIN|ORDER\s+BY|GROUP\s+BY|PARTITION\s+BY)\s*/i;

/** Start of an analytic window frame clause (ROWS/RANGE …) inside an OVER(...) window. */
const FRAME_START = /\b(?:ROWS|RANGE)\s+(?:BETWEEN\b|UNBOUNDED\b|CURRENT\b|INTERVAL\b|\d)/i;
/** A frame's lower bound ends with one of these, right before its `AND <upper bound>`. */
const FRAME_BOUND_END = /(?:PRECEDING|FOLLOWING|CURRENT\s+ROW|ROW)\s*$/i;

/**
 * Normalizes analytic window frames so downstream passes don't mangle them (#10).
 * sql-formatter leaves the ROWS/RANGE frame trailing the window's ORDER BY line and then
 * splits `… PRECEDING AND <upper bound>` across two lines, where the realign / leading-comma
 * passes would treat the frame's AND as a logical operator. This:
 *   1. moves a frame clause that trails other content onto its own line, and
 *   2. rejoins a frame whose `AND <upper bound>` was split off, collapsing the padding.
 */
function normalizeWindowFrames(sql: string): string {
    // Pass 1: split a trailing ROWS/RANGE frame onto its own line at the same indent.
    const split: string[] = [];
    for (const line of sql.split('\n')) {
        const m = line.match(/^(\s*)(.*?\S)\s+((?:ROWS|RANGE)\s+.*)$/i);
        if (m && FRAME_START.test(' ' + m[3]) && !/\b(?:ROWS|RANGE)\b/i.test(m[2]) && !isInsideStringOrComment(line)) {
            split.push(m[1] + m[2]);
            split.push(m[1] + m[3].replace(/\s{2,}/g, ' '));
        } else {
            split.push(line);
        }
    }

    // Pass 2: rejoin a frame line whose `AND <upper bound>` landed on the following line.
    const out: string[] = [];
    for (let i = 0; i < split.length; i++) {
        const cur = split[i];
        const next = i + 1 < split.length ? split[i + 1] : '';
        if (/^\s*(?:ROWS|RANGE)\b/i.test(cur) && FRAME_BOUND_END.test(cur) && /^\s*AND\b/i.test(next)) {
            out.push(cur.replace(/\s+$/, '') + ' ' + next.trim().replace(/\s{2,}/g, ' '));
            i++; // consume the AND line
        } else {
            out.push(cur);
        }
    }
    return out.join('\n');
}

/**
 * Transforms AND/OR/ON positioning based on the selected logical operator style.
 *
 * For 'contentAligned': AND/OR/ON align with the content column of their parent clause.
 * For 'indented': AND/OR/ON are indented by tabWidth under their parent keyword.
 */
function transformLogicalOperatorStyle(sql: string, opts: FormatOptions): string {
    if (opts.indentStyle !== 'standard') {
        return realignTabular(sql, opts);
    }

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
 * Tabular indent styles (#8): sql-formatter pads every clause keyword into a fixed
 * gutter, but it splits compound JOIN keywords ("INNER     JOIN" — INNER treated as the
 * keyword, JOIN pushed to the content column) and leaves ON/AND at a flat indent. This
 * pass re-joins compound JOINs, widens the statement gutter so the longest keyword fits
 * (e.g. "INNER JOIN" needs 11), re-pads every clause keyword and ON/AND/OR into it, and
 * shifts continuation lines by the same delta so all content stays on one column.
 */
function realignTabular(sql: string, opts: FormatOptions): string {
    const lines = sql.split('\n');

    // Re-join compound JOIN keywords split by sql-formatter's tabular padding.
    const joined = lines.map(line => {
        const m = line.match(SPLIT_COMPOUND_JOIN);
        if (!m) { return line; }
        const [, lead, first, , joinPart, rest] = m;
        return `${lead}${first} ${joinPart.replace(/\s+/g, ' ')} ${rest}`;
    });

    // Pull inline ON conditions onto their own line (final placement happens below).
    const expanded: string[] = [];
    for (const line of joined) {
        const m = line.match(JOIN_INLINE_ON);
        if (m) {
            const [, joinPart, onKeyword, , onCondition] = m;
            expanded.push(joinPart);
            expanded.push(onKeyword + ' ' + onCondition);
        } else {
            expanded.push(line);
        }
    }

    // Realign each blank-line-separated statement block independently.
    const out: string[] = [];
    let block: string[] = [];
    const flush = () => {
        if (block.length > 0) {
            out.push(...realignTabularBlock(block, opts));
            block = [];
        }
    };
    for (const line of expanded) {
        if (!line.trim()) {
            flush();
            out.push(line);
        } else {
            block.push(line);
        }
    }
    flush();
    return out.join('\n');
}

function realignTabularBlock(blockLines: string[], opts: FormatOptions): string[] {
    // Depth at the start of each line.
    const depths: number[] = [];
    let d = 0;
    for (const line of blockLines) {
        depths.push(d);
        d += countParenChanges(line);
    }

    // Lines inside an OVER(...) analytic window are left to sql-formatter — their internal
    // PARTITION BY / ORDER BY / frame layout must not be realigned to the clause gutter (#10).
    const inWindow = computeWindowMask(blockLines, depths);
    const right = opts.indentStyle === 'tabularRight';
    const tab = opts.tabWidth;

    // Per-depth gutter geometry, computed only from clause/op lines that are NOT inside a window.
    // CTE bodies, derived tables and subqueries each live at their own paren depth and get their
    // own gutter — the old single-depth-0 pass dumped CTE-body ON/AND at column 0 (#9).
    //   base[d]   = leading indent of clause keywords at depth d
    //   oldCol[d] = content column sql-formatter produced at depth d
    //   newCol[d] = widened content column so the longest keyword/op at depth d fits
    const base: Record<number, number> = {};
    const oldCol: Record<number, number> = {};
    const newCol: Record<number, number> = {};
    for (let i = 0; i < blockLines.length; i++) {
        if (inWindow[i]) { continue; }
        const dep = depths[i];
        const cm = blockLines[i].match(CLAUSE_KEYWORD);
        if (cm) {
            const kw = cm[2].replace(/\s+/g, ' ');
            const content = getContentStart(blockLines[i]);
            if (!(dep in oldCol)) { base[dep] = cm[1].length; oldCol[dep] = content; newCol[dep] = content; }
            newCol[dep] = Math.max(newCol[dep], cm[1].length + kw.length + 1);
            continue;
        }
        const om = blockLines[i].match(LOGICAL_OP_LINE);
        if (om && (dep in oldCol) && !isInsideStringOrComment(blockLines[i])) {
            const isOn = om[2].toUpperCase() === 'ON';
            const lead = base[dep] + (opts.logicalOperatorStyle === 'indented' && !isOn ? tab : 0);
            newCol[dep] = Math.max(newCol[dep], lead + om[2].length + 1);
        }
    }

    const clauseDepths = Object.keys(oldCol).map(Number).sort((a, b) => a - b);
    if (clauseDepths.length === 0) { return blockLines; }

    // Governing clause depth for a continuation / window line: the deepest clause-bearing
    // depth at or below it, so the line shifts with the gutter it sits under.
    const governing = (dep: number): number | null => {
        let g: number | null = null;
        for (const cd of clauseDepths) { if (cd <= dep) { g = cd; } }
        return g;
    };
    const padTo = (kwCol: number, kw: string, col: number) => ' '.repeat(Math.max(1, col - kwCol - kw.length));

    return blockLines.map((line, i) => {
        const dep = depths[i];
        const leadingLen = line.length - line.trimStart().length;

        if (!inWindow[i] && (dep in oldCol)) {
            const col = newCol[dep];
            const b = base[dep];
            const cm = line.match(CLAUSE_KEYWORD);
            if (cm) {
                const kw = cm[2].replace(/\s+/g, ' ');
                const rest = line.slice(getContentStart(line));
                if (!rest) {
                    return right ? ' '.repeat(Math.max(0, col - 1 - kw.length)) + kw : ' '.repeat(b) + kw;
                }
                return right
                    ? ' '.repeat(Math.max(0, col - 1 - kw.length)) + kw + ' ' + rest
                    : ' '.repeat(b) + kw + padTo(b, kw, col) + rest;
            }
            const om = line.match(LOGICAL_OP_LINE);
            if (om && !isInsideStringOrComment(line)) {
                const [, , keyword, , rest] = om;
                if (opts.logicalOperatorStyle === 'contentAligned') {
                    return ' '.repeat(col) + keyword + ' ' + rest;
                }
                if (right) {
                    return ' '.repeat(Math.max(0, col - 1 - keyword.length)) + keyword + ' ' + rest;
                }
                const isOn = keyword.toUpperCase() === 'ON';
                const kwCol = b + (opts.logicalOperatorStyle === 'indented' && !isOn ? tab : 0);
                return ' '.repeat(kwCol) + keyword + padTo(kwCol, keyword, col) + rest;
            }
        }

        // Continuation / window-internal lines that sat at (or beyond) the old content column
        // shift right by their governing clause's widening delta so alignment is preserved.
        const g = governing(dep);
        if (g !== null) {
            const delta = newCol[g] - oldCol[g];
            if (delta > 0 && leadingLen >= oldCol[g]) {
                return ' '.repeat(delta) + line;
            }
        }
        return line;
    });
}

/**
 * Marks lines that sit inside an OVER( … ) analytic window. The window body (PARTITION BY,
 * ORDER BY, and the ROWS/RANGE frame) is indented by sql-formatter and must be skipped by the
 * tabular realign — its keywords would otherwise be pulled to the clause gutter and the frame
 * AND mistaken for a logical operator (#10). A window opens on a line containing `OVER (` whose
 * paren stays open, and closes when the depth returns to the level it opened at.
 */
function computeWindowMask(blockLines: string[], depths: number[]): boolean[] {
    const mask = new Array(blockLines.length).fill(false);
    const openDepths: number[] = [];
    for (let i = 0; i < blockLines.length; i++) {
        const startDepth = depths[i];
        while (openDepths.length && startDepth <= openDepths[openDepths.length - 1]) {
            openDepths.pop();
        }
        if (openDepths.length) { mask[i] = true; }
        if (/\bOVER\s*\(/i.test(blockLines[i]) && !isInsideStringOrComment(blockLines[i])) {
            openDepths.push(startDepth);
        }
    }
    return mask;
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

        // Orphan comma on its own line (sql-formatter pushes the comma past an intervening
        // comment). Attach it as a leading comma to the next content line and drop the orphan,
        // otherwise the trailing-comma branch below would emit it as a blank line (#10).
        if (line.trim() === ',') {
            for (let k = i + 1; k < lines.length; k++) {
                const nextContent = lines[k].trimStart();
                if (nextContent) {
                    const lead = lines[k].match(/^(\s*)/)?.[1] || '';
                    lines[k] = lead + ', ' + nextContent;
                    break;
                }
            }
            continue;
        }

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
            if (/^(?:ROWS|RANGE)\b/i.test(trimmed)) { break; }  // window frame — not an ORDER BY item
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
