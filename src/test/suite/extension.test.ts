/**
 * @file VS Code 扩展集成测试。
 * @description 使用 Mocha 和 VS Code 测试运行器，验证扩展可正常激活并返回可清理的 Disposable。
 */
import * as assert from 'assert';
import { activate } from '../../extension';
import { getVueBlockTypeAtOffset, isVueTagNameAtOffset, normalizeComponentNameForCompare, shouldProvideComponentHover } from '../../hover/componentHoverProvider';

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

    test('Vue closing tag name should also be treated as component name', () => {
        const content = [
            '<template>',
            '  <ProcessViewer></ProcessViewer>',
            '</template>',
        ].join('\n');

        const closingTagOffset = content.lastIndexOf('ProcessViewer') + 1;
        assert.strictEqual(getVueBlockTypeAtOffset(content, closingTagOffset), 'template');
        assert.strictEqual(isVueTagNameAtOffset(content, closingTagOffset, 'ProcessViewer'), true);
    });

    test('Vue multi-line opening tag name should be treated as component name', () => {
        const content = [
            '<template>',
            '  <ProcessViewer',
            '    v-if="visible"',
            '    :xml="payload"',
            '  />',
            '</template>',
        ].join('\n');

        const openingTagOffset = content.indexOf('ProcessViewer') + 1;
        assert.strictEqual(getVueBlockTypeAtOffset(content, openingTagOffset), 'template');
        assert.strictEqual(isVueTagNameAtOffset(content, openingTagOffset, 'ProcessViewer'), true);
    });

    test('Vue tag name hover should still work when word range lookup fails', () => {
        const content = [
            '<template>',
            '  <DialogChangeModel />',
            '</template>',
        ].join('\n');

        const tagOffset = content.indexOf('DialogChangeModel') + 3;
        const document = {
            languageId: 'vue',
            getText: () => content,
            getWordRangeAtPosition: () => undefined,
            offsetAt: () => tagOffset,
        } as any;
        const position = {} as any;

        assert.strictEqual(shouldProvideComponentHover(document, position, 'DialogChangeModel'), true);
    });

    test('Component names should match across PascalCase and kebab-case forms', () => {
        assert.strictEqual(normalizeComponentNameForCompare('DialogChangeModel'), 'dialogchangemodel');
        assert.strictEqual(normalizeComponentNameForCompare('dialog-change-model'), 'dialogchangemodel');
        assert.strictEqual(normalizeComponentNameForCompare('process_viewer'), 'processviewer');
        assert.strictEqual(isVueTagNameAtOffset('<DialogChangeModel />', 2, 'dialog-change-model'), true);
        assert.strictEqual(isVueTagNameAtOffset('<ProcessViewer />', 2, 'process-viewer'), true);
    });

    test('Vue script block should not provide component hover', () => {
        const content = [
            '<template>',
            '  <Type />',
            '</template>',
            '<script setup lang="ts">',
            'const current = Type;',
            '</script>',
        ].join('\n');

        const scriptOffset = content.lastIndexOf('Type') + 1;
        const document = {
            languageId: 'vue',
            getText: () => content,
            offsetAt: () => scriptOffset,
        } as any;
        const position = {} as any;

        assert.strictEqual(getVueBlockTypeAtOffset(content, scriptOffset), 'script');
        assert.strictEqual(shouldProvideComponentHover(document, position, 'Type'), false);
    });
});
