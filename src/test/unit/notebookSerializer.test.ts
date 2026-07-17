import * as assert from 'assert';
import { textToNotebookData } from '../../notebook/bqSqlNotebookSerializer';

const cellValues = (d: { cells: unknown[] }) => (d.cells as Array<{ value: string }>).map(c => c.value);

suite('textToNotebookData (Open as Notebook on unsaved buffers)', () => {

    test('empty text → single empty cell', () => {
        const d = textToNotebookData('   ');
        assert.deepStrictEqual(cellValues(d), ['']);
    });

    test('plain SQL auto-splits into one cell per statement', () => {
        const d = textToNotebookData('SELECT 1;\n\nSELECT 2;');
        const values = cellValues(d);
        assert.strictEqual(values.length, 2);
        assert.ok(values[0].includes('SELECT 1'));
        assert.ok(values[1].includes('SELECT 2'));
    });

    test('-- %% markers win over auto-split', () => {
        const d = textToNotebookData('-- %%\nSELECT 1;\nSELECT 2;\n\n-- %%\nSELECT 3;');
        const values = cellValues(d);
        assert.strictEqual(values.length, 2);
        assert.ok(values[0].includes('SELECT 1') && values[0].includes('SELECT 2'));
        assert.ok(values[1].includes('SELECT 3'));
    });

    test('unsplittable text falls back to a single cell with the raw text', () => {
        const d = textToNotebookData('-- just a comment, no statements');
        assert.strictEqual(cellValues(d).length, 1);
    });

    test('comment between two statements is kept, attached to the following cell (#14)', () => {
        const d = textToNotebookData('SELECT 1 AS a;\n\n-- explains the next query\nSELECT 2 AS b;');
        const values = cellValues(d);
        assert.strictEqual(values.length, 2);
        assert.ok(values[0].includes('SELECT 1'), 'first cell has first statement');
        assert.ok(values[1].includes('-- explains the next query'), 'comment preserved');
        assert.ok(values[1].includes('SELECT 2'), 'comment leads into its statement');
        assert.ok(!values[0].includes('explains'), 'comment not duplicated into first cell');
    });

    test('leading comment before the first statement is kept', () => {
        const d = textToNotebookData('-- header note\nSELECT 1 AS a;\nSELECT 2 AS b;');
        const values = cellValues(d);
        assert.strictEqual(values.length, 2);
        assert.ok(values[0].includes('-- header note') && values[0].includes('SELECT 1'));
    });

    test('trailing comment after the last statement is kept on the last cell', () => {
        const d = textToNotebookData('SELECT 1 AS a;\nSELECT 2 AS b;\n\n-- footer note');
        const values = cellValues(d);
        assert.strictEqual(values.length, 2);
        assert.ok(values[1].includes('SELECT 2') && values[1].includes('-- footer note'));
    });

    test('no-comment SQL still yields clean statement-only cells', () => {
        const d = textToNotebookData('SELECT 1 AS a;\n\nSELECT 2 AS b;');
        const values = cellValues(d);
        assert.deepStrictEqual(values, ['SELECT 1 AS a', 'SELECT 2 AS b']);
    });
});
