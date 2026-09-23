import * as assert from 'assert';
import { getContentSecurityPolicy, getNonce } from '../../utils/webviewSecurity';

const webview = { cspSource: 'https://x.vscode-cdn.net' } as any;

suite('webviewSecurity', () => {
    test('nonce is 128-bit base64 and differs per call', () => {
        const a = getNonce();
        assert.match(a, /^[A-Za-z0-9+/]{22}==$/);
        assert.notStrictEqual(a, getNonce());
    });

    test('policy: nothing by default, scripts by nonce or extension files only, no eval / wasm', () => {
        const csp = getContentSecurityPolicy(webview, 'N');
        assert.ok(csp.startsWith("default-src 'none';"));
        assert.ok(csp.includes("script-src 'nonce-N' https://x.vscode-cdn.net;"));
        assert.ok(csp.includes("connect-src 'none'"));
        assert.ok(!/unsafe-eval|wasm-unsafe-eval|\*|https:(?!\/\/x\.)/.test(csp));
        assert.ok(!csp.includes('blob:'));
        assert.ok(!csp.includes("'unsafe-inline'"));
    });

    test('options add only inline styles and blob: images', () => {
        const csp = getContentSecurityPolicy(webview, 'N', { allowUnsafeInlineStyles: true, allowBlobImages: true });
        assert.ok(csp.includes("style-src https://x.vscode-cdn.net 'unsafe-inline';"));
        assert.ok(csp.includes('img-src https://x.vscode-cdn.net data: blob:;'));
        assert.ok(csp.includes("script-src 'nonce-N' https://x.vscode-cdn.net;"));
    });
});
