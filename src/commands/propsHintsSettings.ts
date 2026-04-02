import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

function resolveTargetFileUri(resource?: vscode.Uri): vscode.Uri | undefined {
    if (resource && resource.fsPath) {
        return resource;
    }

    const activeEditor = vscode.window.activeTextEditor;
    const activeUri = activeEditor?.document?.uri;
    if (activeUri?.fsPath) {
        return activeUri;
    }

    return undefined;
}

async function openFileInSimpleBrowser(resource?: vscode.Uri): Promise<void> {
    const targetUri = resolveTargetFileUri(resource);
    if (!targetUri) {
        vscode.window.showInformationMessage('未找到可打开的当前文件');
        return;
    }

    try {
        await vscode.commands.executeCommand('simpleBrowser.show', targetUri.toString());
    } catch {
        vscode.window.showErrorMessage('VS Code 内置浏览器无法打开当前文件');
    }
}

async function openFileInSystemBrowser(resource?: vscode.Uri): Promise<void> {
    const targetUri = resolveTargetFileUri(resource);
    if (!targetUri) {
        vscode.window.showInformationMessage('未找到可打开的当前文件');
        return;
    }

    const opened = await vscode.env.openExternal(targetUri);
    if (!opened) {
        vscode.window.showErrorMessage('系统浏览器无法打开当前文件');
    }
}

export function registerPropsHintsSettingsCommands(): vscode.Disposable[] {
    const openSettings = vscode.commands.registerCommand('extension.openPropsHintsSettings', async () => {
        const candidatePaths = [
            path.resolve(__dirname, '../README.md'),
            path.resolve(__dirname, '../../README.md'),
        ];
        const readmePath = candidatePaths.find(fs.existsSync);
        if (!readmePath) {
            vscode.window.showInformationMessage('扩展目录缺少 README.md');
            return;
        }

        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(readmePath));
        await vscode.window.showTextDocument(doc, { preview: false });
    });

    const openGeneratedFile = vscode.commands.registerCommand('extension.openPropsHintsFile', async () => {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            vscode.window.showInformationMessage('未找到工作区');
            return;
        }
        const root = folders[0].uri.fsPath;
        const filePath = path.join(root, '.vscode', 'component-props-hints.d.ts');
        if (!fs.existsSync(filePath)) {
            vscode.window.showInformationMessage('尚未生成 props 提示文件，请先运行 Generate Vue/JS Props Hints');
            return;
        }
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
        await vscode.window.showTextDocument(doc, { preview: false });
    });

    const openCurrentFileInInternalBrowser = vscode.commands.registerCommand('extension.openCurrentFileInInternalBrowser', async (resource?: vscode.Uri) => {
        await openFileInSimpleBrowser(resource);
    });

    const openCurrentFileInSystemBrowser = vscode.commands.registerCommand('extension.openCurrentFileInSystemBrowser', async (resource?: vscode.Uri) => {
        await openFileInSystemBrowser(resource);
    });

    return [openSettings, openGeneratedFile, openCurrentFileInInternalBrowser, openCurrentFileInSystemBrowser];
}
