import * as path from 'path';
import * as Mocha from 'mocha';
import * as glob from 'glob';

/**
 * Scoped Extension Host suite: runs every *.test.js in this folder in a real
 * VS Code instance. Unlike ../suite, these tests need no BigQuery credentials
 * or network — they exercise language providers via the vscode.execute* APIs.
 */
export function run(): Promise<void> {
    const mocha = new Mocha({ ui: 'tdd', color: true, timeout: 30000 });
    const testsRoot = __dirname;
    return new Promise((resolve, reject) => {
        glob('*.test.js', { cwd: testsRoot }, (err, files) => {
            if (err) { return reject(err); }
            files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));
            try {
                mocha.run(failures => failures > 0 ? reject(new Error(`${failures} tests failed.`)) : resolve());
            } catch (e) { reject(e as Error); }
        });
    });
}
