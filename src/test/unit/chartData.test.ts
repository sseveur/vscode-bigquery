import * as assert from 'assert';
import { buildChartGroups, buildChartSeries, compactNumber, dimensionColumns, formatTimeTick, MAX_SERIES, niceTicks, numericColumns, OTHER_SERIES } from '../../tableResultsPanel/grid/chartData';
import type { FlatColumn } from '../../tableResultsPanel/grid/cellFormatters';
import type { BqField } from '../../tableResultsPanel/grid/types';

const col = (name: string, type: string, mode = 'NULLABLE'): FlatColumn =>
    ({ key: name, label: name, type, mode, path: [name] });

const fields: BqField[] = [
    { name: 'country', type: 'STRING' },
    { name: 'amount', type: 'FLOAT64' },
    { name: 'ts', type: 'TIMESTAMP' },
];
const row = (country: string | null, amount: string | null, ts: string | null) =>
    ({ f: [{ v: country }, { v: amount }, { v: ts }] });

const country = col('country', 'STRING');
const amount = col('amount', 'FLOAT64');
const ts = col('ts', 'TIMESTAMP');

suite('chartData', () => {

    suite('column classification', () => {
        test('numericColumns keeps numeric scalars, drops strings and REPEATED', () => {
            const cols = [country, amount, col('tags', 'STRING', 'REPEATED'), col('n', 'INT64', 'REPEATED')];
            assert.deepStrictEqual(numericColumns(cols).map(c => c.key), ['amount']);
        });
        test('dimensionColumns drops REPEATED and STRUCT', () => {
            const cols = [country, amount, col('s', 'RECORD'), col('tags', 'STRING', 'REPEATED')];
            assert.deepStrictEqual(dimensionColumns(cols).map(c => c.key), ['country', 'amount']);
        });
    });

    suite('buildChartSeries — categorical x', () => {
        const rows = [
            row('FR', '10', null), row('FR', '5', null),
            row('DE', '20', null), row('BE', '1', null), row(null, '9', null),
        ];

        test('count per category when no measure, sorted desc', () => {
            const s = buildChartSeries(rows, fields, country, null);
            assert.strictEqual(s.kind, 'category');
            assert.deepStrictEqual(s.points[0], { x: 'FR', y: 2 });
            assert.strictEqual(s.skipped, 1); // null country
        });

        test('sum of measure per category', () => {
            const s = buildChartSeries(rows, fields, country, amount);
            assert.deepStrictEqual(s.points.map(p => [p.x, p.y]), [['DE', 20], ['FR', 15], ['BE', 1]]);
        });

        test('caps categories and flags truncation', () => {
            const many = Array.from({ length: 40 }, (_, i) => row(`c${i}`, '1', null));
            const s = buildChartSeries(many, fields, country, null, 'sum', 30);
            assert.strictEqual(s.points.length, 30);
            assert.strictEqual(s.truncated, true);
        });
    });

    suite('buildChartSeries — numeric / time x', () => {
        test('numeric x sorted ascending, y from measure', () => {
            const rows = [row('a', '3', null), row('b', '1', null), row('c', '2', null)];
            const s = buildChartSeries(rows, fields, amount, amount);
            assert.strictEqual(s.kind, 'linear');
            assert.deepStrictEqual(s.points.map(p => p.x), [1, 2, 3]);
        });

        test('TIMESTAMP float-seconds become epoch ms', () => {
            const rows = [row('a', '1', '1609459200'), row('b', '2', '0')];
            const s = buildChartSeries(rows, fields, ts, amount);
            assert.strictEqual(s.kind, 'time');
            assert.deepStrictEqual(s.points.map(p => p.x), [0, 1609459200000]);
        });

        test('unparsable x rows are skipped and counted', () => {
            const rows = [row('a', '1', 'not-a-ts'), row('b', '2', '100')];
            const s = buildChartSeries(rows, fields, ts, amount);
            assert.strictEqual(s.points.length, 1);
            assert.strictEqual(s.skipped, 1);
        });
    });

    suite('niceTicks', () => {
        test('produces round steps covering the span', () => {
            const t = niceTicks(0, 97, 5);
            assert.strictEqual(t[0], 0);
            assert.ok(t[t.length - 1] >= 97);
            assert.ok(t.every((v, i) => i === 0 || v > t[i - 1]));
        });
        test('handles min === max', () => {
            assert.deepStrictEqual(niceTicks(5, 5), [0, 5]);
        });
        test('no floating point noise', () => {
            assert.ok(niceTicks(0, 1, 5).every(v => String(v).length <= 4));
        });
    });

    test('compactNumber', () => {
        assert.strictEqual(compactNumber(950), '950');
        assert.strictEqual(compactNumber(1200), '1.2K');
        assert.strictEqual(compactNumber(2500000), '2.5M');
        assert.strictEqual(compactNumber(3000000000), '3B');
    });

    test('formatTimeTick precision follows span', () => {
        const jan1 = Date.UTC(2021, 0, 1, 12, 30);
        assert.strictEqual(formatTimeTick(jan1, 400 * 864e5), '2021-01');
        assert.strictEqual(formatTimeTick(jan1, 10 * 864e5), '01-01');
        assert.strictEqual(formatTimeTick(jan1, 3600e3), '12:30');
    });
});

suite('chartData — aggregations', () => {
    const col = (name: string, type: string): any => ({ key: name, label: name, type, mode: 'NULLABLE', path: [name] });
    const fields: any[] = [{ name: 'country', type: 'STRING' }, { name: 'amount', type: 'FLOAT64' }];
    const row = (c: string, a: string) => ({ f: [{ v: c }, { v: a }] });
    const rows = [row('FR', '10'), row('FR', '20'), row('DE', '5')];
    const country = col('country', 'STRING');
    const amount = col('amount', 'FLOAT64');

    test('avg per category', () => {
        const s = buildChartSeries(rows as any, fields, country, amount, 'avg');
        assert.deepStrictEqual(s.points.map(p => [p.x, p.y]), [['FR', 15], ['DE', 5]]);
    });
    test('min per category', () => {
        const s = buildChartSeries(rows as any, fields, country, amount, 'min');
        assert.deepStrictEqual(s.points.map(p => [p.x, p.y]), [['FR', 10], ['DE', 5]]);
    });
    test('max per category', () => {
        const s = buildChartSeries(rows as any, fields, country, amount, 'max');
        assert.deepStrictEqual(s.points.map(p => [p.x, p.y]), [['FR', 20], ['DE', 5]]);
    });
    test('count ignores agg', () => {
        const s = buildChartSeries(rows as any, fields, country, null, 'avg');
        assert.deepStrictEqual(s.points.map(p => [p.x, p.y]), [['FR', 2], ['DE', 1]]);
    });
});

suite('chartData — multi-series (color by column)', () => {
    const mkcol = (name: string, type: string): any => ({ key: name, label: name, type, mode: 'NULLABLE', path: [name] });
    const mfields: any[] = [
        { name: 'country', type: 'STRING' },
        { name: 'amount', type: 'FLOAT64' },
        { name: 'channel', type: 'STRING' },
    ];
    const mrow = (c: string | null, a: string, ch: string | null) => ({ f: [{ v: c }, { v: a }, { v: ch }] });
    const mcountry = mkcol('country', 'STRING');
    const mamount = mkcol('amount', 'FLOAT64');
    const mchannel = mkcol('channel', 'STRING');

    test('splits into one series per color value, aligned to shared categories', () => {
        const rows = [
            mrow('FR', '10', 'web'), mrow('FR', '5', 'app'),
            mrow('DE', '20', 'web'), mrow('DE', '1', 'app'),
        ];
        const g = buildChartGroups(rows as any, mfields, mcountry, mamount, 'sum', mchannel);
        assert.deepStrictEqual(g.categories, ['DE', 'FR']); // by combined total desc
        assert.deepStrictEqual(g.series.map(s => s.name), ['web', 'app']); // by series total desc
        const web = g.series[0];
        assert.deepStrictEqual(web.values, [20, 10]);
        assert.strictEqual(g.seriesFolded, false);
    });

    test('null in the color column becomes a NULL series', () => {
        const rows = [mrow('FR', '1', null), mrow('FR', '2', 'web')];
        const g = buildChartGroups(rows as any, mfields, mcountry, mamount, 'sum', mchannel);
        assert.ok(g.series.some(s => s.name === 'NULL'));
    });

    test('more than MAX_SERIES values fold into Other, avg stays correct', () => {
        const rows: any[] = [];
        for (let i = 0; i < 8; i++) { rows.push(mrow('FR', String(100 - i * 10), `ch${i}`)); }
        // ch6/ch7 fold into Other: values 40 and 30 → avg 35
        const g = buildChartGroups(rows, mfields, mcountry, mamount, 'avg', mchannel);
        assert.strictEqual(g.seriesFolded, true);
        assert.strictEqual(g.series.length, MAX_SERIES + 1);
        const other = g.series.find(s => s.name === OTHER_SERIES)!;
        assert.deepStrictEqual(other.values, [35]);
    });

    test('missing category/series combination stays null (gap, not zero)', () => {
        const rows = [mrow('FR', '10', 'web'), mrow('DE', '20', 'app')];
        const g = buildChartGroups(rows as any, mfields, mcountry, mamount, 'sum', mchannel);
        const web = g.series.find(s => s.name === 'web')!;
        const deIdx = g.categories!.indexOf('DE');
        assert.strictEqual(web.values[deIdx], null);
    });

    test('linear x: per-series sorted point lists', () => {
        const rows = [
            mrow('a', '3', 'web'), mrow('b', '1', 'web'), mrow('c', '2', 'app'),
        ];
        const g = buildChartGroups(rows as any, mfields, mamount, mamount, 'sum', mchannel);
        assert.strictEqual(g.kind, 'linear');
        const web = g.series.find(s => s.name === 'web')!;
        assert.deepStrictEqual(web.points.map(p => p.x), [1, 3]);
    });
});
