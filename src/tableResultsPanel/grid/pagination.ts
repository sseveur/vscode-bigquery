import type { JobReference, QueryResultsResponse } from './types';

const PAGE_SIZE = 50;

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
    const url = `https://bigquery.googleapis.com/bigquery/v2/projects/${encodeURIComponent(
        jobRef.projectId
    )}/queries/${encodeURIComponent(jobRef.jobId)}?${params.toString()}`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`getQueryResults ${res.status}: ${text}`);
    }
    return (await res.json()) as QueryResultsResponse;
}

export const DEFAULT_PAGE_SIZE = PAGE_SIZE;
