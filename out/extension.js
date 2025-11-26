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
exports.deactivate = exports.activate = void 0;
/**
 * @file VS Code 扩展入口文件。
 * @description 负责扩展的激活与注销生命周期，并注册所有命令。
 */
const vscode = __importStar(require("vscode"));
const generatePropsHints_1 = require("./commands/generatePropsHints");
const propsHintsSettings_1 = require("./commands/propsHintsSettings");
const componentHoverProvider_1 = require("./hover/componentHoverProvider");
const logger_1 = require("./utils/logger");
const trackedDisposables = [];
const trackDisposable = (ctx, disposable) => {
    trackedDisposables.push(disposable);
    ctx.subscriptions.push(disposable);
    return disposable;
};
const disposeTrackedDisposables = () => {
    while (trackedDisposables.length) {
        const disposable = trackedDisposables.pop();
        disposable === null || disposable === void 0 ? void 0 : disposable.dispose();
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
function activate(context) {
    const ctx = context || { subscriptions: [] };
    disposeTrackedDisposables();
    const logger = (0, logger_1.getLogger)();
    logger.info('扩展正在激活');
    const generatePropsHintsCommand = trackDisposable(ctx, (0, generatePropsHints_1.registerGeneratePropsHintsCommand)());
    const settingsCommands = (0, propsHintsSettings_1.registerPropsHintsSettingsCommands)().map(cmd => trackDisposable(ctx, cmd));
    const hoverProvider = trackDisposable(ctx, (0, componentHoverProvider_1.registerComponentHoverProvider)());
    logger.info('命令与 Hover Provider 已注册');
    // 启动后扫描一次
    logger.info('启动后执行一次 props 扫描');
    (0, generatePropsHints_1.generatePropsHintsOnce)(false);
    // 监听 src 下 .js/.vue 变化，自动重新生成
    const watcher = trackDisposable(ctx, vscode.workspace.createFileSystemWatcher('**/src/**/*.{js,vue}'));
    logger.info('文件系统监听器已启动 (src/**/*.js, src/**/*.vue)');
    const triggerRegeneration = (reason, uri) => {
        const detail = uri ? `: ${uri.fsPath}` : '';
        logger.info(`检测到 ${reason}${detail}，准备重新生成 props 提示`);
        (0, generatePropsHints_1.generatePropsHintsOnce)(false);
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
    };
}
exports.activate = activate;
/**
 * 注销扩展。
 *
 * 当扩展被卸载或 VS Code 关闭时调用，可在此清理资源。
 */
function deactivate() {
    disposeTrackedDisposables();
    (0, logger_1.disposeLogger)();
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map