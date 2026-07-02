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
});
