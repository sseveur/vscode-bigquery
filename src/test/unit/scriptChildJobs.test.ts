import * as assert from 'assert';
import { selectFinalDmlChildJob, selectFinalResultChildJob } from '../../services/bigqueryClient';
import type { Job } from '@google-cloud/bigquery';

/** Builds a minimal child-job stand-in with the metadata shape the pickers read. */
function child(opts: {
    id: string;
    destinationTable?: { projectId: string; datasetId: string; tableId: string };
    schemaFields?: Array<{ name: string }>;
    dmlStats?: { insertedRowCount?: string; updatedRowCount?: string; deletedRowCount?: string };
    numDmlAffectedRows?: string;
    statementType?: string;
    ddlTargetTable?: { projectId: string; datasetId: string; tableId: string };
}): Job {
    return {
        id: opts.id,
        metadata: {
            configuration: { query: { destinationTable: opts.destinationTable } },
            statistics: {
                query: {
                    schema: opts.schemaFields ? { fields: opts.schemaFields } : undefined,
                    dmlStats: opts.dmlStats,
                    numDmlAffectedRows: opts.numDmlAffectedRows,
                    statementType: opts.statementType,
                    ddlTargetTable: opts.ddlTargetTable,
                },
            },
        },
    } as unknown as Job;
}

const dt = { projectId: 'p', datasetId: 'd', tableId: 't' };

suite('script child-job selection', () => {

    suite('selectFinalResultChildJob', () => {
        test('picks the newest non-DDL child with a destination table', () => {
            // Live shape: SELECT children carry the anonymous result table as destinationTable
            // but NO statistics.query.schema in the jobs.list response.
            const kids = [
                child({ id: 'job_abc_1', destinationTable: dt, statementType: 'SELECT' }),
                child({ id: 'job_abc_3', destinationTable: dt, statementType: 'SELECT' }),
                child({ id: 'job_abc_2', statementType: 'DECLARE' }),
            ];
            assert.strictEqual(selectFinalResultChildJob(kids)?.id, 'job_abc_3');
        });

        test('skips children without a destination table', () => {
            const kids = [
                child({ id: 'job_abc_2', statementType: 'INSERT' }),  // live: INSERT child has no dest
                child({ id: 'job_abc_1', destinationTable: dt, statementType: 'SELECT' }),
            ];
            assert.strictEqual(selectFinalResultChildJob(kids)?.id, 'job_abc_1');
        });

        test('skips DDL children even though they carry dest table + schema (full projection)', () => {
            // Live shape: CREATE_TABLE / CTAS children expose destinationTable AND a schema, but
            // /queries on them yields no rows — must not shadow the older SELECT child.
            const kids = [
                child({ id: 'job_abc_2', destinationTable: dt, schemaFields: [{ name: 'a' }], ddlTargetTable: dt, statementType: 'CREATE_TABLE_AS_SELECT' }),
                child({ id: 'job_abc_1', destinationTable: dt, statementType: 'SELECT' }),
            ];
            assert.strictEqual(selectFinalResultChildJob(kids)?.id, 'job_abc_1');
        });

        test('DDL-only script → null (falls through to summary)', () => {
            const kids = [
                child({ id: 'job_abc_1', destinationTable: dt, schemaFields: [{ name: 'a' }], ddlTargetTable: dt, statementType: 'CREATE_TABLE' }),
                child({ id: 'job_abc_2', destinationTable: dt, ddlTargetTable: dt, statementType: 'DROP_TABLE' }),
            ];
            assert.strictEqual(selectFinalResultChildJob(kids), null);
        });

        test('returns null when no child carries a result set (DML-only script)', () => {
            const kids = [
                child({ id: 'job_abc_1', statementType: 'DECLARE' }),
                child({ id: 'job_abc_2', dmlStats: { deletedRowCount: '5' }, statementType: 'DELETE' }),
            ];
            assert.strictEqual(selectFinalResultChildJob(kids), null);
        });

        test('empty input → null', () => {
            assert.strictEqual(selectFinalResultChildJob([]), null);
        });
    });

    suite('selectFinalDmlChildJob', () => {
        test('picks the newest child with dmlStats', () => {
            const kids = [
                child({ id: 'job_abc_1', dmlStats: { insertedRowCount: '10' }, statementType: 'INSERT' }),
                child({ id: 'job_abc_3', dmlStats: { deletedRowCount: '2' }, statementType: 'DELETE' }),
                child({ id: 'job_abc_2', statementType: 'DECLARE' }),
            ];
            assert.strictEqual(selectFinalDmlChildJob(kids)?.id, 'job_abc_3');
        });

        test('accepts numDmlAffectedRows when dmlStats absent', () => {
            const kids = [
                child({ id: 'job_abc_1', statementType: 'DECLARE' }),
                child({ id: 'job_abc_2', numDmlAffectedRows: '7', statementType: 'UPDATE' }),
            ];
            assert.strictEqual(selectFinalDmlChildJob(kids)?.id, 'job_abc_2');
        });

        test('returns null for a pure DECLARE/DDL script', () => {
            const kids = [
                child({ id: 'job_abc_1', statementType: 'DECLARE' }),
                child({ id: 'job_abc_2', statementType: 'CREATE_TABLE' }),
                child({ id: 'job_abc_3', statementType: 'DROP_TABLE' }),
            ];
            assert.strictEqual(selectFinalDmlChildJob(kids), null);
        });

        test('does not mutate the input array order', () => {
            const kids = [
                child({ id: 'job_abc_2', dmlStats: { insertedRowCount: '1' } }),
                child({ id: 'job_abc_1', statementType: 'DECLARE' }),
            ];
            selectFinalDmlChildJob(kids);
            assert.deepStrictEqual(kids.map(k => k.id), ['job_abc_2', 'job_abc_1']);
        });
    });
});
