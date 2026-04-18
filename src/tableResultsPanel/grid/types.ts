export enum MessageType {
    clear = 'clear',
    executeQuery = 'execute_query',
    previewTable = 'preview_table',
    error = 'error',
}

export interface GridError {
    message: string;
    reason: string | null;
}

export interface GridMessage {
    requestType: string;
    projectId: string | null;
    token: string | null;
    job: any | null;
    error: GridError | null;
}

export interface BqField {
    name: string;
    type?: string;
    mode?: string;
    fields?: BqField[];
}

export interface JobReference {
    projectId: string;
    jobId: string;
    location?: string;
}

export interface QueryResultsResponse {
    schema?: { fields: BqField[] };
    rows?: Array<{ f: Array<{ v: any }> }>;
    totalRows?: string;
    pageToken?: string;
    jobComplete?: boolean;
    totalBytesProcessed?: string;
}
