import { render } from 'preact';
import { GridApp } from './GridApp';

declare const acquireVsCodeApi: () => { postMessage(msg: any): void };

function showFatal(msg: string) {
    try {
        const host = document.body || document.documentElement;
        const el = document.createElement('div');
        el.style.cssText = 'padding:12px;color:#f66;font-family:monospace;white-space:pre-wrap;';
        el.textContent = 'grid-v2 fatal: ' + msg;
        if (host) { host.appendChild(el); }
    } catch { /* ignore */ }
}

window.addEventListener('error', (ev: ErrorEvent) => showFatal(String((ev as any).error?.stack || (ev as any).error?.message || ev.message)));
window.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => showFatal('unhandledrejection: ' + String((ev as any).reason?.stack || (ev as any).reason)));

try {
    (window as any).__bqVscode = (window as any).__bqVscode || acquireVsCodeApi();
    const mount = document.getElementById('q1');
    if (!mount) {
        showFatal('mount element #q1 not found');
    } else {
        render(<GridApp />, mount);
        (window as any).__bqVscode.postMessage({ command: 'load_complete' });
    }
} catch (e: any) {
    showFatal(String(e?.stack || e?.message || e));
}
