import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function registerPropsHintsSettingsCommands(): vscode.Disposable[] {
    const openSettings = vscode.commands.registerCommand('extension.openPropsHintsSettings', async () => {
        const doc = await vscode.workspace.openTextDocument({
            content: [
                '# Props Hints 配置',
                '',
                '- 启动后会自动扫描工作区根目录下的 `src` 中所有 `.js` 和 `.vue` 文件。',
                '- 当 `src` 中相关文件变化时会自动重新生成提示文件。',
                '- 你也可以通过命令面板执行 "Generate Vue/JS Props Hints" 手动触发扫描。',
                '',
                '生成文件路径：',
                '- `.vscode/component-props-hints.d.ts`',
                '',
                '常用命令：',
                '- `Generate Vue/JS Props Hints`: 立即重新扫描并生成。',
                '- `Open Generated Props Hints File`: 打开已生成的提示文件。'
            ].join('\n'),
            language: 'markdown',
        });
        await vscode.window.showTextDocument(doc, { preview: true });
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
