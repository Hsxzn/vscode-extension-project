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
exports.registerSampleCommand = void 0;
/**
 * @file 示例命令的注册文件。
 * @description 提供工具函数，用于注册 `extension.sampleCommand` 命令并定义其执行逻辑。
 */
const vscode = __importStar(require("vscode"));
/**
 * 在 VS Code 中注册 `extension.sampleCommand` 命令。
 *
 * 命令执行时会返回一个固定字符串，测试用例通过该返回值校验执行是否成功。
 *
 * @returns 可用于取消注册该命令的 Disposable 对象。
 */
function registerSampleCommand() {
    const disposable = vscode.commands.registerCommand('extension.sampleCommand', async () => {
        return 'Expected Result';
    });
    return disposable;
}
exports.registerSampleCommand = registerSampleCommand;
//# sourceMappingURL=sampleCommand.js.map