"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPropsHintsSettingsCommands = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
function registerPropsHintsSettingsCommands() {
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
    return [openSettings, openGeneratedFile];
}
exports.registerPropsHintsSettingsCommands = registerPropsHintsSettingsCommands;
//# sourceMappingURL=propsHintsSettings.js.map