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
exports.disposeLogger = exports.getLogger = void 0;
const vscode = __importStar(require("vscode"));
let outputChannel;
let loggerInstance;
const ensureChannel = () => {
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel('Component Props Hints');
    }
    return outputChannel;
};
const formatMessage = (level, message) => {
    return `[${level}] ${new Date().toISOString()} ${message}`;
};
function getLogger() {
    if (loggerInstance) {
        return loggerInstance;
    }
    const channel = ensureChannel();
    const write = (level, message, err) => {
        var _a;
        const formatted = formatMessage(level, message);
        if (level === 'WARN') {
            console.warn(formatted);
        }
        else if (level === 'ERROR') {
            err ? console.error(formatted, err) : console.error(formatted);
        }
        else {
            console.log(formatted);
        }
        channel.appendLine(err ? `${formatted} ${(_a = err.stack) !== null && _a !== void 0 ? _a : err.message}` : formatted);
    };
    loggerInstance = {
        info(message) {
            write('INFO', message);
        },
        warn(message) {
            write('WARN', message);
        },
        error(message, err) {
            write('ERROR', message, err);
        },
    };
    return loggerInstance;
}
exports.getLogger = getLogger;
function disposeLogger() {
    loggerInstance = undefined;
    outputChannel === null || outputChannel === void 0 ? void 0 : outputChannel.dispose();
    outputChannel = undefined;
}
exports.disposeLogger = disposeLogger;
//# sourceMappingURL=logger.js.map