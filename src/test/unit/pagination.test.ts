import * as assert from 'assert';
import { fetchPage, fetchChildJobs, DEFAULT_PAGE_SIZE } from '../../tableResultsPanel/grid/pagination';
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
