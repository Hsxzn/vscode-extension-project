declare module 'vscode' {
    export interface Disposable { dispose(): void; }
    export interface ExtensionContext { subscriptions: Disposable[]; }

    export namespace workspace {
        const workspaceFolders: readonly WorkspaceFolder[] | undefined;
        function createFileSystemWatcher(globPattern: string): FileSystemWatcher;
        function openTextDocument(options: { content: string; language?: string } | Uri): Thenable<TextDocument>;
    }

    export interface WorkspaceFolder {
        readonly uri: Uri;
    }

    export interface Uri {
        readonly fsPath: string;
        // 为了简单，只声明 file 工厂方法
        // 实际运行时由 VS Code 提供实现
    }

    export namespace Uri {
        function file(path: string): Uri;
    }

    export interface FileSystemWatcher extends Disposable {
        onDidChange(listener: (uri: Uri) => any): void;
        onDidCreate(listener: (uri: Uri) => any): void;
        onDidDelete(listener: (uri: Uri) => any): void;
    }

    export namespace window {
        function showInformationMessage(message: string): void;
        function showErrorMessage(message: string): void;
        function showTextDocument(doc: TextDocument, options?: { preview?: boolean }): Thenable<void>;
    }

    export namespace commands {
        function registerCommand(command: string, callback: (...args: any[]) => any): Disposable;
        function getCommands(filterInternal?: boolean): Thenable<string[]>;
        function executeCommand<T = unknown>(command: string, ...rest: any[]): Thenable<T>;
    }

    export interface Position { line: number; character: number; }

    export interface Range { start: Position; end: Position; }

    export interface TextDocument {
        readonly uri: Uri;
        readonly languageId: string;
        readonly version: number;
        readonly lineCount: number;
        getText(range?: Range): string;
        getWordRangeAtPosition(position: Position, regex?: RegExp): Range | undefined;
    }

    export interface Hover {
        contents: MarkdownString[];
    }

    export interface HoverProvider {
        provideHover(document: TextDocument, position: Position): Hover | Thenable<Hover | undefined> | undefined;
    }

    export type DocumentSelector = { language: string; scheme: string }[];

    export class MarkdownString {
        value: string;
        isTrusted: boolean;
        constructor(value?: string);
    }

    export namespace languages {
        function registerHoverProvider(selector: DocumentSelector, provider: HoverProvider): Disposable;
    }
}
