/** Broad family of a BigQuery column type, shared by the lineage cards and the editor hovers. */
export type TypeKind = 'number' | 'text' | 'date' | 'bool' | 'other' | 'unknown';

export function typeKind(type?: string): TypeKind {
    const t = (type ?? '').toLowerCase();
    if (!t) { return 'unknown'; }
    if (/^(bit|bool)/.test(t)) { return 'bool'; }
    // Before the number rule: BYTES contains "byte", INTERVAL contains "int"
    if (/^bytes/.test(t)) { return 'other'; }
    if (/^interval/.test(t)) { return 'date'; }
    if (/^(struct|record|array|geography|json|range)/.test(t)) { return 'other'; }
    if (/(int|decimal|numeric|float|real|money|double|long|short|byte)/.test(t)) { return 'number'; }
    if (/(date|time)/.test(t)) { return 'date'; }
    if (/(char|text|string|xml|uniqueidentifier|sysname)/.test(t)) { return 'text'; }
    return 'other';
}
