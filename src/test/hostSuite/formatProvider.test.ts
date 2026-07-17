import * as assert from 'assert';
import * as vscode from 'vscode';

/**
 * Verifies FR #12: the SQL formatter is wired into VS Code's standard
 * formatting API, so vscode.executeFormatDocumentProvider (the same entry point
 * used by Format Document, the context menu, and formatOnSave) returns edits.
 *
 * Note: VS Code re-diffs the provider's full-document replace into several
 * minimal TextEdits, so we apply them and inspect the resulting document text
 * rather than any single edit.
 */
suite('Document formatting provider', () => {

    suiteSetup(async () => {
        const ext = vscode.extensions.getExtension('s-seveur.bigquery-studio');
        if (!ext) { assert.fail('extension not found'); }
        await ext.activate();
    });

    async function formatToText(content: string): Promise<{ edits: number; text: string; doc: vscode.TextDocument }> {
        const doc = await vscode.workspace.openTextDocument({ language: 'bqsql', content });
        await vscode.window.showTextDocument(doc);
        const edits = (await vscode.commands.executeCommand<vscode.TextEdit[]>(
            'vscode.executeFormatDocumentProvider', doc.uri, { tabSize: 4, insertSpaces: true }
        )) ?? [];
        const wsEdit = new vscode.WorkspaceEdit();
        wsEdit.set(doc.uri, edits);
        await vscode.workspace.applyEdit(wsEdit);
        return { edits: edits.length, text: doc.getText(), doc };
    }

    test('bqsql: provider registered and formats unformatted SQL', async () => {
        const { edits, text } = await formatToText('select a,b from t');
        assert.ok(edits > 0, 'expected at least one formatting edit');
        assert.match(text, /SELECT/, 'formatted text uppercases SELECT');
        assert.match(text, /FROM/, 'formatted text uppercases FROM');
        assert.match(text, /\n/, 'formatted text spans multiple lines');
    });

    test('bqsql: already-formatted document yields no edits', async () => {
        const { text: formatted } = await formatToText('select a,b from t');
        const doc = await vscode.workspace.openTextDocument({ language: 'bqsql', content: formatted });
        await vscode.window.showTextDocument(doc);
        const edits = (await vscode.commands.executeCommand<vscode.TextEdit[]>(
            'vscode.executeFormatDocumentProvider', doc.uri, { tabSize: 4, insertSpaces: true }
        )) ?? [];
        assert.strictEqual(edits.length, 0, 'stable formatted document should produce no edits');
    });
});
