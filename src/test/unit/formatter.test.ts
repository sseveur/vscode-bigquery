import * as assert from 'assert';
import { formatBigQuerySQL, type FormatOptions } from '../../language/bqsqlFormatter';

// Baseline options used by most cases. Individual tests override per-key.
const BASE: Partial<FormatOptions> = {
    tabWidth: 4,
    useTabs: false,
    keywordCase: 'upper',
    indentStyle: 'standard',
    leadingCommas: false,
    logicalOperatorStyle: 'indented',
    logicalOperatorNewline: 'before',
    expressionWidth: 50,
    inlineKeyClauses: false,
};

const lines = (s: string) => s.split('\n');

suite('bqsqlFormatter', () => {

    test('keyword case → upper', () => {
        const out = formatBigQuerySQL('select 1 from t', BASE);
        assert.ok(/^SELECT\b/m.test(out), out);
        assert.ok(/\bFROM\b/.test(out), out);
    });

    test('leading commas off → trailing commas on SELECT list', () => {
        const out = formatBigQuerySQL('SELECT a, b, c FROM t', { ...BASE, leadingCommas: false });
        // No line should begin with a comma.
        assert.ok(!lines(out).some(l => l.trimStart().startsWith(',')), out);
    });

    test('leading commas on → comma-first continuation lines', () => {
        const out = formatBigQuerySQL('SELECT a, b, c FROM t', { ...BASE, leadingCommas: true });
        const leadingCommaLines = lines(out).filter(l => l.trimStart().startsWith(', '));
        assert.ok(leadingCommaLines.length >= 2, out);
    });

    suite('logical operator style', () => {
        const sql = 'SELECT * FROM t WHERE a = 1 AND b = 2';

        test('indented (default): AND sits on its own line, indented, never at column 0', () => {
            const out = formatBigQuerySQL(sql, { ...BASE, logicalOperatorStyle: 'indented' });
            const andLine = lines(out).find(l => /\bAND\b/.test(l));
            assert.ok(andLine, 'expected an AND line\n' + out);
            assert.ok(/^\s+AND\b/.test(andLine!), `AND should be indented, got: "${andLine}"`);
            assert.ok(!/^AND\b/.test(andLine!), 'AND must not be at column 0');
        });

        test('contentAligned: AND aligns to the WHERE content column', () => {
            const out = formatBigQuerySQL(sql, { ...BASE, logicalOperatorStyle: 'contentAligned' });
            const andLine = lines(out).find(l => /\bAND\b/.test(l));
            assert.ok(andLine && /^\s+AND\b/.test(andLine), out);
        });
    });

    // Issue #9: in tabular indent styles the CTE-body realign used to dump ON/AND at column 0.
    suite('#9 CTE tabular realign keeps ON/AND in the gutter', () => {
        const cte = [
            'WITH joined AS (',
            'SELECT a.id, b.val FROM tbl_a a INNER JOIN tbl_b b ON a.id = b.id AND a.k = b.k',
            ')',
            'SELECT * FROM joined',
        ].join('\n');

        for (const indentStyle of ['tabularLeft', 'tabularRight'] as const) {
            test(`${indentStyle}: no ON/AND line lands at column 0`, () => {
                const out = formatBigQuerySQL(cte, { ...BASE, indentStyle });
                const offenders = lines(out).filter(l => /^(ON|AND)\b/.test(l));
                assert.strictEqual(offenders.length, 0,
                    `ON/AND dumped at column 0:\n${out}`);
                // And they must actually still be present (indented), not swallowed.
                assert.ok(lines(out).some(l => /^\s+ON\b/.test(l)), `ON missing/!indented:\n${out}`);
                assert.ok(lines(out).some(l => /^\s+AND\b/.test(l)), `AND missing/!indented:\n${out}`);
            });
        }
    });

    // Issue #10: window-frame "RANGE/ROWS BETWEEN … PRECEDING AND CURRENT ROW" was split so the
    // frame AND got mistaken for a logical operator and mangled.
    suite('#10 analytic window frame is preserved', () => {
        const cases = [
            'SELECT SUM(x) OVER (PARTITION BY a ORDER BY b ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) FROM t',
            'SELECT AVG(x) OVER (ORDER BY b RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) FROM t',
            'SELECT COUNT(*) OVER (ORDER BY b ROWS BETWEEN 2 PRECEDING AND 1 FOLLOWING) FROM t',
        ];

        for (const sql of cases) {
            test(sql.match(/(ROWS|RANGE) BETWEEN [^)]+/)![0], () => {
                const out = formatBigQuerySQL(sql, BASE);
                // The full frame must appear intact on a single line.
                assert.ok(
                    /(ROWS|RANGE)\s+BETWEEN\s+.+\s+AND\s+.+/i.test(out),
                    `frame split/mangled:\n${out}`
                );
                // The frame AND must NOT have been hoisted to its own column-0 line.
                assert.ok(!lines(out).some(l => /^AND\b/.test(l)), `frame AND hoisted:\n${out}`);
            });
        }
    });

    test('idempotent: formatting twice yields the same text', () => {
        const sql = [
            'WITH joined AS (',
            'SELECT a.id, SUM(b.val) OVER (PARTITION BY a.id ORDER BY b.ts ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) s',
            'FROM tbl_a a LEFT JOIN tbl_b b ON a.id = b.id AND a.k = b.k WHERE a.x > 0 AND b.y < 10',
            ')',
            'SELECT * FROM joined ORDER BY id',
        ].join('\n');
        const once = formatBigQuerySQL(sql, { ...BASE, indentStyle: 'tabularLeft' });
        const twice = formatBigQuerySQL(once, { ...BASE, indentStyle: 'tabularLeft' });
        assert.strictEqual(twice, once, `formatter not idempotent:\n--- once ---\n${once}\n--- twice ---\n${twice}`);
    });
});
