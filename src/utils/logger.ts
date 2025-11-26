import * as vscode from 'vscode';

export interface Logger {
    info(message: string): void;
    warn(message: string): void;
    error(message: string, err?: Error): void;
}

let outputChannel: vscode.OutputChannel | undefined;
let loggerInstance: Logger | undefined;

const ensureChannel = (): vscode.OutputChannel => {
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel('Component Props Hints');
    }
    return outputChannel;
};

const formatMessage = (level: 'INFO' | 'WARN' | 'ERROR', message: string): string => {
    return `[${level}] ${new Date().toLocaleString()} ${message}`;
};

export function getLogger(): Logger {
    if (loggerInstance) {
        return loggerInstance;
    }

    const channel = ensureChannel();
    const write = (level: 'INFO' | 'WARN' | 'ERROR', message: string, err?: Error) => {
        const formatted = formatMessage(level, message);
        if (level === 'WARN') {
            console.warn(formatted);
        } else if (level === 'ERROR') {
            err ? console.error(formatted, err) : console.error(formatted);
        } else {
            console.log(formatted);
        }

        channel.appendLine(err ? `${formatted} ${err.stack ?? err.message}` : formatted);
    };

    loggerInstance = {
        info(message: string) {
            write('INFO', message);
        },
        warn(message: string) {
            write('WARN', message);
        },
        error(message: string, err?: Error) {
            write('ERROR', message, err);
        },
    };

    return loggerInstance;
}

export function disposeLogger(): void {
    loggerInstance = undefined;
    outputChannel?.dispose();
    outputChannel = undefined;
}
