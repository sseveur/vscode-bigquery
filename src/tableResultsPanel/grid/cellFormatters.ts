import type { BqField } from './types';

export function formatScalar(raw: any, type: string | undefined): string | null {
    if (raw === null || raw === undefined) {
        return null;
    }
    const t = (type || '').toUpperCase();
    switch (t) {
        case 'TIMESTAMP': {
            const ms = Math.round(parseFloat(String(raw)) * 1000);
            if (!isFinite(ms)) { return String(raw); }
            return new Date(ms).toISOString();
        }
        case 'DATE':
        case 'DATETIME':
        case 'TIME':
        case 'STRING':
        case 'BYTES':
        case 'GEOGRAPHY':
            return String(raw);
        case 'INT64':
        case 'INTEGER':
        case 'NUMERIC':
        case 'BIGNUMERIC':
        case 'FLOAT':
        case 'FLOAT64':
            return String(raw);
        case 'BOOL':
        case 'BOOLEAN':
            return String(raw) === 'true' ? 'true' : 'false';
        case 'JSON':
            return typeof raw === 'string' ? raw : JSON.stringify(raw);
        default:
            return String(raw);
    }
}

export interface FlatColumn {
    key: string;
    label: string;
    type: string;
    mode: string;
    path: string[];
}

export function flattenSchema(fields: BqField[], parentPath: string[] = [], parentLabel = ''): FlatColumn[] {
    const out: FlatColumn[] = [];
    for (const f of fields) {
        const path = [...parentPath, f.name];
        const label = parentLabel ? `${parentLabel}.${f.name}` : f.name;
        const type = (f.type || 'STRING').toUpperCase();
        const mode = (f.mode || 'NULLABLE').toUpperCase();
        if (type === 'RECORD' || type === 'STRUCT') {
            if (mode === 'REPEATED') {
                out.push({ key: path.join('.'), label, type, mode, path });
            } else if (f.fields && f.fields.length > 0) {
                out.push(...flattenSchema(f.fields, path, label));
            } else {
                out.push({ key: path.join('.'), label, type, mode, path });
            }
        } else {
            out.push({ key: path.join('.'), label, type, mode, path });
        }
    }
    return out;
}

/**
 * Decodes a BigQuery raw cell value into plain JS using the field schema.
 * BQ wire format wraps STRUCTs as { f: [{ v: cell }, ...] } and REPEATED as [{ v: item }, ...].
 * This peels those wrappers so nested records render as real objects/arrays.
 */
export function decodeBqValue(raw: any, field: BqField): any {
    if (raw === null || raw === undefined) { return null; }
    const type = (field.type || '').toUpperCase();
    const mode = (field.mode || 'NULLABLE').toUpperCase();
    if (mode === 'REPEATED') {
        if (!Array.isArray(raw)) { return raw; }
        const itemField: BqField = { ...field, mode: 'NULLABLE' };
        return raw.map((cell: any) => {
            const inner = cell && typeof cell === 'object' && 'v' in cell ? cell.v : cell;
            return decodeBqValue(inner, itemField);
        });
    }
    if (type === 'RECORD' || type === 'STRUCT') {
        if (!raw || !Array.isArray(raw.f)) { return raw; }
        const subs = field.fields || [];
        const obj: Record<string, any> = {};
        for (let i = 0; i < subs.length; i++) {
            const cell = raw.f[i];
            const sub = subs[i];
            obj[sub.name] = cell ? decodeBqValue(cell.v, sub) : null;
        }
        return obj;
    }
    return raw;
}

export function extractRowValue(row: { f: Array<{ v: any }> }, fields: BqField[], path: string[]): any {
    let cursor: any = row;
    let cursorFields: BqField[] | undefined = fields;
    for (let i = 0; i < path.length; i++) {
        const name = path[i];
        if (!cursorFields) { return undefined; }
        const idx: number = cursorFields.findIndex((f: BqField) => f.name === name);
        if (idx < 0) { return undefined; }
        const field: BqField = cursorFields[idx];
        const cellRaw = cursor && cursor.f ? cursor.f[idx] : undefined;
        const isLast = i === path.length - 1;
        if (!cellRaw) { return undefined; }
        const type = (field.type || '').toUpperCase();
        const mode = (field.mode || '').toUpperCase();
        if (isLast) {
            return decodeBqValue(cellRaw.v, field);
        }
        if ((type === 'RECORD' || type === 'STRUCT') && mode !== 'REPEATED') {
            cursor = cellRaw.v;
            cursorFields = field.fields;
            continue;
        }
        return undefined;
    }
    return undefined;
}

export function renderCellValue(value: any, col: FlatColumn): { html: string; isNull: boolean } {
    if (value === null || value === undefined) {
        return { html: 'NULL', isNull: true };
    }
    const type = col.type.toUpperCase();
    const mode = col.mode.toUpperCase();
    if (mode === 'REPEATED') {
        if (!Array.isArray(value)) {
            return { html: escapeHtml(JSON.stringify(value)), isNull: false };
        }
        const items = value.map((item: any) => {
            if (item === null || item === undefined) { return '<em>NULL</em>'; }
            if (type === 'RECORD' || type === 'STRUCT' || typeof item === 'object') {
                return escapeHtml(JSON.stringify(item));
            }
            return escapeHtml(String(formatScalar(item, type) ?? ''));
        });
        return { html: `[ ${items.join(', ')} ]`, isNull: false };
    }
    if (type === 'RECORD' || type === 'STRUCT') {
        return { html: escapeHtml(JSON.stringify(value)), isNull: false };
    }
    const formatted = formatScalar(value, type);
    if (formatted === null) { return { html: 'NULL', isNull: true }; }
    return { html: escapeHtml(formatted), isNull: false };
}

/**
 * Cell text as HTML with every case-insensitive occurrence of `needle` wrapped in <mark>.
 * Matches run on the raw text and each piece is escaped afterwards, so a search for "amp"
 * or "lt" never lands inside an entity like &amp; / &lt;.
 */
export function highlightMatch(text: string, needle: string): string {
    if (!needle) { return escapeHtml(text); }
    const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    let html = '';
    let last = 0;
    for (const m of text.matchAll(re)) {
        html += escapeHtml(text.slice(last, m.index)) + `<mark class="bq-mark">${escapeHtml(m[0])}</mark>`;
        last = m.index! + m[0].length;
    }
    return html + escapeHtml(text.slice(last));
}

/** vscode-bigquery.gridColors keys that name one column type ("INT64") become `--bq-type-int64`. */
export const TYPE_COLOR_VAR_PREFIX = '--bq-type-';

/**
 * CSS for exact-type color keys: `td.bq-t-int64 { color: var(--bq-type-int64) }` per such var.
 * Emitted after the grid stylesheet, so an exact type beats its group (same specificity).
 * `vars` is already sanitized, so names are plain alphanumerics.
 */
export function typeColorRules(vars: Record<string, string>): string {
    return Object.keys(vars)
        .filter(k => k.startsWith(TYPE_COLOR_VAR_PREFIX))
        .map(k => `.bq-grid td.bq-t-${k.slice(TYPE_COLOR_VAR_PREFIX.length)} { color: var(${k}); }`)
        .join('\n');
}

const NUMERIC = /^\s*[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?\s*$/i;

/**
 * Grid sort order: nulls last; numbers numerically only when the WHOLE value is a number
 * (parseFloat read "2026-01-26" as 2026, so every DATE / DATETIME compared equal); else text.
 */
export function compareCells(a: unknown, b: unknown): number {
    if (a === null || a === undefined) { return b === null || b === undefined ? 0 : 1; }
    if (b === null || b === undefined) { return -1; }
    if (typeof a === 'number' && typeof b === 'number') { return a - b; }
    const as = String(a), bs = String(b);
    if (NUMERIC.test(as) && NUMERIC.test(bs)) { return Number(as) - Number(bs); }
    return as.localeCompare(bs);
}

export function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
