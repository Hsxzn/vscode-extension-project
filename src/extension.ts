/**
 * @file VS Code 扩展入口文件。
 * @description 负责扩展的激活与注销生命周期，并注册所有命令。
 */
import * as vscode from 'vscode';
import { registerGeneratePropsHintsCommand, generatePropsHintsOnce } from './commands/generatePropsHints';
import { registerPropsHintsSettingsCommands } from './commands/propsHintsSettings';
import { registerComponentHoverProvider } from './hover/componentHoverProvider';
import { disposeLogger, getLogger } from './utils/logger';

const trackedDisposables: vscode.Disposable[] = [];

const trackDisposable = <T extends vscode.Disposable>(ctx: vscode.ExtensionContext, disposable: T): T => {
    trackedDisposables.push(disposable);
    ctx.subscriptions.push(disposable);
    return disposable;
};

const disposeTrackedDisposables = () => {
    while (trackedDisposables.length) {
        const disposable = trackedDisposables.pop();
        disposable?.dispose();
    }
};

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
    disposeTrackedDisposables();
    const logger = getLogger();
    logger.info('扩展正在激活');
    const generatePropsHintsCommand = trackDisposable(ctx, registerGeneratePropsHintsCommand());
    const settingsCommands = registerPropsHintsSettingsCommands().map(cmd => trackDisposable(ctx, cmd));
    const hoverProvider = trackDisposable(ctx, registerComponentHoverProvider());
    logger.info('命令与 Hover Provider 已注册');

    // 启动后扫描一次
    logger.info('启动后执行一次 props 扫描');
    generatePropsHintsOnce(false);

    // 监听 src 下 .js/.vue 变化，自动重新生成
    const watcher = trackDisposable(ctx, vscode.workspace.createFileSystemWatcher('**/src/**/*.{js,vue}'));
    logger.info('文件系统监听器已启动 (src/**/*.js, src/**/*.vue)');
    const triggerRegeneration = (reason: string, uri?: vscode.Uri) => {
        const detail = uri ? `: ${uri.fsPath}` : '';
        logger.info(`检测到 ${reason}${detail}，准备重新生成 props 提示`);
        generatePropsHintsOnce(false);
    };
    watcher.onDidChange(uri => triggerRegeneration('文件修改', uri));
    watcher.onDidCreate(uri => triggerRegeneration('文件新增', uri));
    watcher.onDidDelete(uri => triggerRegeneration('文件删除', uri));

    logger.info('扩展激活完成');
    return {
        dispose: () => {
            logger.info('开始释放扩展资源');
            deactivate();
        },
    } as vscode.Disposable;
}

/**
 * 注销扩展。
 *
 * 当扩展被卸载或 VS Code 关闭时调用，可在此清理资源。
 */
export function deactivate() {
    disposeTrackedDisposables();
    disposeLogger();
}
