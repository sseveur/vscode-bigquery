import * as assert from 'assert';
import { fetchPage, fetchChildJobs, fetchJobMetadata, waitForJobDone, DEFAULT_PAGE_SIZE } from '../../tableResultsPanel/grid/pagination';
import type { JobReference } from '../../tableResultsPanel/grid/types';

/** Installs a fake global fetch that records the URL and returns `body` as JSON. Returns a
 *  restore fn and a getter for the captured URL. */
function stubFetch(body: unknown) {
    const original = (globalThis as any).fetch;
    let calledUrl = '';
    (globalThis as any).fetch = async (url: string) => {
        calledUrl = url;
        return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => body,
            text: async () => JSON.stringify(body),
        };
    };
    return {
        restore: () => { (globalThis as any).fetch = original; },
        url: () => calledUrl,
    };
}

/** Fake fetch returning each body in turn (last one repeats), counting the calls. */
function stubFetchSequence(bodies: unknown[]) {
    const original = (globalThis as any).fetch;
    let calls = 0;
    (globalThis as any).fetch = async () => {
        const body = bodies[Math.min(calls, bodies.length - 1)];
        calls++;
        return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => body,
            text: async () => JSON.stringify(body),
        };
    };
    return {
        restore: () => { (globalThis as any).fetch = original; },
        calls: () => calls,
    };
}

const job: JobReference = { projectId: 'proj-1', jobId: 'job_abc', location: 'EU' };

suite('pagination', () => {

    test('DEFAULT_PAGE_SIZE is 50', () => {
        assert.strictEqual(DEFAULT_PAGE_SIZE, 50);
    });

    suite('fetchPage URL construction', () => {
        test('encodes ids and includes maxResults/startIndex/location', async () => {
            const f = stubFetch({ rows: [] });
            try {
                await fetchPage(job, 'tok', 100, 25);
                const url = f.url();
                assert.ok(url.includes('/projects/proj-1/queries/job_abc'), url);
                assert.ok(url.includes('maxResults=25'), url);
                assert.ok(url.includes('startIndex=100'), url);
                assert.ok(url.includes('location=EU'), url);
            } finally {
                f.restore();
            }
        });

        test('uses DEFAULT_PAGE_SIZE when pageSize omitted', async () => {
            const f = stubFetch({ rows: [] });
            try {
                await fetchPage({ projectId: 'p', jobId: 'j' }, 'tok', 0);
                assert.ok(f.url().includes(`maxResults=${DEFAULT_PAGE_SIZE}`), f.url());
                // no location param when jobRef has none
                assert.ok(!f.url().includes('location='), f.url());
            } finally {
                f.restore();
            }
        });

        test('special chars in ids are percent-encoded', async () => {
            const f = stubFetch({ rows: [] });
            try {
                await fetchPage({ projectId: 'a/b', jobId: 'x y' }, 'tok', 0);
                assert.ok(f.url().includes('projects/a%2Fb'), f.url());
                assert.ok(f.url().includes('queries/x%20y'), f.url());
            } finally {
                f.restore();
            }
        });
    });

    suite('fetchPage job completion', () => {
        test('asks the server to wait via timeoutMs', async () => {
            const f = stubFetch({ jobComplete: true, rows: [] });
            try {
                await fetchPage(job, 'tok', 0);
                assert.ok(f.url().includes('timeoutMs='), f.url());
            } finally {
                f.restore();
            }
        });

        test('retries while the job reports jobComplete: false', async () => {
            const f = stubFetchSequence([
                { jobComplete: false },
                { jobComplete: false },
                { jobComplete: true, schema: { fields: [{ name: 'a' }] }, totalRows: '1', rows: [{ f: [{ v: '1' }] }] },
            ]);
            try {
                const res = await fetchPage(job, 'tok', 0);
                assert.strictEqual(f.calls(), 3);
                assert.strictEqual(res.totalRows, '1');
            } finally {
                f.restore();
            }
        });

        test('returns responses that omit jobComplete (table-style payloads)', async () => {
            const f = stubFetchSequence([{ rows: [] }]);
            try {
                await fetchPage(job, 'tok', 0);
                assert.strictEqual(f.calls(), 1);
            } finally {
                f.restore();
            }
        });
    });

    suite('fetchJobMetadata', () => {
        test('requests the job with full projection and location', async () => {
            const f = stubFetch({ statistics: { numChildJobs: '3' } });
            try {
                const meta = await fetchJobMetadata(job, 'tok');
                assert.strictEqual(meta.statistics?.numChildJobs, '3');
                assert.ok(f.url().includes('/projects/proj-1/jobs/job_abc'), f.url());
                assert.ok(f.url().includes('projection=full'), f.url());
                assert.ok(f.url().includes('location=EU'), f.url());
            } finally {
                f.restore();
            }
        });
    });

    suite('waitForJobDone', () => {
        test('returns as soon as the job is DONE', async () => {
            const f = stubFetchSequence([{ status: { state: 'DONE' }, statistics: { numChildJobs: '3' } }]);
            try {
                const meta = await waitForJobDone(job, 'tok');
                assert.strictEqual(f.calls(), 1);
                assert.strictEqual(meta.statistics?.numChildJobs, '3');
            } finally {
                f.restore();
            }
        });

        test('polls while the job is still running', async () => {
            const f = stubFetchSequence([
                { status: { state: 'RUNNING' } },
                { status: { state: 'RUNNING' } },
                { status: { state: 'DONE' }, statistics: {} },
            ]);
            try {
                await waitForJobDone(job, 'tok');
                assert.strictEqual(f.calls(), 3);
            } finally {
                f.restore();
            }
        });
    });

    suite('fetchChildJobs statement-type filter', () => {
        const listBody = {
            jobs: [
                { jobReference: { projectId: 'p', jobId: 'c_select', location: 'US' }, statistics: { query: { statementType: 'SELECT' } } },
                { jobReference: { projectId: 'p', jobId: 'c_with' }, statistics: { query: { statementType: 'WITH' } } },
                { jobReference: { projectId: 'p', jobId: 'c_ctas' }, statistics: { query: { statementType: 'CREATE_TABLE_AS_SELECT' } } },
                { jobReference: { projectId: 'p', jobId: 'c_merge' }, statistics: { query: { statementType: 'MERGE' } } },
                { jobReference: { projectId: 'p', jobId: 'c_insert' }, statistics: { query: { statementType: 'INSERT' } } },
                // dropped: no statementType (e.g. DECLARE / SET / script parent)
                { jobReference: { projectId: 'p', jobId: 'c_declare' }, statistics: { query: {} } },
                { jobReference: { projectId: 'p', jobId: 'c_script' }, statistics: { query: { statementType: 'SCRIPT' } } },
            ],
        };

        test('keeps result-producing statements, drops declare/script/empty', async () => {
            const f = stubFetch(listBody);
            try {
                const kids = await fetchChildJobs({ projectId: 'p', jobId: 'parent' }, 'tok');
                const ids = kids.map(k => k.jobRef.jobId).sort();
                assert.deepStrictEqual(ids, ['c_ctas', 'c_insert', 'c_merge', 'c_select', 'c_with']);
            } finally {
                f.restore();
            }
        });

        test('orders children by creation time, oldest first', async () => {
            const f = stubFetch({
                jobs: [
                    { jobReference: { projectId: 'p', jobId: 'c3' }, statistics: { creationTime: '300', query: { statementType: 'SELECT' } } },
                    { jobReference: { projectId: 'p', jobId: 'c1' }, statistics: { creationTime: '100', query: { statementType: 'CREATE_TABLE_AS_SELECT' } } },
                    { jobReference: { projectId: 'p', jobId: 'c2' }, statistics: { creationTime: '200', query: { statementType: 'SELECT' } } },
                ],
            });
            try {
                const kids = await fetchChildJobs({ projectId: 'p', jobId: 'parent' }, 'tok');
                assert.deepStrictEqual(kids.map(k => k.jobRef.jobId), ['c1', 'c2', 'c3']);
            } finally {
                f.restore();
            }
        });

        test('drops children that failed', async () => {
            const f = stubFetch({
                jobs: [
                    { jobReference: { projectId: 'p', jobId: 'ok' }, statistics: { query: { statementType: 'SELECT' } } },
                    {
                        jobReference: { projectId: 'p', jobId: 'bad' },
                        statistics: { query: { statementType: 'SELECT' } },
                        status: { state: 'DONE', errorResult: { message: 'boom' } },
                    },
                ],
            });
            try {
                const kids = await fetchChildJobs({ projectId: 'p', jobId: 'parent' }, 'tok');
                assert.deepStrictEqual(kids.map(k => k.jobRef.jobId), ['ok']);
            } finally {
                f.restore();
            }
        });

        test('does not poll when the listing already holds every child', async () => {
            const f = stubFetchSequence([{
                jobs: [
                    { jobReference: { projectId: 'p', jobId: 'c1' }, statistics: { query: { statementType: 'SELECT' } } },
                    { jobReference: { projectId: 'p', jobId: 'c2' }, statistics: { query: { statementType: 'SELECT' } } },
                ],
            }]);
            try {
                const kids = await fetchChildJobs({ projectId: 'p', jobId: 'parent' }, 'tok', 2);
                assert.strictEqual(kids.length, 2);
                assert.strictEqual(f.calls(), 1);
            } finally {
                f.restore();
            }
        });

        test('polls until jobs.list catches up with numChildJobs', async () => {
            const f = stubFetchSequence([
                { jobs: [{ jobReference: { projectId: 'p', jobId: 'c1' }, statistics: { creationTime: '1', query: { statementType: 'CREATE_TABLE_AS_SELECT' } } }] },
                { jobs: [{ jobReference: { projectId: 'p', jobId: 'c1' }, statistics: { creationTime: '1', query: { statementType: 'CREATE_TABLE_AS_SELECT' } } }] },
                {
                    jobs: [
                        { jobReference: { projectId: 'p', jobId: 'c1' }, statistics: { creationTime: '1', query: { statementType: 'CREATE_TABLE_AS_SELECT' } } },
                        { jobReference: { projectId: 'p', jobId: 'c2' }, statistics: { creationTime: '2', query: { statementType: 'SELECT' } } },
                        { jobReference: { projectId: 'p', jobId: 'c3' }, statistics: { creationTime: '3', query: { statementType: 'SELECT' } } },
                    ],
                },
            ]);
            try {
                const kids = await fetchChildJobs({ projectId: 'p', jobId: 'parent' }, 'tok', 3);
                assert.deepStrictEqual(kids.map(k => k.jobRef.jobId), ['c1', 'c2', 'c3']);
                assert.ok(f.calls() >= 3, `expected repeated listings, got ${f.calls()}`);
            } finally {
                f.restore();
            }
        });

        test('carries jobRef fields and statementType through', async () => {
            const f = stubFetch(listBody);
            try {
                const kids = await fetchChildJobs({ projectId: 'p', jobId: 'parent', location: 'US' }, 'tok');
                const sel = kids.find(k => k.jobRef.jobId === 'c_select')!;
                assert.strictEqual(sel.jobRef.projectId, 'p');
                assert.strictEqual(sel.jobRef.location, 'US');
                assert.strictEqual(sel.statementType, 'SELECT');
                // request carried parentJobId
                assert.ok(f.url().includes('parentJobId=parent'), f.url());
            } finally {
                f.restore();
            }
        });
    });
});
