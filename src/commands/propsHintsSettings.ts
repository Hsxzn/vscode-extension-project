import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function registerPropsHintsSettingsCommands(): vscode.Disposable[] {
    const openSettings = vscode.commands.registerCommand('extension.openPropsHintsSettings', async () => {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            vscode.window.showInformationMessage('未找到工作区');
            return;
        }

        const root = folders[0].uri.fsPath;
        const readmePath = path.join(root, 'README.md');
        if (!fs.existsSync(readmePath)) {
            vscode.window.showInformationMessage('当前工作区缺少 README.md');
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

    return [openSettings, openGeneratedFile];
}
