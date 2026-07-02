import { JobReference } from './queryResultsMapping';

/** Normalized view of one server-side job for the Job History tree. */
export interface JobHistoryEntry {
    jobReference: JobReference;
    /** load / query / extract / copy — from configuration.jobType. */
    jobType: string;
    /** SELECT / INSERT / CREATE_TABLE_AS_SELECT / … (query jobs only). */
    statementType?: string;
    state: 'DONE' | 'RUNNING' | 'PENDING' | string;
    /** Present when the job finished with an error. */
    errorMessage?: string;
    user?: string;
    query?: string;
    creationTime?: number;   // epoch ms
    durationMs?: number;
    bytesProcessed?: number;
    cacheHit?: boolean;
    /** True when opening a results grid for this job can show rows. */
    hasResults: boolean;
}

/**
 * Maps a jobs.list (projection=full) job metadata object into a JobHistoryEntry.
 * Pure — unit tested against live-observed shapes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function describeJob(metadata: any): JobHistoryEntry {
    const ref = metadata?.jobReference ?? {};
    const stats = metadata?.statistics ?? {};
    const config = metadata?.configuration ?? {};
    const queryStats = stats.query ?? {};
    const state = metadata?.status?.state ?? 'UNKNOWN';
    const errorMessage: string | undefined = metadata?.status?.errorResult?.message;

    const start = parseInt(stats.startTime ?? stats.creationTime ?? '0', 10);
    const end = parseInt(stats.endTime ?? '0', 10);

    const jobType: string = config.jobType?.toLowerCase() ?? 'unknown';
    const statementType: string | undefined = queryStats.statementType;

    // Results are viewable for finished, error-free query jobs that are not pure DDL/DCL.
    const ddlLike = !!queryStats.ddlOperationPerformed
        || (statementType ?? '').startsWith('CREATE_') && !(statementType ?? '').endsWith('AS_SELECT')
        || (statementType ?? '').startsWith('DROP_')
        || (statementType ?? '').startsWith('ALTER_');
    const hasResults = jobType === 'query' && state === 'DONE' && !errorMessage && !ddlLike;

    return {
        jobReference: {
            projectId: ref.projectId ?? '',
            jobId: ref.jobId ?? '',
            location: ref.location,
        },
        jobType,
        statementType,
        state,
        errorMessage,
        user: metadata?.user_email,
        query: config.query?.query,
        creationTime: parseInt(stats.creationTime ?? '0', 10) || undefined,
        durationMs: start && end ? end - start : undefined,
        bytesProcessed: parseInt(stats.totalBytesProcessed ?? queryStats.totalBytesProcessed ?? '0', 10) || undefined,
        cacheHit: queryStats.cacheHit,
        hasResults,
    };
}

/** One-line label for the tree: query preview, or job type + statement. */
export function jobEntryLabel(e: JobHistoryEntry, maxLen = 60): string {
    if (e.query) {
        const flat = e.query.replace(/\s+/g, ' ').trim();
        return flat.length > maxLen ? flat.slice(0, maxLen - 1) + '…' : flat;
    }
    return [e.jobType, e.statementType].filter(Boolean).join(' · ') || e.jobReference.jobId;
}

/** Short description: state/type + user + size + duration + age. */
export function jobEntryDescription(e: JobHistoryEntry, now = Date.now()): string {
    const parts: string[] = [];
    if (e.statementType) { parts.push(e.statementType); }
    else if (e.jobType && e.jobType !== 'query') { parts.push(e.jobType.toUpperCase()); }
    if (e.user) { parts.push(e.user.split('@')[0]); }
    if (e.cacheHit) { parts.push('cached'); }
    else if (e.bytesProcessed) { parts.push(formatJobBytes(e.bytesProcessed)); }
    if (e.durationMs !== undefined) { parts.push(`${(e.durationMs / 1000).toFixed(1)}s`); }
    if (e.creationTime) { parts.push(relativeAge(e.creationTime, now)); }
    return parts.join(' · ');
}

export function formatJobBytes(bytes: number): string {
    if (!bytes || bytes <= 0) { return '0 B'; }
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const value = bytes / Math.pow(1024, i);
    return `${i === 0 ? value : value.toFixed(1)} ${units[i]}`;
}

/** Structured execution details for the Job Details panel (from jobs.get metadata). */
export interface JobDetails {
    entry: JobHistoryEntry;
    priority?: string;
    reservation?: string;
    totalSlotMs?: number;
    billingTier?: number;
    referencedTables: string[];
    destinationTable?: string;
    errors: Array<{ message: string; reason?: string; location?: string }>;
    stages: Array<{
        name: string;
        status?: string;
        recordsRead?: number;
        recordsWritten?: number;
        waitMsAvg?: number;
        readMsAvg?: number;
        computeMsAvg?: number;
        writeMsAvg?: number;
        parallelInputs?: number;
    }>;
    /** Timeline samples: elapsed ms → cumulative slot ms. */
    timeline: Array<{ elapsedMs: number; totalSlotMs: number; activeUnits?: number }>;
}

/** Extracts execution details from full job metadata (jobs.get). Pure. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildJobDetails(metadata: any): JobDetails {
    const entry = describeJob(metadata);
    const stats = metadata?.statistics ?? {};
    const q = stats.query ?? {};

    const tableRef = (t: any): string => // eslint-disable-line @typescript-eslint/no-explicit-any
        t ? [t.projectId, t.datasetId, t.tableId].filter(Boolean).join('.') : '';

    const errors = (metadata?.status?.errors ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((e: any) => ({ message: e?.message ?? '', reason: e?.reason, location: e?.location }))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((e: any) => e.message);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stages = (q.queryPlan ?? []).map((s: any) => ({
        name: s?.name ?? '',
        status: s?.status,
        recordsRead: num(s?.recordsRead),
        recordsWritten: num(s?.recordsWritten),
        waitMsAvg: num(s?.waitMsAvg),
        readMsAvg: num(s?.readMsAvg),
        computeMsAvg: num(s?.computeMsAvg),
        writeMsAvg: num(s?.writeMsAvg),
        parallelInputs: num(s?.parallelInputs),
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const timeline = (q.timeline ?? []).map((t: any) => ({
        elapsedMs: num(t?.elapsedMs) ?? 0,
        totalSlotMs: num(t?.totalSlotMs) ?? 0,
        activeUnits: num(t?.activeUnits),
    }));

    return {
        entry,
        priority: metadata?.configuration?.query?.priority,
        reservation: stats.reservation_id ?? stats.reservationId,
        totalSlotMs: num(stats.totalSlotMs ?? q.totalSlotMs),
        billingTier: num(q.billingTier),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        referencedTables: (q.referencedTables ?? []).map((t: any) => tableRef(t)).filter(Boolean),
        destinationTable: tableRef(metadata?.configuration?.query?.destinationTable) || undefined,
        errors,
        stages,
        timeline,
    };
}

function num(v: unknown): number | undefined {
    if (v === null || v === undefined) { return undefined; }
    const n = Number(v);
    return isFinite(n) ? n : undefined;
}

export function relativeAge(thenMs: number, now = Date.now()): string {
    const s = Math.max(0, Math.round((now - thenMs) / 1000));
    if (s < 60) { return `${s}s ago`; }
    const m = Math.round(s / 60);
    if (m < 60) { return `${m}m ago`; }
    const h = Math.round(m / 60);
    if (h < 24) { return `${h}h ago`; }
    return `${Math.round(h / 24)}d ago`;
}
