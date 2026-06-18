import * as assert from 'assert';
import {
    formatScalar,
    flattenSchema,
    decodeBqValue,
    extractRowValue,
    renderCellValue,
    escapeHtml,
    type FlatColumn,
} from '../../tableResultsPanel/grid/cellFormatters';
import type { BqField } from '../../tableResultsPanel/grid/types';

suite('cellFormatters', () => {

    suite('formatScalar', () => {
        test('null / undefined → null', () => {
            assert.strictEqual(formatScalar(null, 'STRING'), null);
            assert.strictEqual(formatScalar(undefined, 'INT64'), null);
        });

        test('TIMESTAMP float-seconds → ISO string', () => {
            // BigQuery default wire format for TIMESTAMP is float seconds since epoch.
            assert.strictEqual(formatScalar('0', 'TIMESTAMP'), '1970-01-01T00:00:00.000Z');
            assert.strictEqual(formatScalar('1609459200', 'TIMESTAMP'), '2021-01-01T00:00:00.000Z');
        });

        test('TIMESTAMP non-numeric falls back to raw', () => {
            assert.strictEqual(formatScalar('not-a-number', 'TIMESTAMP'), 'not-a-number');
        });

        test('numeric types pass through as string', () => {
            assert.strictEqual(formatScalar(42, 'INT64'), '42');
            assert.strictEqual(formatScalar('3.14', 'FLOAT64'), '3.14');
            assert.strictEqual(formatScalar('9223372036854775807', 'INT64'), '9223372036854775807');
        });

        test('BOOL normalizes to true/false', () => {
            assert.strictEqual(formatScalar('true', 'BOOL'), 'true');
            assert.strictEqual(formatScalar('false', 'BOOL'), 'false');
            assert.strictEqual(formatScalar('anything-else', 'BOOLEAN'), 'false');
        });

        test('JSON object stringified, JSON string passed through', () => {
            assert.strictEqual(formatScalar({ a: 1 }, 'JSON'), '{"a":1}');
            assert.strictEqual(formatScalar('{"a":1}', 'JSON'), '{"a":1}');
        });

        test('unknown type → String(raw)', () => {
            assert.strictEqual(formatScalar(123, undefined), '123');
        });
    });

    suite('flattenSchema', () => {
        test('flat scalars keep name/type/mode', () => {
            const fields: BqField[] = [
                { name: 'id', type: 'INTEGER', mode: 'REQUIRED' },
                { name: 'label', type: 'string' },
            ];
            const flat = flattenSchema(fields);
            assert.deepStrictEqual(flat.map(c => c.key), ['id', 'label']);
            assert.strictEqual(flat[0].type, 'INTEGER');
            assert.strictEqual(flat[0].mode, 'REQUIRED');
            // defaults applied
            assert.strictEqual(flat[1].type, 'STRING');
            assert.strictEqual(flat[1].mode, 'NULLABLE');
        });

        test('nullable RECORD is expanded into dotted leaf columns', () => {
            const fields: BqField[] = [{
                name: 'addr', type: 'RECORD', mode: 'NULLABLE',
                fields: [
                    { name: 'city', type: 'STRING' },
                    { name: 'zip', type: 'STRING' },
                ],
            }];
            const flat = flattenSchema(fields);
            assert.deepStrictEqual(flat.map(c => c.key), ['addr.city', 'addr.zip']);
            assert.deepStrictEqual(flat.map(c => c.label), ['addr.city', 'addr.zip']);
            assert.deepStrictEqual(flat[0].path, ['addr', 'city']);
        });

        test('REPEATED RECORD stays a single column (not expanded)', () => {
            const fields: BqField[] = [{
                name: 'items', type: 'RECORD', mode: 'REPEATED',
                fields: [{ name: 'sku', type: 'STRING' }],
            }];
            const flat = flattenSchema(fields);
            assert.strictEqual(flat.length, 1);
            assert.strictEqual(flat[0].key, 'items');
            assert.strictEqual(flat[0].mode, 'REPEATED');
        });
    });

    suite('decodeBqValue', () => {
        test('null → null', () => {
            assert.strictEqual(decodeBqValue(null, { name: 'x', type: 'STRING' }), null);
        });

        test('REPEATED scalar peels the { v } wrappers into an array', () => {
            const field: BqField = { name: 'tags', type: 'STRING', mode: 'REPEATED' };
            const raw = [{ v: 'a' }, { v: 'b' }, { v: 'c' }];
            assert.deepStrictEqual(decodeBqValue(raw, field), ['a', 'b', 'c']);
        });

        test('RECORD { f: [{ v }] } → plain object keyed by sub-field name', () => {
            const field: BqField = {
                name: 'addr', type: 'RECORD', mode: 'NULLABLE',
                fields: [{ name: 'city', type: 'STRING' }, { name: 'zip', type: 'STRING' }],
            };
            const raw = { f: [{ v: 'Paris' }, { v: '75001' }] };
            assert.deepStrictEqual(decodeBqValue(raw, field), { city: 'Paris', zip: '75001' });
        });

        test('REPEATED RECORD → array of objects', () => {
            const field: BqField = {
                name: 'items', type: 'RECORD', mode: 'REPEATED',
                fields: [{ name: 'sku', type: 'STRING' }],
            };
            const raw = [{ v: { f: [{ v: 'A1' }] } }, { v: { f: [{ v: 'B2' }] } }];
            assert.deepStrictEqual(decodeBqValue(raw, field), [{ sku: 'A1' }, { sku: 'B2' }]);
        });
    });

    suite('extractRowValue', () => {
        const fields: BqField[] = [
            { name: 'id', type: 'INTEGER' },
            {
                name: 'addr', type: 'RECORD', mode: 'NULLABLE',
                fields: [{ name: 'city', type: 'STRING' }],
            },
        ];
        // wire row: id=7, addr.city="Lyon"
        const row = { f: [{ v: '7' }, { v: { f: [{ v: 'Lyon' }] } }] };

        test('top-level scalar by path', () => {
            assert.strictEqual(extractRowValue(row, fields, ['id']), '7');
        });

        test('nested record leaf by path', () => {
            assert.strictEqual(extractRowValue(row, fields, ['addr', 'city']), 'Lyon');
        });

        test('unknown path segment → undefined', () => {
            assert.strictEqual(extractRowValue(row, fields, ['nope']), undefined);
        });
    });

    suite('renderCellValue', () => {
        const scalarCol: FlatColumn = { key: 'n', label: 'n', type: 'INT64', mode: 'NULLABLE', path: ['n'] };
        const repeatedCol: FlatColumn = { key: 't', label: 't', type: 'STRING', mode: 'REPEATED', path: ['t'] };
        const structCol: FlatColumn = { key: 's', label: 's', type: 'RECORD', mode: 'NULLABLE', path: ['s'] };

        test('null → NULL flagged isNull', () => {
            const r = renderCellValue(null, scalarCol);
            assert.strictEqual(r.html, 'NULL');
            assert.strictEqual(r.isNull, true);
        });

        test('scalar formatted + html-escaped', () => {
            assert.deepStrictEqual(renderCellValue(42, scalarCol), { html: '42', isNull: false });
        });

        test('REPEATED scalar rendered as bracketed list', () => {
            const r = renderCellValue(['a', 'b'], repeatedCol);
            assert.strictEqual(r.html, '[ a, b ]');
            assert.strictEqual(r.isNull, false);
        });

        test('STRUCT rendered as escaped JSON', () => {
            const r = renderCellValue({ city: 'a<b' }, structCol);
            assert.strictEqual(r.html, '{&quot;city&quot;:&quot;a&lt;b&quot;}');
        });
    });

    suite('escapeHtml', () => {
        test('escapes the five XSS-relevant chars', () => {
            assert.strictEqual(
                escapeHtml(`<script>"&'`),
                '&lt;script&gt;&quot;&amp;&#39;'
            );
        });
        test('ampersand escaped before entities (no double-escape ordering bug)', () => {
            assert.strictEqual(escapeHtml('a & <b>'), 'a &amp; &lt;b&gt;');
        });
    });
});
