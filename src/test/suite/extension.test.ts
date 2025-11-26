/**
 * @file VS Code 扩展集成测试。
 * @description 使用 Mocha 和 VS Code 测试运行器，验证扩展可正常激活并返回可清理的 Disposable。
 */
import * as assert from 'assert';
import { activate } from '../../extension';

suite('Extension Test Suite', () => {
    test('Extension activates and returns disposable', () => {
        const disposable = activate();
        assert.ok(disposable, 'Extension should return a disposable to clean up resources');
        disposable.dispose();
    });
});
