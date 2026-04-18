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
        if ((field.type || '').toUpperCase() === 'RECORD' || (field.type || '').toUpperCase() === 'STRUCT') {
            if ((field.mode || '').toUpperCase() === 'REPEATED') {
                if (isLast) { return cellRaw.v; }
                return undefined;
            }
            cursor = cellRaw.v;
            cursorFields = field.fields;
            continue;
        }
        return cellRaw.v;
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
        const items = value.map((cell: any) => {
            if (cell === null || cell === undefined) { return '<em>NULL</em>'; }
            const inner = cell && 'v' in cell ? cell.v : cell;
            if (type === 'RECORD' || type === 'STRUCT') {
                return escapeHtml(JSON.stringify(inner));
            }
            return escapeHtml(String(formatScalar(inner, type) ?? ''));
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

export function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
