import { typeKind, TypeKind } from '../lineage/columnTypes';
import { NODE_COLORS, NODE_TAGS } from '../lineage/svgRenderer';

/**
 * Editor hovers for tables and CTEs, styled after the lineage cards: a coloured type tag, the
 * name, a muted subtitle, then the columns with a type icon and the type right-aligned.
 *
 * The markdown is rendered untrusted with HTML limited to VS Code's hover sanitizer (a `<span>`
 * may carry `color` / `background-color` only). Every name is escaped: column and table names
 * come from the catalog or the SQL, and must not turn into links or markup.
 */
export interface HoverCard {
    kind: 'SOURCE' | 'CTE';
    name: string;
    subtitle?: string;
    /** `description` is the BigQuery column description, shown muted after the name. */
    columns: Array<{ name: string; type?: string; description?: string }>;
    /** Shown instead of the column list, e.g. while the schema loads. */
    note?: string;
}

/** Hovers scroll, but a 300-column table should not produce a 300-row tooltip. */
export const MAX_HOVER_COLUMNS = 50;

/** Long column descriptions are cut so the type column stays in view. */
export const MAX_DESCRIPTION_CHARS = 80;

const ICONS: Record<TypeKind, string> = {
    number: 'symbol-numeric',
    text: 'symbol-string',
    date: 'calendar',
    bool: 'symbol-boolean',
    other: 'symbol-structure',
    unknown: 'symbol-field',
};

const MUTED = 'color:var(--vscode-descriptionForeground);';

export function renderHoverCard(card: HoverCard): string {
    const color = NODE_COLORS[card.kind];
    const icon = card.kind === 'SOURCE' ? 'database' : 'package';
    const tag = `<span style="color:${color};background-color:${color}26;">&nbsp;<strong>${NODE_TAGS[card.kind]}</strong>&nbsp;</span>`;
    const lines = [
        `$(${icon}) ${tag}&nbsp; **${escapeMarkdown(card.name)}**` +
        (card.subtitle ? `&nbsp; <span style="${MUTED}">${escapeMarkdown(card.subtitle)}</span>` : ''),
        '',
    ];

    if (card.note || card.columns.length === 0) {
        lines.push(`<span style="${MUTED}"><em>${escapeMarkdown(card.note ?? 'No columns detected')}</em></span>`);
        return lines.join('\n');
    }

    const n = card.columns.length;
    lines.push(`| | ${n} column${n === 1 ? '' : 's'} | |`, '|:-:|:--|--:|');
    for (const c of card.columns.slice(0, MAX_HOVER_COLUMNS)) {
        const description = c.description?.trim()
            ? `&nbsp; <span style="${MUTED}">${escapeMarkdown(truncate(c.description.trim(), MAX_DESCRIPTION_CHARS))}</span>`
            : '';
        lines.push(`| $(${ICONS[typeKind(c.type)]}) | ${escapeMarkdown(c.name)}${description} | ${c.type ? `<span style="${MUTED}">${escapeMarkdown(c.type)}</span>` : ''} |`);
    }
    if (n > MAX_HOVER_COLUMNS) {
        lines.push(`| | <span style="${MUTED}"><em>+ ${n - MAX_HOVER_COLUMNS} more</em></span> | |`);
    }
    return lines.join('\n');
}

function truncate(text: string, max: number): string {
    return text.length > max ? `${text.slice(0, max - 1)}\u2026` : text;
}

/** Text that renders literally in markdown with HTML enabled: no links, emphasis, tables breaks or tags. */
export function escapeMarkdown(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/([\\`*_{}[\]()#+\-.!|~$])/g, '\\$1')
        .replace(/\r?\n/g, ' ');
}
