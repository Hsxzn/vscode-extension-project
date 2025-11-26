/**
 * @file VS Code 扩展入口文件。
 * @description 负责扩展的激活与注销生命周期，并注册所有命令。
 */
import * as vscode from 'vscode';
import { registerSampleCommand } from './commands/sampleCommand';
import { registerGeneratePropsHintsCommand, generatePropsHintsOnce } from './commands/generatePropsHints';
import { registerPropsHintsSettingsCommands } from './commands/propsHintsSettings';
import { registerComponentHoverProvider } from './hover/componentHoverProvider';

/**
 * 激活扩展。
 *
 * 当扩展第一次被 VS Code 激活时会调用该函数，
 * 在这里注册示例命令并将返回的 Disposable 加入上下文。
 *
 * @param context VS Code 扩展上下文，包含订阅和全局状态。
 * @returns 表示已注册示例命令的 Disposable 对象。
 */
export function activate(context?: vscode.ExtensionContext): vscode.Disposable {
    const ctx = context || ({ subscriptions: [] } as vscode.ExtensionContext);
    const sampleCommand = registerSampleCommand();
    const generatePropsHintsCommand = registerGeneratePropsHintsCommand();
    const settingsCommands = registerPropsHintsSettingsCommands();
    const hoverProvider = registerComponentHoverProvider();

    // 启动后扫描一次
    generatePropsHintsOnce(false);

    // 监听 src 下 .js/.vue 变化，自动重新生成
    const watcher = vscode.workspace.createFileSystemWatcher('**/src/**/*.{js,vue}');
    const onChange = () => {
        generatePropsHintsOnce(false);
    };
    watcher.onDidChange(onChange);
    watcher.onDidCreate(onChange);
    watcher.onDidDelete(onChange);

    ctx.subscriptions.push(sampleCommand, generatePropsHintsCommand, watcher, hoverProvider, ...settingsCommands);
    return sampleCommand;
}

/**
 * 注销扩展。
 *
 * 当扩展被卸载或 VS Code 关闭时调用，可在此清理资源。
 */
export function deactivate() {}
