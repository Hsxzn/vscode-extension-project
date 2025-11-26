// src/types/index.d.ts

declare module 'vscode-extension-project' {
  export interface SampleCommandOptions {
    message: string;
  }

  export interface Logger {
    logInfo(message: string): void;
    logWarning(message: string): void;
    logError(message: string): void;
  }
}