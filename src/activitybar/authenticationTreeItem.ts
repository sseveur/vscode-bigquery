import * as vscode from 'vscode';
import * as commands from '../extensionCommands';

export enum AuthenticationTreeItemType {
    none,
    authenticatedParent,
    addAuthenticationParent,
    user,
    error,
    problemsAuthenticatingParent,
    userLogin,
    userLoginPlusGoogleDrive,
    serviceAccount,
    troubleshoot,
    gcloudInit,
    userLoginNoBrowserLaunch
}

export class AuthenticationTreeItem extends vscode.TreeItem {

    constructor(
        public readonly treeItemType: AuthenticationTreeItemType,

        public readonly label: string,
        public readonly description: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    ) {
        super(label, collapsibleState);

        switch (treeItemType) {
            case AuthenticationTreeItemType.authenticatedParent:
                this.iconPath = new vscode.ThemeIcon('verified-filled');
                break;
            case AuthenticationTreeItemType.addAuthenticationParent:
                this.iconPath = new vscode.ThemeIcon('add');
                break;
            case AuthenticationTreeItemType.problemsAuthenticatingParent:
                this.iconPath = new vscode.ThemeIcon('question');
                break;
            case AuthenticationTreeItemType.user:
                this.iconPath = new vscode.ThemeIcon('account');
                this.contextValue = 'gcp-user';
                break;
            case AuthenticationTreeItemType.userLogin:
                this.iconPath = new vscode.ThemeIcon('sign-in');
                this.command = { command: commands.COMMAND_USER_LOGIN, arguments: [this] } as vscode.Command;
                break;
            case AuthenticationTreeItemType.userLoginPlusGoogleDrive:
                this.iconPath = new vscode.ThemeIcon('sign-in');
                this.command = { command: commands.COMMAND_USER_LOGIN_WITH_DRIVE, arguments: [this] } as vscode.Command;
                break;
            case AuthenticationTreeItemType.userLoginNoBrowserLaunch:
                this.iconPath = new vscode.ThemeIcon('terminal');
                this.command = { command: commands.COMMAND_USER_LOGIN_NO_LAUNCH_BROWSER, arguments: [this] } as vscode.Command;
                break;
            case AuthenticationTreeItemType.serviceAccount:
                this.iconPath = new vscode.ThemeIcon('key');
                this.command = { command: commands.COMMAND_SERVICE_ACCOUNT_LOGIN, arguments: [this] } as vscode.Command;
                break;
            case AuthenticationTreeItemType.gcloudInit:
                this.iconPath = new vscode.ThemeIcon('cloud');
                this.command = { command: commands.COMMAND_GCLOUD_INIT, arguments: [this] } as vscode.Command;
                break;
            case AuthenticationTreeItemType.troubleshoot:
                this.iconPath = new vscode.ThemeIcon('tools');
                this.command = { command: commands.AUTHENTICATION_TROUBLESHOOT, arguments: [this] } as vscode.Command;
                break;
        }

        this.description = this.description;
    }
}