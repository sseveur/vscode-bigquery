import * as path from 'path';
import * as Mocha from 'mocha';

export function run(): Promise<void> {
    const mocha = new Mocha({ ui: 'tdd', color: true, timeout: 30000 });
    mocha.addFile(path.resolve(__dirname, 'completionCase.test.js'));
    return new Promise((resolve, reject) => {
        try {
            mocha.run(failures => failures > 0 ? reject(new Error(`${failures} tests failed.`)) : resolve());
        } catch (err) { reject(err as Error); }
    });
}
