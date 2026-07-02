import * as assert from 'assert';
import {
    describeJob,
    formatJobBytes,
    jobEntryDescription,
    jobEntryLabel,
    relativeAge,
} from '../../services/jobHistoryService';

/** Minimal jobs.list (projection=full) metadata shape. */
const meta = (over: Record<string, unknown> = {}) => ({
    jobReference: { projectId: 'p', jobId: 'job_1', location: 'EU' },
    configuration: { jobType: 'QUERY', query: { query: 'SELECT 1' } },
    status: { state: 'DONE' },
    statistics: {
        creationTime: '1700000000000',
        startTime: '1700000000100',
        endTime: '1700000002100',
        totalBytesProcessed: '1048576',
        query: { statementType: 'SELECT', cacheHit: false },
    },
    // eslint-disable-next-line @typescript-eslint/naming-convention
    user_email: 'steven@example.com',
    ...over,
});

suite('jobHistoryService', () => {

    test('maps a finished SELECT job', () => {
        const e = describeJob(meta());
        assert.strictEqual(e.jobReference.jobId, 'job_1');
        assert.strictEqual(e.jobType, 'query');
        assert.strictEqual(e.statementType, 'SELECT');
        assert.strictEqual(e.state, 'DONE');
        assert.strictEqual(e.user, 'steven@example.com');
        assert.strictEqual(e.durationMs, 2000);
        assert.strictEqual(e.bytesProcessed, 1048576);
        assert.strictEqual(e.hasResults, true);
    });

    test('errored job → error message, no results', () => {
        const e = describeJob(meta({ status: { state: 'DONE', errorResult: { message: 'boom' } } }));
        assert.strictEqual(e.errorMessage, 'boom');
        assert.strictEqual(e.hasResults, false);
    });

    test('running job → no results yet', () => {
        const e = describeJob(meta({ status: { state: 'RUNNING' } }));
        assert.strictEqual(e.hasResults, false);
    });

    test('DDL job → no results; CTAS keeps results', () => {
        const ddl = describeJob(meta({
            statistics: { ...meta().statistics, query: { statementType: 'CREATE_TABLE', ddlOperationPerformed: 'CREATE' } },
        }));
        assert.strictEqual(ddl.hasResults, false);
        const ctas = describeJob(meta({
            statistics: { ...meta().statistics, query: { statementType: 'CREATE_TABLE_AS_SELECT' } },
        }));
        assert.strictEqual(ctas.hasResults, true);
    });

    test('load job → labeled by type, no results', () => {
        const e = describeJob(meta({
            configuration: { jobType: 'LOAD' },
            statistics: { creationTime: '1700000000000', startTime: '1700000000100', endTime: '1700000002100' },
        }));
        assert.strictEqual(e.jobType, 'load');
        assert.strictEqual(e.hasResults, false);
        assert.strictEqual(jobEntryLabel(e), 'load');
    });

    test('label truncates long queries on one line', () => {
        const e = describeJob(meta({ configuration: { jobType: 'QUERY', query: { query: 'SELECT   a,\n  b ' + 'x'.repeat(100) } } }));
        const label = jobEntryLabel(e);
        assert.ok(label.length <= 60);
        assert.ok(!label.includes('\n'));
    });

    test('description carries type, user, bytes, duration, age', () => {
        const now = 1700000062100; // 60s after end
        const d = jobEntryDescription(describeJob(meta()), now);
        assert.ok(d.includes('SELECT'), d);
        assert.ok(d.includes('steven'), d);
        assert.ok(d.includes('1.0 MB'), d);
        assert.ok(d.includes('2.0s'), d);
        assert.ok(d.includes('ago'), d);
    });

    test('cache hit shown instead of bytes', () => {
        const e = describeJob(meta({
            statistics: { ...meta().statistics, query: { statementType: 'SELECT', cacheHit: true } },
        }));
        const d = jobEntryDescription(e, 1700000062100);
        assert.ok(d.includes('cached'), d);
        assert.ok(!d.includes('MB'), d);
    });

    test('relativeAge buckets', () => {
        const now = 1_000_000_000_000;
        assert.strictEqual(relativeAge(now - 30e3, now), '30s ago');
        assert.strictEqual(relativeAge(now - 5 * 60e3, now), '5m ago');
        assert.strictEqual(relativeAge(now - 3 * 3600e3, now), '3h ago');
        assert.strictEqual(relativeAge(now - 2 * 86400e3, now), '2d ago');
    });

    test('formatJobBytes', () => {
        assert.strictEqual(formatJobBytes(0), '0 B');
        assert.strictEqual(formatJobBytes(512), '512 B');
        assert.strictEqual(formatJobBytes(1536), '1.5 KB');
    });
});

suite('job details', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { buildJobDetails } = require('../../services/jobHistoryService');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { renderJobDetailsHtml } = require('../../activitybar/jobDetailsPanel');

    const full = meta({
        statistics: {
            creationTime: '1700000000000', startTime: '1700000000100', endTime: '1700000002100',
            totalBytesProcessed: '1048576', totalSlotMs: '4500',
            query: {
                statementType: 'SELECT',
                queryPlan: [
                    { name: 'S00: Input', status: 'COMPLETE', recordsRead: '1000', recordsWritten: '50', waitMsAvg: '1', readMsAvg: '2', computeMsAvg: '30', writeMsAvg: '4' },
                ],
                timeline: [
                    { elapsedMs: '500', totalSlotMs: '1000' },
                    { elapsedMs: '1000', totalSlotMs: '4500' },
                ],
                referencedTables: [{ projectId: 'p', datasetId: 'd', tableId: 't' }],
            },
        },
        status: { state: 'DONE', errors: [{ message: 'warn <tag>', reason: 'invalid' }] },
    });

    test('extracts stages, timeline, errors, tables, slot time', () => {
        const d = buildJobDetails(full);
        assert.strictEqual(d.stages.length, 1);
        assert.strictEqual(d.stages[0].computeMsAvg, 30);
        assert.strictEqual(d.timeline.length, 2);
        assert.strictEqual(d.totalSlotMs, 4500);
        assert.deepStrictEqual(d.referencedTables, ['p.d.t']);
        assert.strictEqual(d.errors.length, 1);
    });

    test('renders script-free HTML with everything escaped', () => {
        const html = renderJobDetailsHtml(buildJobDetails(full));
        assert.ok(!html.includes('<script'), 'no scripts allowed');
        assert.ok(html.includes("default-src 'none'"), 'CSP present');
        assert.ok(html.includes('warn &lt;tag&gt;'), 'error message escaped');
        assert.ok(html.includes('S00: Input'));
        assert.ok(html.includes('SELECT 1'));
    });

    test('renders minimal jobs without optional sections', () => {
        const html = renderJobDetailsHtml(buildJobDetails(meta()));
        assert.ok(!html.includes('Execution plan'));
        assert.ok(!html.includes('Errors'));
    });
});
