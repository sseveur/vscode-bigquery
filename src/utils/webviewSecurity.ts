import * as vscode from 'vscode';

/**
 * Generates a cryptographically random nonce for Content Security Policy.
 * Used to allow specific inline scripts while blocking others.
 */
export function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

/**
 * Generates a Content Security Policy string for webviews.
 * @param webview - The webview to generate CSP for
 * @param nonce - The nonce to use for inline scripts
 * @param options - Additional CSP options
 */
export function getContentSecurityPolicy(
    webview: vscode.Webview,
    nonce: string,
    options?: {
        allowUnsafeInlineStyles?: boolean;
        allowExternalScripts?: string[];
    }
): string {
    const stylesSrc = options?.allowUnsafeInlineStyles
        ? `${webview.cspSource} 'unsafe-inline'`
        : webview.cspSource;

    let scriptSrc = `'nonce-${nonce}' ${webview.cspSource}`;
    if (options?.allowExternalScripts) {
        scriptSrc += ' ' + options.allowExternalScripts.join(' ');
    }

    return `
        default-src 'none';
        script-src ${scriptSrc};
        style-src ${stylesSrc};
        img-src ${webview.cspSource} data: https:;
        font-src ${webview.cspSource};
        connect-src https://bigquery.googleapis.com;
    `.replace(/\s+/g, ' ').trim();
}

/**
 * Generates a meta tag with Content Security Policy for webview HTML.
 */
export function getCspMetaTag(
    webview: vscode.Webview,
    nonce: string,
    options?: {
        allowUnsafeInlineStyles?: boolean;
        allowExternalScripts?: string[];
    }
): string {
    const csp = getContentSecurityPolicy(webview, nonce, options);
    return `<meta http-equiv="Content-Security-Policy" content="${csp}">`;
}
