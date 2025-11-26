/**
 * @file VS Code 扩展集成测试。
 * @description 使用 Mocha 和 VS Code 测试运行器，验证示例命令是否已注册且能正常执行。
 */
import * as assert from 'assert';
import * as vscode from 'vscode';
import { activate } from '../../extension';

suite('Extension Test Suite', () => {
    let disposable: vscode.Disposable;

    setup(async () => {
        disposable = await activate();
    });

    teardown(() => {
        disposable.dispose();
    });

    test('Sample command should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('extension.sampleCommand'), 'Sample command is not registered');
    });

    test('Sample command should execute successfully', async () => {
        const result = await vscode.commands.executeCommand('extension.sampleCommand');
        assert.strictEqual(result, 'Expected Result', 'Sample command did not return expected result');
    });
});
