import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
    try {
        const extensionDevelopmentPath = path.resolve(__dirname, '../../../');
        const extensionTestsPath = path.resolve(__dirname, './index');
        // Pin to a specific VS Code build so CI/local runs reuse the cached install
        // instead of re-downloading whenever the `stable` channel bumps.
        await runTests({ version: '1.129.1', extensionDevelopmentPath, extensionTestsPath });
    } catch (err) {
        console.error('Failed to run host suite tests', err);
        process.exit(1);
    }
}

main();
