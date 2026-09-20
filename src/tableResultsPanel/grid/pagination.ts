import type {
    JobListEntry,
    JobMetadata,
    JobListResponse,
    JobReference,
    QueryResultsResponse,
    TableMetadata,
    TableReference,
} from './types';

export interface ChildJobSummary {
    jobRef: JobReference;
    statementType?: string;
    dmlStats?: { insertedRowCount?: string; updatedRowCount?: string; deletedRowCount?: string };
}

const PAGE_SIZE = 50;
const BQ_BASE = 'https://bigquery.googleapis.com/bigquery/v2';
/** Per-request server-side wait; the job keeps running when it expires and we ask again. */
const RESULTS_WAIT_MS = 10000;
/** Give up polling a job that never reports completion, rather than spinning forever. */
const MAX_TOTAL_WAIT_MS = 5 * 60 * 1000;
/** Floor between polls, so a server that answers immediately cannot spin this loop. */
const POLL_GAP_MS = 250;
/** jobs.list is eventually consistent; give the child jobs of a script time to show up. */
const CHILD_LIST_WAIT_MS = 20000;
/** How often to re-read a running job's metadata while waiting for it to finish. */
const JOB_POLL_MS = 400;

async function bqGet<T>(url: string, token: string): Promise<T> {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`${res.status}: ${text}`);
    }
    return (await res.json()) as T;
}

/**
 * Fetches one page of a job's results, waiting for the job to finish first. `jobs.query` style
 * results come back with `jobComplete: false` while the job is still running — the extension posts
 * the job right after creating it, so that is the normal case for anything but a trivial query.
 */
export async function fetchPage(
    jobRef: JobReference,
    token: string,
    startIndex: number,
    pageSize: number = PAGE_SIZE
): Promise<QueryResultsResponse> {
    const params = new URLSearchParams({
        maxResults: String(pageSize),
        startIndex: String(startIndex),
        timeoutMs: String(RESULTS_WAIT_MS),
    });
    if (jobRef.location) {
        params.set('location', jobRef.location);
    }
    const url = `${BQ_BASE}/projects/${encodeURIComponent(jobRef.projectId)}/queries/${encodeURIComponent(jobRef.jobId)}?${params.toString()}`;

    const deadline = Date.now() + MAX_TOTAL_WAIT_MS;
    for (;;) {
        const res = await bqGet<QueryResultsResponse>(url, token);
        if (res.jobComplete !== false) {
            return res;
        }
        if (Date.now() >= deadline) {
            throw new Error('Timed out waiting for the query job to complete.');
        }
        // `timeoutMs` makes the server hold the request, but guard against it returning at once.
        await new Promise(resolve => setTimeout(resolve, POLL_GAP_MS));
    }
}

export async function fetchTableMetadata(
    tableRef: TableReference,
    token: string
): Promise<TableMetadata> {
    const url = `${BQ_BASE}/projects/${encodeURIComponent(tableRef.projectId)}/datasets/${encodeURIComponent(tableRef.datasetId)}/tables/${encodeURIComponent(tableRef.tableId)}`;
    return bqGet<TableMetadata>(url, token);
}

export async function fetchTablePage(
    tableRef: TableReference,
    token: string,
    startIndex: number,
    pageSize: number = PAGE_SIZE
): Promise<QueryResultsResponse> {
    const params = new URLSearchParams({
        maxResults: String(pageSize),
        startIndex: String(startIndex),
    });
    const url = `${BQ_BASE}/projects/${encodeURIComponent(tableRef.projectId)}/datasets/${encodeURIComponent(tableRef.datasetId)}/tables/${encodeURIComponent(tableRef.tableId)}/data?${params.toString()}`;
    return bqGet<QueryResultsResponse>(url, token);
}

/**
 * Reads a job's own metadata. Used for a script's `statistics.numChildJobs`, which tells us how
 * many child jobs `jobs.list` should eventually return.
 */
export async function fetchJobMetadata(jobRef: JobReference, token: string): Promise<JobMetadata> {
    const params = new URLSearchParams({ projection: 'full' });
    if (jobRef.location) {
        params.set('location', jobRef.location);
    }
    const url = `${BQ_BASE}/projects/${encodeURIComponent(jobRef.projectId)}/jobs/${encodeURIComponent(jobRef.jobId)}?${params.toString()}`;
    return bqGet<JobMetadata>(url, token);
}

interface ChildJobListing {
    /** Every child the listing returned, before the statement-type filter. */
    total: number;
    children: ChildJobSummary[];
}

/**
 * Polls a job's metadata until it reports DONE. Cheaper to wait on than `getQueryResults`, which
 * holds the request open for its full `timeoutMs`, and the metadata we get back tells us straight
 * away whether the job is a script and how many child jobs it has.
 */
export async function waitForJobDone(jobRef: JobReference, token: string): Promise<JobMetadata> {
    const deadline = Date.now() + MAX_TOTAL_WAIT_MS;
    for (;;) {
        const meta = await fetchJobMetadata(jobRef, token);
        if (meta.status?.state === 'DONE') {
            return meta;
        }
        if (Date.now() >= deadline) {
            throw new Error('Timed out waiting for the query job to complete.');
        }
        await new Promise(resolve => setTimeout(resolve, JOB_POLL_MS));
    }
}

async function listChildJobsOnce(
    parent: JobReference,
    token: string
): Promise<ChildJobListing> {
    const params = new URLSearchParams({
        parentJobId: parent.jobId,
        projection: 'full',
        maxResults: '100',
    });
    if (parent.location) {
        params.set('location', parent.location);
    }
    const url = `${BQ_BASE}/projects/${encodeURIComponent(parent.projectId)}/jobs?${params.toString()}`;
    const res = await bqGet<JobListResponse>(url, token);
    const all = res.jobs || [];
    const jobs = all.filter((j: JobListEntry) => {
        if (!j.jobReference?.jobId) { return false; }
        if (j.status?.errorResult) { return false; }
        const t = j.statistics?.query?.statementType;
        if (!t) { return false; }
        return t === 'SELECT' || t === 'WITH' || t.startsWith('CREATE_') || t.startsWith('MERGE') || t === 'UPDATE' || t === 'INSERT' || t === 'DELETE';
    });
    // jobs.list returns the most recent job first; statements read better in execution order.
    jobs.sort((a, b) => Number(a.statistics?.creationTime || 0) - Number(b.statistics?.creationTime || 0));
    return {
        total: all.length,
        children: jobs.map((j: JobListEntry): ChildJobSummary => ({
            jobRef: {
                projectId: j.jobReference.projectId,
                jobId: j.jobReference.jobId,
                location: j.jobReference.location,
            },
            statementType: j.statistics?.query?.statementType,
            dmlStats: j.statistics?.query?.dmlStats,
        })),
    };
}

/**
 * Lists a script's child jobs. `jobs.list` only becomes consistent a moment after the script
 * finishes, so when the parent reports how many children it has (`numChildJobs`) we keep asking
 * until that many show up — otherwise a script's later statements silently go missing.
 */
export async function fetchChildJobs(
    parent: JobReference,
    token: string,
    expectedCount?: number
): Promise<ChildJobSummary[]> {
    let listing = await listChildJobsOnce(parent, token);
    if (!expectedCount || expectedCount <= listing.total) {
        return listing.children;
    }

    const deadline = Date.now() + CHILD_LIST_WAIT_MS;
    while (listing.total < expectedCount && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, POLL_GAP_MS * 2));
        const next = await listChildJobsOnce(parent, token);
        if (next.total > listing.total) {
            listing = next;
        }
    }
    return listing.children;
}

export const DEFAULT_PAGE_SIZE = PAGE_SIZE;
