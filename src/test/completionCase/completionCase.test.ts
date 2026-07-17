import * as assert from 'assert';
import * as vscode from 'vscode';

/**
 * Verifies FR #13: keyword/function completions respect the new
 * vscode-bigquery.completionKeywordCase / completionFunctionCase settings.
 * Runs in the real Extension Host (no network / no BigQuery creds needed) and
 * inspects the CompletionItem the provider actually produces.
 */
suite('Completion case settings', () => {

    async function itemsFor(content: string, offset: number): Promise<vscode.CompletionItem[]> {
        const doc = await vscode.workspace.openTextDocument({ language: 'bqsql', content });
        await vscode.window.showTextDocument(doc);
        const pos = doc.positionAt(offset);
        const list = await vscode.commands.executeCommand<vscode.CompletionList>(
            'vscode.executeCompletionItemProvider', doc.uri, pos
        );
        return list?.items ?? [];
    }

    function insertOf(item: vscode.CompletionItem): string {
        const it = item.insertText;
        if (typeof it === 'string') { return it; }
        if (it && (it as vscode.SnippetString).value !== undefined) { return (it as vscode.SnippetString).value; }
        return typeof item.label === 'string' ? item.label : item.label.label;
    }

    function findByInsert(items: vscode.CompletionItem[], re: RegExp): vscode.CompletionItem | undefined {
        return items.find(i => re.test(insertOf(i)));
    }

    async function set(key: string, val: string) {
        await vscode.workspace.getConfiguration('vscode-bigquery').update(key, val, vscode.ConfigurationTarget.Global);
    }

    suiteSetup(async () => {
        const ext = vscode.extensions.getExtension('s-seveur.bigquery-studio');
        if (!ext) { assert.fail('extension not found'); }
        await ext.activate();
    });

    test('keyword upper -> SELECT', async () => {
        await set('completionKeywordCase', 'upper');
        const items = await itemsFor('S', 1);
        const kw = findByInsert(items, /^SELECT\s?$/i);
        assert.ok(kw, 'SELECT keyword completion present');
        assert.strictEqual(insertOf(kw).trim(), 'SELECT');
    });

    test('keyword lower -> select', async () => {
        await set('completionKeywordCase', 'lower');
        const items = await itemsFor('S', 1);
        const kw = findByInsert(items, /^select\s?$/);
        assert.ok(kw, 'lowercase select present');
        assert.strictEqual(insertOf(kw).trim(), 'select');
        assert.strictEqual(typeof kw.label === 'string' ? kw.label : kw.label.label, 'select', 'label also lowercased');
    });

    test('keyword preserve -> WHERE (source case)', async () => {
        await set('completionKeywordCase', 'preserve');
        const items = await itemsFor('W', 1);
        const kw = findByInsert(items, /^WHERE\s?$/);
        assert.ok(kw, 'preserve keeps source uppercase WHERE');
    });

    test('function lower -> count', async () => {
        await set('completionFunctionCase', 'lower');
        const items = await itemsFor('C', 1);
        const fn = findByInsert(items, /^count\(/);
        assert.ok(fn, 'lowercase count( snippet present');
        assert.ok(insertOf(fn).startsWith('count('), 'function snippet lowercased');
    });

    test('function preserve -> COUNT (default)', async () => {
        await set('completionFunctionCase', 'preserve');
        const items = await itemsFor('C', 1);
        const fn = findByInsert(items, /^COUNT\(/);
        assert.ok(fn, 'preserve keeps uppercase COUNT(');
    });
});
