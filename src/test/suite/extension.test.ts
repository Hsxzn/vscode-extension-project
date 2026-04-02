/**
 * @file VS Code 扩展集成测试。
 * @description 使用 Mocha 和 VS Code 测试运行器，验证扩展可正常激活并返回可清理的 Disposable。
 */
import * as assert from 'assert';
import { activate } from '../../extension';
import { getVueBlockTypeAtOffset, isVueTagNameAtOffset } from '../../hover/componentHoverProvider';

suite('Extension Test Suite', () => {
    test('Extension activates and returns disposable', () => {
        const disposable = activate();
        assert.ok(disposable, 'Extension should return a disposable to clean up resources');
        disposable.dispose();
    });

    test('Vue template hover only matches component tag names', () => {
        const content = [
            '<template>',
            '  <Type foo="bar" />',
            '</template>',
        ].join('\n');

        const tagOffset = content.indexOf('Type') + 1;
        const attrOffset = content.indexOf('foo') + 1;

        assert.strictEqual(getVueBlockTypeAtOffset(content, tagOffset), 'template');
        assert.strictEqual(isVueTagNameAtOffset(content, tagOffset, 'Type'), true);
        assert.strictEqual(isVueTagNameAtOffset(content, attrOffset, 'foo'), false);
    });

    test('Vue template attributes should not be treated as component names', () => {
        const content = [
            '<template>',
            '  <DingDialog',
            '    type="task"',
            '    @close="handleClose"',
            '  />',
            '</template>',
        ].join('\n');

        const attrOffset = content.indexOf('type="task"') + 1;
        assert.strictEqual(getVueBlockTypeAtOffset(content, attrOffset), 'template');
        assert.strictEqual(isVueTagNameAtOffset(content, attrOffset, 'type'), false);
    });

    test('Vue script block remains eligible for component hover matching', () => {
        const content = [
            '<template>',
            '  <Type />',
            '</template>',
            '<script setup lang="ts">',
            'const current = Type;',
            '</script>',
        ].join('\n');

        const scriptOffset = content.lastIndexOf('Type') + 1;
        assert.strictEqual(getVueBlockTypeAtOffset(content, scriptOffset), 'script');
    });
});
