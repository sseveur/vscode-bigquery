import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { calculateLayout, fitOrdered, getLayoutConfig } from '../../lineage/dagLayout';
import { edgePath, fitText, renderGraphToSvg } from '../../lineage/svgRenderer';
import { renderLineageHtml } from '../../lineage/lineageHtml';
import { buildMultiQueryLineage, LineageGraph, NodeType } from '../../services/lineageGraph';

const cfg = getLayoutConfig();

function graph(nodes: Array<[string, number, NodeType?]>, edges: Array<[string, string]>): LineageGraph {
    return {
        nodes: nodes.map(([id, layer, t]) => ({ id, name: id, fullName: id, nodeType: t ?? 'CTE', layer })),
        edges: edges.map(([s, t]) => ({ id: `${s}->${t}`, source: s, target: t })),
        queryPreview: '',
    };
}

/** The layout samples shipped for manual testing, laid out with the real graph builder. */
function samples(): LineageGraph[] {
    const sql = fs.readFileSync(path.join(__dirname, '../../../tests/lineage_samples.bqsql'), 'utf8');
    return buildMultiQueryLineage(sql).queries.map(q => q.graph).filter(g => g.nodes.length > 0);
}

suite('lineage layout', () => {
    test('fitOrdered is the closest ordered, spaced fit', () => {
        assert.deepStrictEqual(fitOrdered([0, 0], [1, 1], [0, 10]), [-5, 5]);
        assert.deepStrictEqual(fitOrdered([0, 100], [1, 1], [0, 10]), [0, 100]);   // already feasible: unchanged
        assert.deepStrictEqual(fitOrdered([0, 0], [3, 1], [0, 8]), [-2, 6]);      // heavier item moves less
    });

    test('a straight chain stays on one line', () => {
        const g = graph([['src', 0, 'SOURCE'], ['a', 1], ['b', 2], ['c', 3, 'RESULT']], [['src', 'a'], ['a', 'b'], ['b', 'c']]);
        calculateLayout(g);
        const ys = new Set(g.nodes.map(n => Math.round(n.y!)));
        assert.strictEqual(ys.size, 1);
    });

    test('boxes in one column never overlap and everything is inside the canvas', () => {
        for (const g of samples()) {
            const { width, height } = calculateLayout(g);
            for (const n of g.nodes) {
                assert.ok(n.x! >= cfg.paddingX - 0.01 && n.x! + cfg.nodeWidth <= width - cfg.paddingX + 0.01, `${n.id} x`);
                assert.ok(n.y! >= cfg.paddingY - 0.01 && n.y! + cfg.nodeHeight <= height - cfg.paddingY + 0.01, `${n.id} y`);
                for (const m of g.nodes) {
                    if (m !== n && m.x === n.x) { assert.ok(Math.abs(m.y! - n.y!) >= cfg.nodeSpacing - 0.01, `${n.id} / ${m.id}`); }
                }
            }
        }
    });

    test('edges that skip layers get one lane per skipped layer, clear of every box there', () => {
        let longEdges = 0;
        for (const g of samples()) {
            calculateLayout(g);
            const byId = new Map(g.nodes.map(n => [n.id, n]));
            for (const e of g.edges) {
                const span = Math.round((byId.get(e.target)!.x! - byId.get(e.source)!.x!) / cfg.layerSpacing);
                assert.strictEqual(e.waypoints?.length ?? 0, Math.max(0, span - 1), e.id);
                for (const w of e.waypoints ?? []) {
                    longEdges++;
                    for (const n of g.nodes.filter(n => n.x === w.x)) {
                        const clear = w.y <= n.y! - 8 || w.y >= n.y! + cfg.nodeHeight + 8;
                        assert.ok(clear, `${e.id} lane at ${w.y} runs through ${n.id} (${n.y}..${n.y! + cfg.nodeHeight})`);
                    }
                }
            }
        }
        assert.ok(longEdges >= 5, 'samples exercise long edges');
    });

    test('several edges into one box end at separate points', () => {
        for (const g of samples()) {
            const { width, height } = calculateLayout(g);
            const svg = renderGraphToSvg(g, width, height);
            const ends = new Map<string, string[]>();
            for (const m of svg.matchAll(/<path\s+d="([^"]+)"\s+class="edge"[\s\S]*?data-target="([^"]+)"/g)) {
                const coords = m[1].trim().split(/[ ,]+/);
                ends.set(m[2], [...(ends.get(m[2]) ?? []), coords.slice(-2).join(',')]);
            }
            assert.strictEqual([...ends.values()].flat().length, g.edges.length, 'every edge checked');
            for (const [target, pts] of ends) {
                assert.strictEqual(new Set(pts).size, pts.length, `arrowheads stack on ${target}: ${pts}`);
            }
        }
    });

    test('edge paths leave and arrive horizontally and run straight through skipped columns', () => {
        assert.strictEqual(edgePath({ x: 0, y: 10 }, { x: 100, y: 10 }, [], 160), 'M 0 10 L 100 10');
        assert.strictEqual(edgePath({ x: 0, y: 0 }, { x: 100, y: 40 }, [], 160), 'M 0 0 C 50 0, 50 40, 100 40');
        assert.strictEqual(
            edgePath({ x: 0, y: 0 }, { x: 500, y: 0 }, [{ x: 100, y: 30 }], 160),
            'M 0 0 C 50 0, 50 30, 100 30 L 260 30 C 380 30, 380 0, 500 0');
    });

    test('layout is deterministic', () => {
        const [a, b] = [samples(), samples()];
        a.forEach(g => calculateLayout(g));
        b.forEach(g => calculateLayout(g));
        assert.deepStrictEqual(a.map(g => g.nodes.map(n => [n.id, n.x, n.y])), b.map(g => g.nodes.map(n => [n.id, n.x, n.y])));
    });

    test('clicking a box goes to its line in the document, for the whole file and for a selection', () => {
        const file = fs.readFileSync(path.join(__dirname, '../../../tests/lineage_samples.bqsql'), 'utf8');
        const lines = file.split('\n');
        const lineOf = (re: RegExp) => lines.findIndex(l => re.test(l)) + 1;
        const expected: Array<[string, NodeType, number]> = [
            ['customers', 'CTE', lineOf(/^WITH customers AS/)],
            ['enriched', 'CTE', lineOf(/^enriched AS/)],
            ['final', 'CTE', lineOf(/^final AS/)],
            ['customer_risk', 'TARGET', lineOf(/^INSERT INTO mart\.customer_risk/)],
            ['flags', 'SOURCE', lineOf(/JOIN audit\.flags/)],
        ];
        const check = (g: LineageGraph) => {
            for (const [name, type, line] of expected) {
                const key = `${name}:${type}`;
                const node = g.nodes.find(n => n.name === name && n.nodeType === type)!;
                assert.strictEqual(node.sourceLine, line, `${key}`);
                // Column points at the (possibly schema-qualified) name
                const token = /^[\w.\[\]]+/.exec(lines[line - 1].slice(node.sourceColumn! - 1))?.[0].toLowerCase() ?? '';
                assert.ok(token === name || token.endsWith('.' + name), `${key} column: ${token}`);
            }
        };

        // Whole file: query 4 is the one with the INSERT
        check(buildMultiQueryLineage(file).queries.find(q => q.graph.nodes.some(n => n.nodeType === 'TARGET'))!.graph);

        // "Show Lineage (Selection)" on just that query, selected from the start of its INSERT line
        // (BigQuery puts the WITH after INSERT INTO ... (cols))
        const from = lineOf(/^INSERT INTO mart\.customer_risk/);
        const to = lineOf(/^SELECT customer_id, region, segment, score, flag, country FROM final;/);
        const selection = lines.slice(from - 1, to).join('\n');
        const q = buildMultiQueryLineage(selection, { line: from, column: 1 }).queries[0];
        check(q.graph);
        assert.strictEqual(q.startLine, from);

        // Selection starting mid-line: first-line columns shift too
        const indented = buildMultiQueryLineage('SELECT * FROM dbo.t', { line: 7, column: 5 }).queries[0].graph.nodes.find(n => n.nodeType === 'SOURCE')!;
        assert.deepStrictEqual([indented.sourceLine, indented.sourceColumn], [7, 5 + 'SELECT * FROM '.length]);
    });

    test('cards: badge tag per type, schema / write mode as subtitle, long names cut with an ellipsis', () => {
        const g = graph([['raw.orders', 0, 'SOURCE'], ['stg', 1, 'CTE'], ['mart.fct', 2, 'TARGET']], [['raw.orders', 'stg'], ['stg', 'mart.fct']]);
        g.nodes[0].name = 'orders';
        g.nodes[2].name = 'fct';
        g.nodes[2].statementType = 'INSERT';
        const { width, height } = calculateLayout(g);
        const svg = renderGraphToSvg(g, width, height);
        for (const tag of ['SRC', 'CTE', 'TGT']) { assert.ok(svg.includes(`>${tag}</text>`), tag); }
        assert.ok(/class="node-type"[^>]*>raw</.test(svg.replace(/\s+/g, ' ')), 'source shows its schema');
        assert.ok(svg.includes('INSERT · mart'), 'target shows how and where it is written');
        assert.strictEqual(fitText('a_very_long_table_name_indeed', 70, 7), 'a_very_lo\u2026');
        assert.strictEqual(fitText('short', 70, 7), 'short');
    });

    test('export: every theme colour the graph uses is in both export colour maps', () => {
        for (const g of samples()) {
            const { width, height } = calculateLayout(g);
            const svg = renderGraphToSvg(g, width, height);
            const page = renderLineageHtml([{ queryInfo: { graph: g, queryIndex: 0, startLine: 1, endLine: 1, sqlText: '' }, svg }], 'dark',
                { csp: '', nonce: 'n', codiconFontUri: 'x' });
            const map = (name: string) => new RegExp(`var ${name} = \\{([\\s\\S]*?)\\};`).exec(page)![1];
            // Attribute colours only: the font inside <style> resolves from the live theme by design
            const used = new Set([...svg.replace(/<style>[\s\S]*?<\/style>/g, '').matchAll(/var\((--[\w-]+)/g)].map(m => m[1]));
            assert.ok(used.size >= 4);
            for (const v of used) {
                assert.ok(map('darkColorMap').includes(`'${v}'`), `${v} missing from dark export map`);
                assert.ok(map('lightColorMap').includes(`'${v}'`), `${v} missing from light export map`);
            }
        }
    });

    test('export: no attribute carries a quoted font list that would break the serialized SVG', () => {
        const g = samples()[0];
        const { width, height } = calculateLayout(g);
        const svg = renderGraphToSvg(g, width, height);
        assert.ok(!/font-family="/.test(svg));
        assert.ok(/<style>text \{ font-family: var\(--vscode-font-family/.test(svg));
    });
});

