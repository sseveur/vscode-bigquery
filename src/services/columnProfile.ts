import { Job } from '@google-cloud/bigquery';
import { BigQueryClient, selectFinalResultChildJob } from './bigqueryClient';
import { JobReference } from './queryResultsMapping';

export interface TableReference {
    projectId: string;
    datasetId: string;
    tableId: string;
}

export interface TopValue {
    value: unknown;
    count: number;
}

export interface ColumnProfile {
    columnName: string;
    columnType: string;
    /** Total rows in the source result set. */
    totalCount: number;
    /** Number of rows where the column is NULL. */
    nullCount: number;
    /** Distinct non-null values. `null` if the type isn't hashable (ARRAY/STRUCT). */
    distinctCount: number | null;
    /** Distinct non-null values that occur more than once. `null` for opaque types. */
    duplicateValueCount: number | null;
    /** Total non-null rows belonging to a duplicated value (SUM of counts where count > 1). `null` for opaque types. */
    duplicateRowCount: number | null;
    /** Whether every non-null value is unique (distinctCount === totalCount - nullCount). `null` for opaque types. */
    isUnique: boolean | null;
    /** Min value as returned by BigQuery (may be a Date/Big object — caller stringifies). */
    minValue: unknown;
    /** Max value as returned by BigQuery. */
    maxValue: unknown;
    /** 11 boundaries from `APPROX_QUANTILES(col, 10)` for numeric/date columns, else `null`. */
    quantiles: unknown[] | null;
    /** Top values by frequency (descending) for hashable columns, else `null`. */
    topValues: TopValue[] | null;
    /** SQL that produced the profile — surfaced in the UI for debugging. */
    sourceSql: string;
}

type ProfileTier = 'numeric' | 'orderable' | 'opaque';

const NUMERIC_TYPES = new Set(['INT64', 'INTEGER', 'FLOAT64', 'FLOAT', 'NUMERIC', 'BIGNUMERIC', 'DECIMAL']);
const ORDERABLE_TYPES = new Set([
    'STRING', 'BYTES', 'BOOL', 'BOOLEAN',
    'DATE', 'TIME', 'DATETIME', 'TIMESTAMP'
]);

function classifyType(columnType: string): ProfileTier {
    const t = columnType.toUpperCase();
    if (NUMERIC_TYPES.has(t)) { return 'numeric'; }
    if (ORDERABLE_TYPES.has(t)) { return 'orderable'; }
    return 'opaque';
}

function quoteIdent(name: string): string {
    return '`' + name.replace(/`/g, '``') + '`';
}

function fqtn(dt: TableReference): string {
    return `\`${dt.projectId}\`.\`${dt.datasetId}\`.\`${dt.tableId}\``;
}

/**
 * Builds a single SQL statement that returns one row with all profile fields.
 * The shape is tier-specific so we don't have to bend types into placeholders:
 *   - numeric: total/null/distinct/min/max/quantiles/topK
 *   - orderable (string/date/etc.): total/null/distinct/min/max/topK (no quantiles)
 *   - opaque (array/struct/json/geography): total/null only
 */
export function buildProfileSql(dt: TableReference, columnName: string, columnType: string): string {
    const tier = classifyType(columnType);
    const col = quoteIdent(columnName);
    const source = fqtn(dt);
    const TOP_K = 20;

    if (tier === 'opaque') {
        return `SELECT
  COUNT(*) AS total_count,
  COUNTIF(${col} IS NULL) AS null_count
FROM ${source}`;
    }

    if (tier === 'numeric') {
        return `WITH src AS (SELECT ${col} AS v FROM ${source}),
counts AS (SELECT v, COUNT(*) AS c FROM src WHERE v IS NOT NULL GROUP BY v),
topk AS (
  SELECT ARRAY_AGG(STRUCT(v AS value, c AS count) ORDER BY c DESC, v LIMIT ${TOP_K}) AS top_values FROM counts
)
SELECT
  (SELECT COUNT(*) FROM src) AS total_count,
  (SELECT COUNTIF(v IS NULL) FROM src) AS null_count,
  (SELECT COUNT(DISTINCT v) FROM src) AS distinct_count,
  (SELECT COUNT(*) FROM counts WHERE c > 1) AS duplicate_value_count,
  (SELECT IFNULL(SUM(c), 0) FROM counts WHERE c > 1) AS duplicate_row_count,
  (SELECT MIN(v) FROM src) AS min_value,
  (SELECT MAX(v) FROM src) AS max_value,
  (SELECT APPROX_QUANTILES(v, 20) FROM src) AS quantiles,
  (SELECT top_values FROM topk) AS top_values`;
    }

    // orderable (string / bytes / bool / date-ish)
    return `WITH src AS (SELECT ${col} AS v FROM ${source}),
counts AS (SELECT v, COUNT(*) AS c FROM src WHERE v IS NOT NULL GROUP BY v),
topk AS (
  SELECT ARRAY_AGG(STRUCT(v AS value, c AS count) ORDER BY c DESC, v LIMIT ${TOP_K}) AS top_values FROM counts
)
SELECT
  (SELECT COUNT(*) FROM src) AS total_count,
  (SELECT COUNTIF(v IS NULL) FROM src) AS null_count,
  (SELECT COUNT(DISTINCT v) FROM src) AS distinct_count,
  (SELECT COUNT(*) FROM counts WHERE c > 1) AS duplicate_value_count,
  (SELECT IFNULL(SUM(c), 0) FROM counts WHERE c > 1) AS duplicate_row_count,
  (SELECT MIN(v) FROM src) AS min_value,
  (SELECT MAX(v) FROM src) AS max_value,
  (SELECT top_values FROM topk) AS top_values`;
}

/**
 * Profiles a column against a concrete source table. Used by the right-click flow
 * where we've already resolved the column to its (project, dataset, table).
 */
export async function runColumnProfileForTable(
    bqClient: BigQueryClient,
    tableRef: TableReference,
    columnName: string,
    columnType: string
): Promise<ColumnProfile> {
    const sql = buildProfileSql(tableRef, columnName, columnType);
    const profileJob = await bqClient.runQuery(sql);
    const [rows] = await profileJob.getQueryResults({ maxResults: 1 });
    return mapProfileRow(rows && rows[0], columnName, columnType, sql);
}

/**
 * Runs the profile against the destination temp table of a previously-executed job
 * (cheaper and faster than re-running the source query — the result rows are already
 * materialized and live for ~24h).
 */
export async function runColumnProfile(
    bqClient: BigQueryClient,
    jobRef: JobReference,
    columnName: string,
    columnType: string
): Promise<ColumnProfile> {

    const destination = await resolveDestinationTable(bqClient, jobRef);
    if (!destination) {
        throw new Error(
            'Cannot profile this column: no accessible destination table was found ' +
            '(the job may have expired after 24h, or it was a DDL with no result rows). ' +
            'Re-run the query and try again.'
        );
    }

    const sql = buildProfileSql(destination, columnName, columnType);
    const profileJob = await bqClient.runQuery(sql);
    const [rows] = await profileJob.getQueryResults({ maxResults: 1 });
    return mapProfileRow(rows && rows[0], columnName, columnType, sql);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProfileRow(rowIn: any, columnName: string, columnType: string, sql: string): ColumnProfile {
    const row = rowIn || {};
    const topValuesRaw = row.top_values as Array<{ value: unknown; count: unknown }> | null | undefined;
    const topValues: TopValue[] | null = Array.isArray(topValuesRaw)
        ? topValuesRaw.map(tv => ({ value: tv.value, count: Number(tv.count ?? 0) }))
        : null;

    const totalCount = Number(row.total_count ?? 0);
    const nullCount = Number(row.null_count ?? 0);
    const distinctCount = row.distinct_count == null ? null : Number(row.distinct_count);

    return {
        columnName,
        columnType,
        totalCount,
        nullCount,
        distinctCount,
        duplicateValueCount: row.duplicate_value_count == null ? null : Number(row.duplicate_value_count),
        duplicateRowCount: row.duplicate_row_count == null ? null : Number(row.duplicate_row_count),
        isUnique: distinctCount == null ? null : distinctCount === (totalCount - nullCount),
        minValue: row.min_value ?? null,
        maxValue: row.max_value ?? null,
        quantiles: Array.isArray(row.quantiles) ? row.quantiles : null,
        topValues,
        sourceSql: sql
    };
}

/**
 * Resolves the destination table to profile.
 *   - Single-statement job: take the job's own destinationTable.
 *   - SCRIPT parent (multi-statement): walk child jobs in reverse order and pick
 *     the last one that produced a real result set (has a destinationTable and
 *     a non-empty schema). That matches the "final SELECT" the user actually saw.
 */
export async function resolveDestinationTable(
    bqClient: BigQueryClient,
    jobRef: JobReference
): Promise<TableReference | null> {

    const job = bqClient.getJob(jobRef);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [meta]: any = await job.getMetadata();

    const direct = meta?.configuration?.query?.destinationTable;
    if (direct?.projectId && direct?.datasetId && direct?.tableId) {
        return { projectId: direct.projectId, datasetId: direct.datasetId, tableId: direct.tableId };
    }

    const statementType = meta?.statistics?.query?.statementType;
    if (statementType !== 'SCRIPT') { return null; }

    let children: Job[] = [];
    try {
        children = await bqClient.getChildJobs(jobRef);
    } catch {
        return null;
    }

    const finalChild = selectFinalResultChildJob(children);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dt = (finalChild as any)?.metadata?.configuration?.query?.destinationTable;
    if (dt?.projectId && dt?.datasetId && dt?.tableId) {
        return { projectId: dt.projectId, datasetId: dt.datasetId, tableId: dt.tableId };
    }

    return null;
}
