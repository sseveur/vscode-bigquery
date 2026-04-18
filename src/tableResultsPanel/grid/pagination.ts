import type {
    JobListEntry,
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

async function bqGet<T>(url: string, token: string): Promise<T> {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`${res.status}: ${text}`);
    }
    return (await res.json()) as T;
}

export async function fetchPage(
    jobRef: JobReference,
    token: string,
    startIndex: number,
    pageSize: number = PAGE_SIZE
): Promise<QueryResultsResponse> {
    const params = new URLSearchParams({
        maxResults: String(pageSize),
        startIndex: String(startIndex),
    });
    if (jobRef.location) {
        params.set('location', jobRef.location);
    }
    const url = `${BQ_BASE}/projects/${encodeURIComponent(jobRef.projectId)}/queries/${encodeURIComponent(jobRef.jobId)}?${params.toString()}`;
    return bqGet<QueryResultsResponse>(url, token);
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

export async function fetchChildJobs(
    parent: JobReference,
    token: string
): Promise<ChildJobSummary[]> {
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
    const jobs = (res.jobs || []).filter((j: JobListEntry) => {
        const t = j.statistics?.query?.statementType;
        if (!t) { return false; }
        return t === 'SELECT' || t === 'WITH' || t.startsWith('CREATE_') || t.startsWith('MERGE') || t === 'UPDATE' || t === 'INSERT' || t === 'DELETE';
    });
    return jobs.map((j: JobListEntry): ChildJobSummary => ({
        jobRef: {
            projectId: j.jobReference.projectId,
            jobId: j.jobReference.jobId,
            location: j.jobReference.location,
        },
        statementType: j.statistics?.query?.statementType,
        dmlStats: j.statistics?.query?.dmlStats,
    }));
}

export const DEFAULT_PAGE_SIZE = PAGE_SIZE;
