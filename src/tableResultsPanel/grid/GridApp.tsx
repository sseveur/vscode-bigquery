import { useCallback, useEffect, useState } from 'preact/hooks';
import { BqTable, type PageFetcher } from './BqTable';
import {
    DEFAULT_PAGE_SIZE,
    fetchChildJobs,
    fetchPage,
    fetchTableMetadata,
    fetchTablePage,
    waitForJobDone,
} from './pagination';
import type { ChildJobSummary } from './pagination';
import type {
    BqField,
    DmlStats,
    ExportRef,
    GridMessage,
    JobReference,
    TableReference,
} from './types';

interface TableView {
    key: string;
    exportRef: ExportRef;
    schema: BqField[];
    totalRows: number;
    initialRows: any[];
    token: string;
    source: { kind: 'job'; jobRef: JobReference } | { kind: 'table'; tableRef: TableReference };
    title?: string;
    dmlStats?: DmlStats;
    statementType?: string;
}

type View =
    | { kind: 'idle' }
    | { kind: 'loading'; message?: string }
    | { kind: 'tables'; tables: TableView[] }
    | { kind: 'error'; message: string; reason: string | null };

export function GridApp() {
    const [view, setView] = useState<View>({ kind: 'idle' });

    useEffect(() => {
        function onMessage(ev: MessageEvent) {
            const msg = ev.data as GridMessage;
            if (!msg || !msg.requestType) { return; }
            switch (msg.requestType) {
                case 'clear':
                    setView({ kind: 'idle' });
                    break;
                case 'error':
                    setView({
                        kind: 'error',
                        message: String(msg.error?.message ?? 'Unknown error'),
                        reason: (msg.error?.reason ?? null) as string | null,
                    });
                    break;
                case 'execute_query':
                    setView({ kind: 'loading', message: 'Loading results…' });
                    handleExecuteQuery(msg).then(setView).catch(e => setView({ kind: 'error', message: String(e?.message || e), reason: null }));
                    break;
                case 'preview_table':
                    setView({ kind: 'loading', message: 'Loading table…' });
                    handlePreviewTable(msg).then(setView).catch(e => setView({ kind: 'error', message: String(e?.message || e), reason: null }));
                    break;
                default:
                    break;
            }
        }
        window.addEventListener('message', onMessage);
        try {
            const api = (window as any).__bqVscode;
            if (api && typeof api.postMessage === 'function') {
                api.postMessage({ command: 'load_complete' });
            }
        } catch { /* ignore */ }
        return () => window.removeEventListener('message', onMessage);
    }, []);

    if (view.kind === 'idle') { return <div class="bq-empty">No results yet.</div>; }
    if (view.kind === 'loading') { return <div class="bq-notice">{view.message || 'Loading…'}</div>; }
    if (view.kind === 'error') {
        return (
            <div class="bq-error-panel">
                <div class="bq-error-title">Query Error</div>
                <div class="bq-error-msg">{view.message}</div>
                {view.reason && <div class="bq-error-reason">Reason: {view.reason}</div>}
            </div>
        );
    }

    if (view.tables.length === 1) {
        const t = view.tables[0];
        return <BqTableHost key={t.key} view={t} />;
    }
    return <ScriptTabs tables={view.tables} />;
}

/**
 * One tab per statement of a script. Every grid stays mounted so switching back keeps its page,
 * sort and selection; only the active one is visible.
 */
function ScriptTabs({ tables }: { tables: TableView[] }) {
    const [active, setActive] = useState(0);
    const current = Math.min(active, tables.length - 1);

    return (
        <div class="bq-script">
            <div class="bq-tabs" role="tablist">
                {tables.map((t, i) => (
                    <button
                        key={t.key}
                        class={`bq-tab ${i === current ? 'active' : ''}`}
                        role="tab"
                        aria-selected={i === current}
                        onClick={() => setActive(i)}
                        title={t.title}
                    >
                        <span class="bq-tab-label">{t.title || `Statement ${i + 1}`}</span>
                        <span class="bq-tab-rows">{t.totalRows.toLocaleString()}</span>
                    </button>
                ))}
            </div>
            {tables.map((t, i) => (
                <div class={`bq-script-item ${i === current ? '' : 'bq-script-item-hidden'}`} key={t.key}>
                    {/* The tab already names the statement, so the grid does not repeat it. */}
                    <BqTableHost view={t} showTitle={false} />
                </div>
            ))}
        </div>
    );
}

function BqTableHost({ view, showTitle = true }: { view: TableView; showTitle?: boolean }) {
    const { source, token } = view;
    const fetchRows: PageFetcher = useCallback((start, size) => {
        if (source.kind === 'job') {
            return fetchPage(source.jobRef, token, start, size);
        }
        return fetchTablePage(source.tableRef, token, start, size);
    }, [source, token]);

    return (
        <BqTable
            fetchRows={fetchRows}
            exportRef={view.exportRef}
            schema={view.schema}
            totalRows={view.totalRows}
            initialRows={view.initialRows}
            title={showTitle ? view.title : undefined}
            dmlStats={view.dmlStats}
            statementType={view.statementType}
        />
    );
}

function jobRefFromJob(job: any, fallbackProjectId: string): JobReference {
    const ref = job.jobReference || job.metadata?.jobReference || {};
    return {
        projectId: String(ref.projectId || fallbackProjectId),
        jobId: String(ref.jobId || job.id),
        location: ref.location,
    };
}

async function handleExecuteQuery(msg: GridMessage): Promise<View> {
    const job = msg.job as any;
    const token = msg.token;
    const projectId = msg.projectId;
    if (!job || !token || !projectId) {
        return { kind: 'error', message: 'Missing job, token, or projectId in message payload.', reason: null };
    }
    const jobRef = jobRefFromJob(job, projectId);
    if (!jobRef.jobId) {
        return { kind: 'error', message: 'Missing jobId.', reason: null };
    }

    // The extension posts the job right after creating it, so the payload's `statistics` is
    // whatever BigQuery knew at creation time — a multi-statement script has no `scriptStatistics`
    // and no `numChildJobs` yet. Waiting on the job's metadata is both how we find out it finished
    // and how we learn it is a script, without holding a `getQueryResults` request open.
    const meta = await waitForJobDone(jobRef, String(token)).catch(() => undefined);
    const childCount = Number(meta?.statistics?.numChildJobs || 0);
    const isScript = childCount > 0
        || meta?.statistics?.scriptStatistics != null
        || (job.statistics?.scriptStatistics || job.metadata?.statistics?.scriptStatistics) != null;

    if (isScript) {
        const scriptView = await buildScriptView(jobRef, String(token), childCount);
        if (scriptView) {
            return scriptView;
        }
    }

    // Not a script (or the script exposed nothing): the job's own result set.
    const res = await fetchPage(jobRef, String(token), 0, DEFAULT_PAGE_SIZE);
    const jobStats = meta?.statistics?.query || job.statistics?.query || job.metadata?.statistics?.query || {};
    return {
        kind: 'tables',
        tables: [{
            key: `job-${jobRef.jobId}`,
            exportRef: { jobReference: jobRef },
            schema: (res.schema?.fields || []) as BqField[],
            totalRows: parseInt(String(res.totalRows || '0'), 10),
            initialRows: res.rows || [],
            dmlStats: jobStats.dmlStats,
            statementType: jobStats.statementType,
            token: String(token),
            source: { kind: 'job', jobRef },
        }],
    };
}

/** True for statements whose child job reports a schema but never any rows. */
function isDdlStatement(statementType?: string): boolean {
    return !!statementType
        && (statementType.startsWith('CREATE_') || statementType.startsWith('DROP_') || statementType.startsWith('ALTER_'));
}

/**
 * Builds one table per statement of a script. Returns null when the script exposed nothing, so the
 * caller can fall back to the parent job's own result set.
 */
async function buildScriptView(jobRef: JobReference, token: string, childCount: number): Promise<View | null> {
    const children = await fetchChildJobs(jobRef, token, childCount).catch(() => [] as ChildJobSummary[]);
    if (children.length === 0) {
        return null;
    }

    const pages = await Promise.all(children.map(child =>
        fetchPage(child.jobRef, token, 0, DEFAULT_PAGE_SIZE).catch(() => undefined)));

    const tables: TableView[] = [];
    children.forEach((child, i) => {
        const res = pages[i];
        if (!res) { return; }
        tables.push({
            key: `child-${child.jobRef.jobId}`,
            exportRef: { jobReference: child.jobRef },
            schema: (res.schema?.fields || []) as BqField[],
            totalRows: parseInt(String(res.totalRows || '0'), 10),
            initialRows: res.rows || [],
            token,
            source: { kind: 'job', jobRef: child.jobRef },
            title: `Statement ${i + 1}${child.statementType ? ` · ${child.statementType}` : ''}`,
            dmlStats: child.dmlStats,
            statementType: child.statementType,
        });
    });

    // Hide the DDL steps of a script (`CREATE TEMP TABLE ...`): their child job reports the created
    // table's schema with zero rows, which renders as a confusing empty grid. Keep everything when
    // that would leave nothing to show.
    const withContent = tables.filter(t =>
        t.totalRows > 0 || !!t.dmlStats || (!isDdlStatement(t.statementType) && t.schema.length > 0));
    const shown = withContent.length > 0 ? withContent : tables;

    return shown.length > 0 ? { kind: 'tables', tables: shown } : null;
}

async function handlePreviewTable(msg: GridMessage): Promise<View> {
    const token = msg.token;
    const projectId = msg.projectId;
    const datasetId = msg.datasetId;
    const tableId = msg.tableId;
    if (!token || !projectId || !datasetId || !tableId) {
        return { kind: 'error', message: 'Missing projectId, datasetId, tableId, or token.', reason: null };
    }
    const tableRef: TableReference = { projectId, datasetId, tableId };
    const meta = await fetchTableMetadata(tableRef, String(token));
    const schema = (meta.schema?.fields || []) as BqField[];
    const totalRows = parseInt(String(meta.numRows || '0'), 10);
    const rowsRes = totalRows > 0
        ? await fetchTablePage(tableRef, String(token), 0, DEFAULT_PAGE_SIZE)
        : { rows: [] };
    return {
        kind: 'tables',
        tables: [{
            key: `table-${projectId}.${datasetId}.${tableId}`,
            exportRef: { tableReference: tableRef },
            schema,
            totalRows,
            initialRows: rowsRes.rows || [],
            token: String(token),
            source: { kind: 'table', tableRef },
            title: `${projectId}.${datasetId}.${tableId}`,
        }],
    };
}
