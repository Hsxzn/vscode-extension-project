import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getLogger } from '../utils/logger';

export interface PropInfo {
    name: string;
    type?: string;
    required?: boolean;
    description?: string;
    defaultValue?: string;
}

export interface ComponentPropsInfo {
    file: string;
    componentName: string;
    componentScriptName?: string;
    propsLine?: number;
    props: PropInfo[];
}

export function readWorkspaceSrcFiles(): string[] {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return [];
    }
    const root = workspaceFolders[0].uri.fsPath;
    const srcDir = path.join(root, 'src');
    if (!fs.existsSync(srcDir)) {
        return [];
    }

    const results: string[] = [];
    const exts = ['.js', '.vue'];

    const walk = (dir: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (exts.includes(path.extname(entry.name))) {
                results.push(full);
            }
        }
    };

    walk(srcDir);
    return results;
}

export function parsePropsFromContent(filePath: string, content: string): ComponentPropsInfo | undefined {
    const logger = getLogger();
    const fileName = path.basename(filePath, path.extname(filePath));
    const componentName = fileName;
    const nameMatch = content.match(/name\s*:\s*['"]([^'"]+)['"]/);
    const componentScriptName = nameMatch ? nameMatch[1] : undefined;

    const props: PropInfo[] = [];
    let propsLine: number | undefined;

    // Vue 2/3 options API: props: { foo: String, bar: { type: Number, required: true } }
    const propsRegex = /props\s*:\s*{/g;
    const propsMatch = propsRegex.exec(content);
    if (propsMatch) {
        propsLine = content.slice(0, propsMatch.index).split(/\r?\n/).length;
        const startBraceIndex = content.indexOf('{', propsMatch.index);
        if (startBraceIndex === -1) {
            logger.warn(`在 ${filePath} 中找到 props 但缺少左大括号`);
            return undefined;
        }

        let depthCounter = 0;
        let endBraceIndex = -1;
        for (let i = startBraceIndex; i < content.length; i++) {
            const ch = content[i];
            if (ch === '{') {
                depthCounter++;
            } else if (ch === '}') {
                depthCounter--;
                if (depthCounter === 0) {
                    endBraceIndex = i;
                    break;
                }
            }
        }

        if (endBraceIndex === -1) {
            logger.warn(`在 ${filePath} 中 props 块未正常闭合`);
            return undefined;
        }

        const body = content.slice(startBraceIndex + 1, endBraceIndex);

        // 先按顶层逗号拆分属性块，避免把 type/default 行当成独立 prop
        const blocks: string[] = [];
        let current = '';
        let depth = 0;
        const lines = body.split(/\n/);
        let pendingComment: string | undefined;

        for (const raw of lines) {
            const line = raw.trim();
            if (!line) {
                continue;
            }

            // 单独一行注释，作为下一块属性的说明
            const commentMatch = line.match(/^\/\/\s*(.+)$/);
            if (commentMatch && depth === 0 && current === '') {
                pendingComment = pendingComment
                    ? pendingComment + ' ' + commentMatch[1].trim()
                    : commentMatch[1].trim();
                continue;
            }

            current += (current ? '\n' : '') + line;

            for (const ch of line) {
                if (ch === '{') depth++;
                else if (ch === '}') depth--;
            }

            // 顶层逗号结束一个属性块。对于最后一个属性后面可能没有逗号的情况，
            // 如果 depth 回到 0 且当前块以 '}' 结束，也认为是一个完整块。
            if (depth === 0 && (/,\s*$/.test(line) || /}\s*$/.test(line))) {
                const cleaned = current.replace(/,\s*$/, '');
                blocks.push(cleaned);
                current = '';
            }
        }
        if (current) {
            blocks.push(current);
        }

        let lastComment: string | undefined = pendingComment;

        for (const block of blocks) {
            const headerMatch = block.match(/^([A-Za-z0-9_\-$]+)\s*:/);
            if (!headerMatch) {
                continue;
            }
            const name = headerMatch[1];
            const bodyPart = block.slice(headerMatch[0].length).trim();

            let type: string | undefined;

            // type: [String, Number]
            const arrayTypeMatch = bodyPart.match(/type\s*:\s*\[([^\]]+)\]/);
            if (arrayTypeMatch) {
                const typeItems = arrayTypeMatch[1]
                    .split(',')
                    .map(t => t.trim())
                    .filter(Boolean)
                    .map(t => t.replace(/[^A-Za-z]/g, ''));
                const mapped = typeItems.map(t => {
                    if (/^String$/i.test(t)) return 'string';
                    if (/^Number$/i.test(t)) return 'number';
                    if (/^Boolean$/i.test(t)) return 'boolean';
                    if (/^Array$/i.test(t)) return 'array';
                    if (/^Object$/i.test(t)) return 'object';
                    return t.toLowerCase();
                });
                type = mapped.join(' | ');
            } else {
                const typeMatch = bodyPart.match(/type\s*:\s*([A-Za-z]+)/);
                if (typeMatch) {
                    const rawType = typeMatch[1];
                    if (/^String$/i.test(rawType)) type = 'string';
                    else if (/^Number$/i.test(rawType)) type = 'number';
                    else if (/^Boolean$/i.test(rawType)) type = 'boolean';
                    else if (/^Array$/i.test(rawType)) type = 'array';
                    else if (/^Object$/i.test(rawType)) type = 'object';
                    else type = rawType.toLowerCase();
                } else {
                    // 简写: foo: String
                    if (/String/.test(bodyPart)) type = 'string';
                    else if (/Number/.test(bodyPart)) type = 'number';
                    else if (/Boolean/.test(bodyPart)) type = 'boolean';
                    else if (/Array/.test(bodyPart)) type = 'array';
                    else if (/Object/.test(bodyPart)) type = 'object';
                }
            }

            const required = /required\s*:\s*true/.test(bodyPart);

            let defaultValue: string | undefined;
            const defaultMatch = bodyPart.match(/default\s*:\s*([^,}]+)/);
            if (defaultMatch) {
                defaultValue = defaultMatch[1].trim();
            }

            let description: string | undefined;
            const descMatch = bodyPart.match(/description\s*:\s*['"]([^'"]+)['"]/);
            if (descMatch) {
                description = descMatch[1];
            } else if (lastComment) {
                description = lastComment;
            }

            props.push({ name, type, required, description, defaultValue });
            lastComment = undefined;
        }
    }

    // script setup 或 TS 类型支持可以后续增强，这里先简单处理

    if (props.length === 0) {
        // logger.info(`No props found in ${filePath}`);
        return undefined;
    }

    return {
        file: filePath,
        componentName,
        componentScriptName,
        propsLine,
        props,
    };
}

export function buildHintsContent(list: ComponentPropsInfo[]): string {
    const serializeOptionalString = (value?: string): string => {
        if (value === undefined || value === null) {
            return 'undefined';
        }
        const escaped = value
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/\r/g, '\\r')
            .replace(/\n/g, '\\n');
        return `'${escaped}'`;
    };

    const lines: string[] = [];
    lines.push('// Auto-generated props hints file.');
    lines.push('// Generated by extension.generatePropsHints');
    lines.push('');
    lines.push('export interface ComponentPropHint {');
    lines.push('  component: string;');
    lines.push('  prop: string;');
    lines.push('  type?: string;');
    lines.push('  required?: boolean;');
    lines.push('  description?: string;');
    lines.push('  defaultValue?: string;');
    lines.push('}');
    lines.push('');
    lines.push('export const componentPropsHints: ComponentPropHint[] = [');

    for (const info of list) {
        for (const p of info.props) {
            const componentLiteral = serializeOptionalString(info.componentName);
            const propLiteral = serializeOptionalString(p.name);
            const typeLiteral = serializeOptionalString(p.type);
            const descriptionLiteral = serializeOptionalString(p.description);
            const defaultLiteral = serializeOptionalString(p.defaultValue);
            const item = `  { component: ${componentLiteral}, prop: ${propLiteral}, type: ${typeLiteral}, required: ${p.required ? 'true' : 'false'}, description: ${descriptionLiteral}, defaultValue: ${defaultLiteral} },`;
            lines.push(item);
        }
    }

    lines.push('];');
    lines.push('');
    return lines.join('\n');
}

export function buildHintsJson(list: ComponentPropsInfo[]): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const root = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri.fsPath : undefined;

    const items = list.map(info => {
        const relativeFile = root ? path.relative(root, info.file) : info.file;
        return {
            component: info.componentName,
            name: info.componentScriptName ?? info.componentName,
            filePath: relativeFile,
            line: info.propsLine,
            props: info.props.map(p => ({
                prop: p.name,
                type: p.type ?? '',
                defaultValue: p.defaultValue ?? '',
                description: p.description,
                required: p.required,
            })),
        };
    });

    return JSON.stringify(items, null, 2);
}

export async function generatePropsHintsOnce(showMessage = true): Promise<void> {
    const logger = getLogger();
    try {
        const files = readWorkspaceSrcFiles();
        if (files.length === 0) {
            if (showMessage) {
                vscode.window.showInformationMessage('未在当前工作区找到 src 目录或 .js/.vue 文件');
            }
            return;
        }

        const components: ComponentPropsInfo[] = [];
        for (const file of files) {
            try {
                const content = fs.readFileSync(file, 'utf8');
                const info = parsePropsFromContent(file, content);
                if (info) {
                    components.push(info);
                }
            } catch (e) {
                logger.error(`读取文件失败: ${file}`, e as Error);
            }
        }

        if (components.length === 0) {
            if (showMessage) {
                vscode.window.showInformationMessage('未在任何文件中解析到 props');
            }
            return;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            if (showMessage) {
                vscode.window.showInformationMessage('未找到工作区');
            }
            return;
        }
        const root = workspaceFolders[0].uri.fsPath;
        const outDir = path.join(root, '.vscode');
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }
        const dtsFile = path.join(outDir, 'component-props-hints.d.ts');
        const jsonFile = path.join(outDir, 'component-props-hints.json');
        const dtsContent = buildHintsContent(components);
        const jsonContent = buildHintsJson(components);
        fs.writeFileSync(dtsFile, dtsContent, 'utf8');
        fs.writeFileSync(jsonFile, jsonContent, 'utf8');

        if (showMessage) {
            vscode.window.showInformationMessage(`props 提示文件已生成: ${dtsFile}`);
        }
    } catch (err) {
        logger.error('生成 props 提示文件失败', err as Error);
        if (showMessage) {
            vscode.window.showErrorMessage('生成 props 提示文件失败，详情见输出面板。');
        }
    }
}

export function registerGeneratePropsHintsCommand(): vscode.Disposable {
    const command = vscode.commands.registerCommand('extension.generatePropsHints', async () => {
        await generatePropsHintsOnce(true);
    });
    return command;
}
