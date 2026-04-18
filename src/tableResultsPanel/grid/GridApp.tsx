import { useEffect, useState } from 'preact/hooks';
import { BqTable } from './BqTable';
import { fetchPage, DEFAULT_PAGE_SIZE } from './pagination';
import type { BqField, GridMessage, JobReference } from './types';

type View =
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'table'; jobRef: JobReference; token: string; schema: BqField[]; totalRows: number; initialRows: any[] }
    | { kind: 'error'; message: string; reason: string | null }
    | { kind: 'unsupported'; reason: string };

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
                    handleExecuteQuery(msg).then(setView).catch(e => setView({ kind: 'error', message: String(e?.message || e), reason: null }));
                    break;
                case 'preview_table':
                    setView({ kind: 'unsupported', reason: 'Table preview is not yet supported in the experimental grid. Disable vscode-bigquery.experimentalGrid to use the classic view.' });
                    break;
                default:
                    break;
            }
        }
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, []);

    if (view.kind === 'idle') { return <div class="bq-empty">No results yet.</div>; }
    if (view.kind === 'loading') { return <div class="bq-notice">Loading&hellip;</div>; }
    if (view.kind === 'error') {
        return (
            <div class="bq-error-panel">
                <div class="bq-error-title">Query Error</div>
                <div class="bq-error-msg">{view.message}</div>
                {view.reason && <div class="bq-error-reason">Reason: {view.reason}</div>}
            </div>
        );
    }
    if (view.kind === 'unsupported') {
        return <div class="bq-notice">{view.reason}</div>;
    }
    return (
        <BqTable
            jobRef={view.jobRef}
            token={view.token}
            schema={view.schema}
            totalRows={view.totalRows}
            initialRows={view.initialRows}
        />
    );
}

async function handleExecuteQuery(msg: GridMessage): Promise<View> {
    const job = msg.job as any;
    const token = msg.token;
    const projectId = msg.projectId;
    if (!job || !token || !projectId) {
        return { kind: 'error', message: 'Missing job, token, or projectId in message payload.', reason: null };
    }
    const ref = job.jobReference || job.metadata?.jobReference || {};
    const jobRef: JobReference = {
        projectId: String(ref.projectId || projectId),
        jobId: String(ref.jobId || job.id),
        location: ref.location,
    };
    if (!jobRef.jobId) {
        return { kind: 'error', message: 'Missing jobId.', reason: null };
    }

    const hasScript =
        (job.statistics?.scriptStatistics || job.metadata?.statistics?.scriptStatistics) != null;
    if (hasScript) {
        return { kind: 'unsupported', reason: 'Multi-statement scripts are not yet supported in the experimental grid. Disable vscode-bigquery.experimentalGrid to use the classic view.' };
    }

    const res = await fetchPage(jobRef, String(token), 0, DEFAULT_PAGE_SIZE);
    const schema = (res.schema?.fields || []) as BqField[];
    const totalRows = parseInt(String(res.totalRows || '0'), 10);
    return {
        kind: 'table',
        jobRef,
        token: String(token),
        schema,
        totalRows,
        initialRows: res.rows || [],
    };
}
