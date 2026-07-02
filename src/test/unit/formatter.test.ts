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

    // Issue: tabular styles scattered function-call arguments — sql-formatter put AND/OR at the
    // clause gutter inside LOGICAL_OR(...), padded ORDER BY inside STRING_AGG(...), and the
    // realign compounded it via phantom clause depths. Args must nest under the call instead.
    suite('function-call args in tabular styles', () => {
        const sql = [
            'SELECT ps.profile_id,',
            "LOGICAL_OR(s.h = 'x' AND (ps.e IS NULL OR ps.e > CURRENT_TIMESTAMP())) AS f,",
            'STRING_AGG(DISTINCT s.handle ORDER BY s.handle) AS g',
            'FROM t ps GROUP BY ps.profile_id',
        ].join('\n');

        for (const indentStyle of ['tabularLeft', 'tabularRight'] as const) {
            test(`${indentStyle}: AND/OR stay nested in the args, never in the clause gutter`, () => {
                const out = formatBigQuerySQL(sql, { ...BASE, indentStyle });
                const outLines = lines(out);
                const gutterCol = outLines.find(l => /^\s*FROM\b/i.test(l))!.match(/^\s*/)![0].length;
                for (const l of outLines) {
                    const m = l.match(/^(\s*)(AND|OR)\b/);
                    if (!m) { continue; }
                    // Function-arg AND/OR must sit deeper than the clause keyword column and
                    // never carry tabular padding after the keyword.
                    assert.ok(m[1].length > gutterCol, `gutter-aligned ${m[2]}:\n${out}`);
                    assert.ok(!new RegExp(`^\\s*${m[2]}\\s{2,}`).test(l), `padded ${m[2]}:\n${out}`);
                }
            });
        }

        test('ORDER BY inside STRING_AGG keeps single spacing and stays indented', () => {
            const out = formatBigQuerySQL(sql, { ...BASE, indentStyle: 'tabularLeft' });
            const orderBy = lines(out).find(l => /ORDER\s+BY\s+s\.handle/i.test(l));
            assert.ok(orderBy, 'ORDER BY line missing:\n' + out);
            assert.ok(!/ORDER\s+BY\s{2,}/i.test(orderBy!), `padded ORDER BY:\n${out}`);
        });

        test('function-arg layout is idempotent', () => {
            const opts = { ...BASE, indentStyle: 'tabularLeft' as const };
            const once = formatBigQuerySQL(sql, opts);
            assert.strictEqual(formatBigQuerySQL(once, opts), once);
        });
    });

    // User feedback: sql-formatter starts a CTE body at the WITH content column (~10 deep);
    // nested clause scopes are re-based to one tab per depth, with ")" and ", name AS (" at
    // the parent keyword column.
    suite('CTE body sits one tab in (tabular)', () => {
        const sql = [
            'WITH a AS (SELECT x, y FROM t WHERE x > 0),',
            'b AS (SELECT * FROM a)',
            'SELECT * FROM b JOIN a ON a.x = b.x',
        ].join('\n');

        test('tabularLeft: CTE-body clause keywords start at one tabWidth', () => {
            const out = formatBigQuerySQL(sql, { ...BASE, indentStyle: 'tabularLeft' });
            const outLines = lines(out);
            const bodySelect = outLines.find(l => /^\s+SELECT\b/.test(l));
            assert.ok(bodySelect, 'no indented SELECT found:\n' + out);
            assert.strictEqual(bodySelect!.match(/^\s*/)![0].length, 4, `body not one tab in:\n${out}`);
        });

        test('closing paren and follow-up CTE name align at column 0', () => {
            const out = formatBigQuerySQL(sql, { ...BASE, indentStyle: 'tabularLeft' });
            assert.ok(lines(out).some(l => /^\)/.test(l)), `no column-0 ")":\n${out}`);
            assert.ok(lines(out).some(l => /^,?\s?b AS \($/i.test(l.trim()) && /^[,b]/.test(l)),
                `follow-up CTE name not at column 0:\n${out}`);
        });
    });

    test('tabular: CREATE TEMP TABLE statement head is not split by gutter padding', () => {
        const out = formatBigQuerySQL(
            'CREATE TEMP TABLE test AS SELECT 1 AS a',
            { ...BASE, indentStyle: 'tabularLeft' }
        );
        assert.ok(/^CREATE TEMP TABLE test AS$/m.test(out) || /^CREATE TEMP TABLE test AS\b/m.test(out),
            `CREATE head split:\n${out}`);
        assert.ok(!/CREATE\s{2,}/.test(out), `CREATE padded:\n${out}`);
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
