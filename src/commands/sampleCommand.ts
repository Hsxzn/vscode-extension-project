/**
 * @file 示例命令的注册文件。
 * @description 提供工具函数，用于注册 `extension.sampleCommand` 命令并定义其执行逻辑。
 */
import * as vscode from 'vscode';

/**
 * 在 VS Code 中注册 `extension.sampleCommand` 命令。
 *
 * 命令执行时会返回一个固定字符串，测试用例通过该返回值校验执行是否成功。
 *
 * @returns 可用于取消注册该命令的 Disposable 对象。
 */
export function registerSampleCommand(): vscode.Disposable {
    const disposable = vscode.commands.registerCommand('extension.sampleCommand', async () => {
        return 'Expected Result';
    });
    return disposable;
}
