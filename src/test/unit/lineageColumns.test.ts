import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { finalSelectColumns } from '../../services/cteExtractor';
import { resolveLineageColumns, tableOf } from '../../lineage/lineageColumns';
import { calculateLayout, getLayoutConfig } from '../../lineage/dagLayout';
import { columnsCardHeight, MAX_COLUMN_ROWS, renderGraphToSvg } from '../../lineage/svgRenderer';
import { renderQuerySection } from '../../lineage/lineageHtml';
import { buildMultiQueryLineage, LineageGraph, LineageNode } from '../../services/lineageGraph';
import { ResolvedTable } from '../../services/columnResolver';

const cfg = getLayoutConfig();
const samples = buildMultiQueryLineage(fs.readFileSync(path.join(__dirname, '../../../tests/lineage_samples.bqsql'), 'utf8'))
    .queries.filter(q => q.graph.nodes.length > 0);
const copy = (g: LineageGraph): LineageGraph => JSON.parse(JSON.stringify(g));

/** Fake catalog: a few typed tables; anything else is "not found"; `ml.risk_scores` fails like an offline server. */
const CATALOG = new Map<string, Array<{ name: string; type: string }>>([
    ['raw.orders', [{ name: 'order_id', type: 'INT64' }, { name: 'customer_id', type: 'INT64' }, { name: 'amount', type: 'NUMERIC' }]],
    ['raw.customers', [{ name: 'customer_id', type: 'INT64' }, { name: 'region', type: 'STRING' }]],
    ['crm.customers', [{ name: 'customer_id', type: 'INT64' }, { name: 'region', type: 'STRING' }]],
    ['crm.segments', [{ name: 'customer_id', type: 'INT64' }, { name: 'segment', type: 'STRING' }]],
    ['mart.customer_risk', [{ name: 'customer_id', type: 'INT64' }, { name: 'region', type: 'STRING' }, { name: 'segment', type: 'STRING' },
        { name: 'score', type: 'FLOAT64' }, { name: 'flag', type: 'BOOL' }, { name: 'country', type: 'STRING' }]],
]);
const lookups: string[] = [];
const lookup = async (t: ResolvedTable) => {
    const key = `${t.datasetId}.${t.tableId}`.toLowerCase();
    lookups.push(`${t.projectId}.${key}`);
    if (key === 'ml.risk_scores') { throw new Error('server unreachable'); }
    return CATALOG.get(key) ?? [];
};
const node = (g: LineageGraph, name: string, type?: string) => g.nodes.find(n => n.name === name && (!type || n.nodeType === type))!;

suite('lineage columns', () => {
    test('finalSelectColumns: main SELECT list, INSERT column list, ignores subqueries', () => {
        assert.deepStrictEqual(finalSelectColumns('SELECT a, b AS c, t.d FROM t').map(c => c.name), ['a', 'c', 'd']);
        assert.deepStrictEqual(finalSelectColumns('SELECT DISTINCT x FROM (SELECT y FROM z) q').map(c => c.name), ['x']);
        assert.deepStrictEqual(finalSelectColumns("WITH w AS (SELECT q FROM t) SELECT 1 AS n, 'SELECT' AS s FROM w").map(c => c.name), ['n', 's']);
        assert.deepStrictEqual(finalSelectColumns('INSERT INTO ds.t (`a`, b) SELECT x, y FROM s').map(c => c.name), ['a', 'b']);
        assert.deepStrictEqual(finalSelectColumns('INSERT INTO ds.t SELECT x, y FROM s').map(c => c.name), ['x', 'y']);
        assert.deepStrictEqual(finalSelectColumns('SELECT * EXCEPT (secret), `weird col` AS w FROM `p.d.t`').map(c => c.name), ['*', 'w']);
    });

    test('tableOf fills the project from the default project', () => {
        assert.deepStrictEqual(tableOf('raw.orders', 'my-proj'), { projectId: 'my-proj', datasetId: 'raw', tableId: 'orders' });
        assert.deepStrictEqual(tableOf('`other-proj.sales.orders`'), { projectId: 'other-proj', datasetId: 'sales', tableId: 'orders' });
        assert.deepStrictEqual(tableOf('`other-proj`.`sales`.`orders`', 'my-proj'), { projectId: 'other-proj', datasetId: 'sales', tableId: 'orders' });
        assert.strictEqual(tableOf('orders', 'my-proj'), null, 'a bare name has no dataset');
        assert.strictEqual(tableOf('raw.orders'), null, 'no default project');
    });

    test('CTE chain: catalog columns for sources, types carried through CTEs, * expanded for the result', async () => {
        const g = copy(samples[1].graph);                      // stg_orders -> int_orders -> fct_orders -> SELECT *
        await resolveLineageColumns(g, samples[1].sqlText, lookup, 'my-proj');
        assert.deepStrictEqual(node(g, 'orders', 'SOURCE').columns!.map(c => c.name), ['order_id', 'customer_id', 'amount']);
        assert.deepStrictEqual(node(g, 'stg_orders').columns, [{ name: 'order_id', type: 'INT64' }, { name: 'customer_id', type: 'INT64' }, { name: 'amount', type: 'NUMERIC' }]);
        assert.deepStrictEqual(node(g, 'fct_orders').columns, [{ name: 'order_id', type: 'INT64' }, { name: 'amount', type: 'NUMERIC' }, { name: 'region', type: 'STRING' }]);
        assert.deepStrictEqual(node(g, 'Query Result', 'RESULT').columns, node(g, 'fct_orders').columns, 'SELECT * shows fct_orders columns');
    });

    test('INSERT target: its column list typed from the table; one unreachable source does not sink the rest', async () => {
        const g = copy(samples[3].graph);
        lookups.length = 0;
        await resolveLineageColumns(g, samples[3].sqlText, lookup, 'my-proj');
        const target = node(g, 'customer_risk', 'TARGET');
        assert.deepStrictEqual(target.columns!.map(c => `${c.name}:${c.type}`),
            ['customer_id:INT64', 'region:STRING', 'segment:STRING', 'score:FLOAT64', 'flag:BOOL', 'country:STRING']);
        assert.match(node(g, 'risk_scores').columnsNote!, /server unreachable/);
        assert.strictEqual(node(g, 'segments').columns!.length, 2);
        assert.strictEqual(node(g, 'geo').columnsNote, 'not found in the catalog');
        assert.strictEqual(new Set(lookups).size, lookups.length, 'each table read once');
    });

    test('tall cards: layout keeps them apart, edges still attach to the header, long lists end in "+ N more"', async () => {
        for (const q of samples) {
            const g = copy(q.graph);
            await resolveLineageColumns(g, q.sqlText, lookup, 'my-proj');
            g.nodes.forEach(n => { n.height = columnsCardHeight(n, cfg.nodeHeight); });
            const { width, height } = calculateLayout(g);
            for (const a of g.nodes) {
                assert.ok(a.y! + a.height! <= height - cfg.paddingY + 0.01, `${a.id} inside the canvas`);
                for (const b of g.nodes) {
                    if (a !== b && a.x === b.x && a.y! < b.y!) { assert.ok(b.y! >= a.y! + a.height! + 8, `${a.id} overlaps ${b.id}`); }
                }
            }
            const svg = renderGraphToSvg(g, width, height);
            let checked = 0;
            for (const m of svg.matchAll(/<path\s+d="M ([\d.]+) ([\d.]+)[^"]*"\s+class="edge"[\s\S]*?data-source="([^"]+)"/g)) {
                const src = g.nodes.find(n => n.id === m[3])!;
                assert.ok(+m[2] >= src.y! && +m[2] <= src.y! + cfg.nodeHeight, `${m[3]} edge leaves from its header`);
                checked++;
            }
            assert.strictEqual(checked, g.edges.length);
        }
        const wide: LineageNode = { id: 'w', name: 'w', fullName: 'w', nodeType: 'SOURCE', layer: 0,
            columns: Array.from({ length: MAX_COLUMN_ROWS + 5 }, (_, i) => ({ name: `c${i}`, type: 'INT64' })) };
        const g: LineageGraph = { nodes: [wide], edges: [], queryPreview: '' };
        wide.height = columnsCardHeight(wide, cfg.nodeHeight);
        const { width, height } = calculateLayout(g);
        const svg = renderGraphToSvg(g, width, height);
        assert.ok(svg.includes('+ 5 more'));
        assert.ok(!svg.includes(`>c${MAX_COLUMN_ROWS}<`));
    });

    test('section offers the Columns toggle next to the zoom controls', () => {
        const html = renderQuerySection({ queryInfo: samples[0], svg: '<svg></svg>' }, 0);
        assert.ok(/<div class="section-controls">\s*<button class="zoom-btn columns-toggle" aria-pressed="false"/.test(html));
    });
});
