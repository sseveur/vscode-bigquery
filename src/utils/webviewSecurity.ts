import * as vscode from 'vscode';
import { randomBytes } from 'crypto';

/** 128-bit random nonce for a Content Security Policy, one per rendered page. */
export function getNonce(): string {
    return randomBytes(16).toString('base64');
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
        /** blob: images, for pages that rasterise their own SVG through an <img> (lineage export). */
        allowBlobImages?: boolean;
    }
): string {
    const stylesSrc = options?.allowUnsafeInlineStyles
        ? `${webview.cspSource} 'unsafe-inline'`
        : webview.cspSource;

    return `
        default-src 'none';
        script-src 'nonce-${nonce}' ${webview.cspSource};
        style-src ${stylesSrc};
        img-src ${webview.cspSource} data:${options?.allowBlobImages ? ' blob:' : ''};
        font-src ${webview.cspSource};
        connect-src 'none';
    `.replace(/\s+/g, ' ').trim();
}

/**
 * Generates a meta tag with Content Security Policy for webview HTML.
 */
export function getCspMetaTag(
    webview: vscode.Webview,
    nonce: string,
    options?: Parameters<typeof getContentSecurityPolicy>[2]
): string {
    const csp = getContentSecurityPolicy(webview, nonce, options);
    return `<meta http-equiv="Content-Security-Policy" content="${csp}">`;
}

const reportedViolations = new Set<string>();

/**
 * A webview's `securitypolicyviolation` event, forwarded by its page script. Shown once per
 * view and directive per session so a policy that blocks something on one platform is visible
 * instead of leaving a blank panel.
 */
export function reportCspViolation(view: string, directive: unknown, blocked: unknown): void {
    const key = `${view}|${directive}`;
    if (reportedViolations.has(key)) { return; }
    reportedViolations.add(key);
    vscode.window.showWarningMessage(
        `BigQuery Studio: the ${view} view blocked a resource (${String(directive)}: ${String(blocked) || 'inline'}). ` +
        `If something is missing from the view, please report this message.`);
}
