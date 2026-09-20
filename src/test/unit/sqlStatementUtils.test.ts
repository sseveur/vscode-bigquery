import * as assert from 'assert';
import { isMultiStatementScript, isSafeTableIdentifier, isTempTableStatement } from '../../services/sqlStatementUtils';

suite('sqlStatementUtils', () => {

    suite('isMultiStatementScript', () => {
        test('single statement without terminator', () => {
            assert.strictEqual(isMultiStatementScript('SELECT 1'), false);
        });

        test('single statement with trailing semicolon', () => {
            assert.strictEqual(isMultiStatementScript('SELECT 1;\n'), false);
        });

        test('two statements', () => {
            assert.strictEqual(isMultiStatementScript('CREATE TEMP TABLE t AS SELECT 1 AS x; SELECT * FROM t;'), true);
        });

        test('semicolon inside a string literal is not a separator', () => {
            assert.strictEqual(isMultiStatementScript("SELECT 'a;b' AS s"), false);
        });

        test('semicolon inside a line comment is not a separator', () => {
            assert.strictEqual(isMultiStatementScript('SELECT 1 -- and then; more\n'), false);
        });

        test('semicolon inside a block comment is not a separator', () => {
            assert.strictEqual(isMultiStatementScript('SELECT 1 /* x; y */'), false);
        });

        test('semicolon inside a backquoted table name is not a separator', () => {
            assert.strictEqual(isMultiStatementScript('SELECT * FROM `p.d.weird;name`'), false);
        });

        test('triple-quoted literal containing a semicolon', () => {
            assert.strictEqual(isMultiStatementScript('SELECT """a;b""" AS s'), false);
        });
    });

    suite('isSafeTableIdentifier', () => {
        test('accepts plain, dotted and backquoted names', () => {
            assert.strictEqual(isSafeTableIdentifier('t'), true);
            assert.strictEqual(isSafeTableIdentifier('dataset.table'), true);
            assert.strictEqual(isSafeTableIdentifier('my-project.dataset.table'), true);
            assert.strictEqual(isSafeTableIdentifier('`my-project`.`dataset`.`table`'), true);
        });

        test('rejects a name ending in a comment marker', () => {
            assert.strictEqual(isSafeTableIdentifier('dataset.table--'), false);
        });

        test('rejects more than three parts', () => {
            assert.strictEqual(isSafeTableIdentifier('a.b.c.d'), false);
        });

        test('rejects whitespace and quotes', () => {
            assert.strictEqual(isSafeTableIdentifier('`weird name`'), false);
            assert.strictEqual(isSafeTableIdentifier("t' OR '1"), false);
            assert.strictEqual(isSafeTableIdentifier('t;SELECT 1'), false);
        });

        test('rejects an empty name', () => {
            assert.strictEqual(isSafeTableIdentifier(''), false);
        });
    });

    suite('isTempTableStatement', () => {
        test('CREATE TEMP TABLE', () => {
            assert.strictEqual(isTempTableStatement('CREATE TEMP TABLE t AS SELECT 1'), true);
        });

        test('CREATE TEMPORARY TABLE, leading whitespace', () => {
            assert.strictEqual(isTempTableStatement('  \n CREATE TEMPORARY TABLE t (id INT64)'), true);
        });

        test('CREATE OR REPLACE TEMP TABLE', () => {
            assert.strictEqual(isTempTableStatement('CREATE OR REPLACE TEMP TABLE t AS SELECT 1'), true);
        });

        test('plain CREATE TABLE is not temp', () => {
            assert.strictEqual(isTempTableStatement('CREATE TABLE d.t AS SELECT 1'), false);
        });

        test('a SELECT is not temp', () => {
            assert.strictEqual(isTempTableStatement('SELECT 1'), false);
        });
    });
});
