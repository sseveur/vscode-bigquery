/**
 * Small pure helpers for classifying the SQL text the user ran, used to decide whether follow-up
 * actions (like auto-previewing a created table) make sense. Kept free of the `vscode` API so they
 * can be unit tested directly.
 */

/** Blanks out comments and quoted literals so structural characters can be counted safely. */
function stripCommentsAndLiterals(sql: string): string {
    let out = '';
    let i = 0;
    while (i < sql.length) {
        const two = sql.substr(i, 2);
        if (two === '--') {
            while (i < sql.length && sql[i] !== '\n') { i++; }
            continue;
        }
        if (sql[i] === '#') {
            while (i < sql.length && sql[i] !== '\n') { i++; }
            continue;
        }
        if (two === '/*') {
            i += 2;
            while (i < sql.length && sql.substr(i, 2) !== '*/') { i++; }
            i += 2;
            continue;
        }
        const ch = sql[i];
        if (ch === '\'' || ch === '"' || ch === '`') {
            const quote = ch;
            const triple = sql.substr(i, 3);
            const isTriple = triple === quote.repeat(3);
            i += isTriple ? 3 : 1;
            while (i < sql.length) {
                if (sql[i] === '\\') { i += 2; continue; }
                if (isTriple && sql.substr(i, 3) === quote.repeat(3)) { i += 3; break; }
                if (!isTriple && sql[i] === quote) { i += 1; break; }
                i++;
            }
            continue;
        }
        out += ch;
        i++;
    }
    return out;
}

/** True when the text holds more than one statement, i.e. BigQuery runs it as a script. */
export function isMultiStatementScript(sql: string): boolean {
    const stripped = stripCommentsAndLiterals(sql);
    const statements = stripped.split(';').map(s => s.trim()).filter(s => s.length > 0);
    return statements.length > 1;
}

/** True for `CREATE TEMP TABLE` / `CREATE TEMPORARY TABLE`, which only exist inside their script. */
export function isTempTableStatement(sql: string): boolean {
    return /^\s*CREATE\s+(?:OR\s+REPLACE\s+)?TEMP(?:ORARY)?\s+TABLE\s/i.test(sql.trim());
}

/**
 * True when a table name captured from a `CREATE TABLE` statement is safe to interpolate into a
 * generated preview query. Rejects anything but up to three dotted identifier parts (optionally
 * backquoted), and in particular a name ending in `--`, which would comment out the rest of the
 * generated query — turning `SELECT * ... LIMIT 100` into an unbounded scan.
 */
export function isSafeTableIdentifier(name: string): boolean {
    if (name.includes('--')) { return false; }
    return /^`?[\w-]+`?(?:\.`?[\w-]+`?){0,2}$/.test(name);
}
