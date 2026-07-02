/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Unit-suite bootstrap. These tests run in plain Node (no VS Code Extension Host), so any
 * module that does `import * as vscode from 'vscode'` would fail to resolve. We intercept the
 * module loader and hand back a minimal stub: the only vscode surface the units touch is
 * `workspace.getConfiguration(...).get(key, default)`, which we resolve to the supplied default
 * so `getFormatOptions()` yields the declared package.json defaults. Tests that need specific
 * options pass them explicitly to `formatBigQuerySQL`.
 *
 * Required via mocha `--require` before any test file loads, so the patch is in place when
 * bqsqlFormatter.ts is first required.
 */
const nodeModule = require('module');

const vscodeStub = {
    workspace: {
        getConfiguration: () => ({
            get: (_key: string, def: unknown) => def,
        }),
    },
    // Minimal notebook data classes so pure text→cells logic is testable headless.
    NotebookCellKind: { Markup: 1, Code: 2 },
    NotebookCellData: class {
        constructor(public kind: number, public value: string, public languageId: string) { }
    },
    NotebookData: class {
        constructor(public cells: unknown[]) { }
    },
};

const originalLoad = nodeModule._load;
nodeModule._load = function (request: string, parent: unknown, isMain: boolean) {
    if (request === 'vscode') {
        return vscodeStub;
    }
    return originalLoad.apply(this, arguments as never);
};
