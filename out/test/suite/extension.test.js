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
/**
 * @file VS Code 扩展集成测试。
 * @description 使用 Mocha 和 VS Code 测试运行器，验证示例命令是否已注册且能正常执行。
 */
const assert = __importStar(require("assert"));
const vscode = __importStar(require("vscode"));
const extension_1 = require("../../extension");
suite('Extension Test Suite', () => {
    let disposable;
    setup(async () => {
        disposable = await (0, extension_1.activate)();
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
//# sourceMappingURL=extension.test.js.map