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
    datasetId?: string | null;
    tableId?: string | null;
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

export interface TableReference {
    projectId: string;
    datasetId: string;
    tableId: string;
}

export interface ExportRef {
    jobReference?: JobReference;
    tableReference?: TableReference;
}

export interface QueryResultsResponse {
    schema?: { fields: BqField[] };
    rows?: Array<{ f: Array<{ v: any }> }>;
    totalRows?: string;
    pageToken?: string;
    jobComplete?: boolean;
    totalBytesProcessed?: string;
}

export interface TableMetadata {
    schema?: { fields: BqField[] };
    numRows?: string;
    tableReference?: TableReference;
    type?: string;
}

export interface DmlStats {
    insertedRowCount?: string;
    updatedRowCount?: string;
    deletedRowCount?: string;
}

export interface JobStatistics {
    query?: {
        statementType?: string;
        dmlStats?: DmlStats;
    };
}

export interface JobListEntry {
    jobReference: JobReference;
    statistics?: JobStatistics;
    status?: { state?: string; errorResult?: { message?: string } };
    configuration?: { query?: { query?: string } };
}

export interface JobListResponse {
    jobs?: JobListEntry[];
}
