import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AuthenticationListItem } from './authenticationListItem';
import { AuthenticationUserLoginResponse } from './authenticationUserLoginResponse';
import { CustomTerminal } from './customTerminal';

//https://cloud.google.com/sdk/docs/cheatsheet#credentials

export class Authentication {

    //https://cloud.google.com/sdk/gcloud/reference/auth/login
    public static async userLogin(): Promise<AuthenticationUserLoginResponse> {
        const result = await this.runGcloudCommand([
            'auth', 'login',
            '--update-adc',
            '--add-quota-project-to-adc',
            '--quiet',
            '--verbosity', 'warning',
            '--format', 'json'
        ], true);

        //set default project if needed
        await Authentication.setDefaultProject();

        return JSON.parse(result) as AuthenticationUserLoginResponse;
    }

    public static async userLoginWithDrive(): Promise<AuthenticationUserLoginResponse> {
        const result = await this.runGcloudCommand([
            'auth', 'login',
            '--update-adc',
            '--add-quota-project-to-adc',
            '--quiet',
            '--enable-gdrive-access',
            '--verbosity', 'warning',
            '--format', 'json'
        ], true);

        //set default project if needed
        await Authentication.setDefaultProject();

        return JSON.parse(result) as AuthenticationUserLoginResponse;
    }

    public static async serviceAccountLogin(fileUri: vscode.Uri): Promise<AuthenticationUserLoginResponse> {

        try {

            // Validate service account key file structure before using it
            const keyFileContent = fs.readFileSync(fileUri.fsPath, 'utf-8');
            let parsedKey: any;
            try {
                parsedKey = JSON.parse(keyFileContent);
            } catch {
                console.error('Service account key file is not valid JSON');
                return { valid: false } as AuthenticationUserLoginResponse;
            }

            // Validate required fields for a service account key
            if (!parsedKey.type || !parsedKey.project_id || !parsedKey.private_key || !parsedKey.client_email) {
                console.error('Service account key file is missing required fields (type, project_id, private_key, or client_email)');
                return { valid: false } as AuthenticationUserLoginResponse;
            }

            if (parsedKey.type !== 'service_account') {
                console.error('Key file type must be "service_account"');
                return { valid: false } as AuthenticationUserLoginResponse;
            }

            const result = await this.runGcloudCommand([
                'auth', 'activate-service-account',
                '--key-file', fileUri.fsPath,
                '--format', 'json'
            ], true);

            const typedResult = JSON.parse(result) as string[];
            if (typedResult.length === 0) {

                //change default credentials using Node.js fs instead of shell commands
                //https://cloud.google.com/docs/authentication/application-default-credentials#personal
                const destDir = process.platform === 'win32'
                    ? path.join(process.env.APPDATA || '', 'gcloud')
                    : path.join(os.homedir(), '.config', 'gcloud');

                const destPath = path.join(destDir, 'application_default_credentials.json');

                // Ensure directory exists
                if (!fs.existsSync(destDir)) {
                    fs.mkdirSync(destDir, { recursive: true });
                }

                // Copy file using Node.js fs (secure, no shell injection)
                fs.copyFileSync(fileUri.fsPath, destPath);

                //set default project if needed
                await Authentication.setDefaultProject();

                return { valid: true } as AuthenticationUserLoginResponse;
            }

        } catch (error) {
            // Sanitize error logging to avoid exposing sensitive data like file paths or credentials
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Service account login failed:', errorMessage);
        }

        return { valid: false } as AuthenticationUserLoginResponse;
    }

    private static async setDefaultProject() {
        const defaultProject = await this.runGcloudCommand(['config', 'get', 'project'], true);
        if (!defaultProject) {
            const projectsString = await this.runGcloudCommand(['projects', 'list', '--format', 'json'], true);

            const projects = JSON.parse(projectsString);
            if (projects && projects.length && projects.length > 0) {
                const projectId = projects[0].projectId;
                if (projectId) {
                    await this.runGcloudCommand(['config', 'set', 'project', projectId], true);
                }
            }
        }
    }

    public static async list(forceShowConsole: boolean): Promise<AuthenticationListItem[]> {
        const result = await this.runGcloudCommand(['auth', 'list', '--format', 'json'], forceShowConsole);
        return JSON.parse(result) as AuthenticationListItem[];
    }

    public static async activate(account: string): Promise<boolean> {
        await this.runGcloudCommand(['config', 'set', 'core/account', account, '--format', 'json'], true);
        return true;
    }

    public static async revoke(account: string): Promise<boolean> {
        const result = await this.runGcloudCommand(['auth', 'revoke', account, '--format', 'json'], true);
        return (JSON.parse(result) as string[]).indexOf(account) >= 0;
    }

    public static async getDefaultProjectId(): Promise<string> {
        const result = await this.runGcloudCommand(['config', 'get-value', 'project'], false);
        return result.trim();
    }

    public static async setDefaultProjectId(projectId: string): Promise<void> {
        await this.runGcloudCommand(['config', 'set', 'project', projectId], true);
    }

    //https://cloud.google.com/sdk/gcloud/reference/auth/revoke

    /**
     * Runs a gcloud command using execFile (not exec) to prevent shell injection.
     * Arguments are passed as an array, not interpolated into a command string.
     */
    private static runGcloudCommand(args: string[], forceShow: boolean): Promise<string> {
        const terminalName = 'gcloud authentication';
        const qTerminal = vscode.window.terminals.find(c => c.name === terminalName);
        let terminal: vscode.Terminal;

        if (qTerminal) {
            terminal = qTerminal;
        } else {
            const customTerminal = new CustomTerminal();
            const terminalOptions = {
                name: terminalName,
                pty: customTerminal,
                isTransient: true,
            } as vscode.ExtensionTerminalOptions;
            terminal = vscode.window.createTerminal(terminalOptions);
        }

        // Display command for user visibility
        const displayCommand = `gcloud ${args.join(' ')}`;
        terminal.sendText(`\x1b[1m\x1b[34m# ${displayCommand}\x1b[0m`);

        if (forceShow) { terminal.show(); }

        // On Windows, use shell: true to allow PATH resolution of gcloud.cmd
        // On Mac/Linux, keep shell: false for better security
        const commandOptions: cp.ExecFileOptions = {
            shell: process.platform === 'win32'
        };

        return new Promise((resolve, reject) => {
            cp.execFile('gcloud', args, commandOptions, (error, stdout, stderr) => {
                if (error) {
                    terminal.sendText(stderr);

                    // Provide helpful message if gcloud is not found
                    let diagnosticMessage = stderr;
                    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                        diagnosticMessage = 'gcloud CLI not found. Please ensure Google Cloud SDK is installed and added to PATH. Restart VS Code after installation.';
                    }

                    reject({ error, stdout, stderr: diagnosticMessage || stderr });
                } else {
                    terminal.sendText(stdout);
                    resolve(stdout);
                }
            });
        });
    }

}
