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

/**
 * 从 props 配置块中提取 default 字段的完整文本，支持箭头函数和对象/数组字面量。
 * @param bodyPart props 声明中单个属性的文本。
 * @returns default 字段的原始字符串，若不存在则返回 undefined。
 */
const extractDefaultValue = (bodyPart: string): string | undefined => {
    const defaultKeyMatch = bodyPart.match(/default\s*:/);
    if (!defaultKeyMatch || defaultKeyMatch.index === undefined) {
        return undefined;
    }

    let cursor = defaultKeyMatch.index + defaultKeyMatch[0].length;
    const total = bodyPart.length;

    while (cursor < total && /\s/.test(bodyPart[cursor])) {
        cursor++;
    }

    const start = cursor;
    let end = total;
    const stack: string[] = [];
    let inString: string | null = null;
    let prevChar = '';

    for (let i = cursor; i < total; i++) {
        const ch = bodyPart[i];

        if (inString) {
            if (ch === inString && prevChar !== '\\') {
                inString = null;
            }
        } else {
            if (ch === '"' || ch === '\'' || ch === '`') {
                inString = ch;
            } else if (ch === '(' || ch === '{' || ch === '[') {
                stack.push(ch);
            } else if (ch === ')' || ch === '}' || ch === ']') {
                const last = stack[stack.length - 1];
                if (last && ((last === '(' && ch === ')') || (last === '{' && ch === '}') || (last === '[' && ch === ']'))) {
                    stack.pop();
                } else if (stack.length === 0) {
                    end = i;
                    break;
                }
            } else if (ch === ',' && stack.length === 0) {
                end = i;
                break;
            } else if (ch === '\n' && stack.length === 0) {
                const rest = bodyPart.slice(i + 1);
                if (/^\s*[A-Za-z0-9_\-$]+\s*:/.test(rest)) {
                    end = i;
                    break;
                }
            }
        }

        prevChar = ch;
    }

    const raw = bodyPart.slice(start, end).trim();
    return raw || undefined;
};

/**
 * 获取工作区 src 目录下所有 .vue 文件的绝对路径。
 * @returns 匹配到的文件路径数组，若没有匹配则返回空数组。
 */
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
    const allowedExts = new Set(['.vue']);

    const walk = (dir: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (allowedExts.has(path.extname(entry.name).toLowerCase())) {
                results.push(full);
            }
        }
    };

    walk(srcDir);
    return results;
    // return ['d:\\project\\EIS\\eis-ui-1\\src\\components\\pinyin-select\\index.vue']
}

/**
 * 解析单个文件内容，提取 Vue Options API props 描述。
 * @param filePath 文件绝对路径，主要用于日志与最终输出。
 * @param content 文件文本内容。
 * @returns 解析出的组件属性信息；若未声明 props，则返回 props 为空的结果；若解析失败则返回 undefined。
 */
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
        const blockComments: Array<string | undefined> = [];
        let current = '';
        let depth = 0;
        const lines = body.split(/\n/);
        let commentBuffer: string | undefined;
        let inBlockComment = false;

        for (const raw of lines) {
            let line = raw.trim();

            if (inBlockComment) {
                const closeIndex = line.indexOf('*/');
                const contentPart = closeIndex === -1 ? line : line.slice(0, closeIndex);
                const normalized = contentPart.replace(/^\*\s?/, '').trim();
                if (normalized) {
                    commentBuffer = commentBuffer ? `${commentBuffer} ${normalized}` : normalized;
                }
                if (closeIndex !== -1) {
                    inBlockComment = false;
                    line = line.slice(closeIndex + 2).trim();
                } else {
                    continue;
                }
            }

            if (line.startsWith('/**') || line.startsWith('/*')) {
                const inlineClose = line.includes('*/');
                let contentPart = line.replace(/^\/\*\*?/, '');
                if (inlineClose) {
                    const idx = contentPart.indexOf('*/');
                    contentPart = idx === -1 ? contentPart : contentPart.slice(0, idx);
                } else {
                    inBlockComment = true;
                }
                const normalized = contentPart.replace(/^\*\s?/, '').trim();
                if (normalized) {
                    commentBuffer = commentBuffer ? `${commentBuffer} ${normalized}` : normalized;
                }
                if (!inlineClose) {
                    continue;
                }
                line = ''; // 内容已处理
            }

            if (!line) {
                continue;
            }

            // 单独一行注释，作为下一块属性的说明
            const commentMatch = line.match(/^\/\/\s*(.+)$/);
            if (commentMatch && depth === 0 && current === '') {
                commentBuffer = commentBuffer
                    ? commentBuffer + ' ' + commentMatch[1].trim()
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
                blockComments.push(commentBuffer);
                current = '';
                commentBuffer = undefined;
            }
        }
        if (current) {
            blocks.push(current);
            blockComments.push(commentBuffer);
            commentBuffer = undefined;
        }

        blocks.forEach((block, index) => {
            const headerMatch = block.match(/^([A-Za-z0-9_\-$]+)\s*:/);
            if (!headerMatch) {
                return;
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

            const defaultValue = extractDefaultValue(bodyPart);

            let description: string | undefined;
            const descMatch = bodyPart.match(/description\s*:\s*['"]([^'"]+)['"]/);
            if (descMatch) {
                description = descMatch[1];
            } else {
                const comment = blockComments[index];
                if (comment) {
                    description = comment;
                }
            }

            props.push({ name, type, required, description, defaultValue });
        });
    }

    // script setup 或 TS 类型支持可以后续增强，这里先简单处理

    return {
        file: filePath,
        componentName,
        componentScriptName,
        propsLine,
        props,
    };
}

/**
 * 基于组件属性信息生成 d.ts 文件内容。
 * @param list 所有组件的 props 描述集合。
 * @returns 生成的 TypeScript 声明文本。
 */
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

/**
 * 将 props 信息序列化为 JSON，供扩展前端或其它工具消费。
 * @param list 组件属性集合（允许 props 为空，以便 Hover 仍可展示基本信息）。
 * @returns JSON 字符串，包含组件路径、行号及属性详情。
 */
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

const buildComponentsWithoutPropsMessage = (list: ComponentPropsInfo[], root?: string): string | undefined => {
    if (list.length === 0) {
        return undefined;
    }

    const maxItems = 5;
    const normalizePath = (filePath: string): string => {
        const raw = root ? path.relative(root, filePath) || path.basename(filePath) : filePath;
        return raw.split(path.sep).join('/');
    };

    const entries = list.slice(0, maxItems).map(info => {
        const displayName = info.componentScriptName ?? info.componentName;
        const location = normalizePath(info.file);
        return `${displayName} (${location})`;
    });

    let message = '以下组件未声明 props:\n' + entries.join('\n');
    if (list.length > maxItems) {
        message += `\n... 还有 ${list.length - maxItems} 个组件`;
    }

    return message;
};

/**
 * 执行一次 props 提示文件生成流程，并根据需要提示用户结果。
 * @param showMessage 是否通过 VS Code 弹窗提示结果。
 */
export async function generatePropsHintsOnce(showMessage = true): Promise<void> {
    const logger = getLogger();
    const startTime = Date.now();
    logger.info('开始生成 props 提示文件');
    try {
        const files = readWorkspaceSrcFiles();
        logger.info(`扫描 src 目录，发现 ${files.length} 个候选文件`);
        if (files.length === 0) {
            logger.warn('未找到 src 目录或 .vue 文件，跳过生成');
            if (showMessage) {
                vscode.window.showInformationMessage('未在当前工作区找到 src 目录或 .vue 文件');
            }
            return;
        }

        const components: ComponentPropsInfo[] = [];
        const componentsWithoutProps: ComponentPropsInfo[] = [];
        for (const file of files) {
            try {
                const content = fs.readFileSync(file, 'utf8');
                const info = parsePropsFromContent(file, content);
                if (info) {
                    if (info.props.length === 0) {
                        componentsWithoutProps.push(info);
                    } else {
                        components.push(info);
                    }
                }
            } catch (e) {
                logger.error(`读取文件失败: ${file}`, e as Error);
            }
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        const workspaceRoot = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri.fsPath : undefined;
        const hasAnyComponent = components.length + componentsWithoutProps.length > 0;
        if (!hasAnyComponent) {
            logger.warn('文件中未解析到任何组件信息，跳过生成');
            if (showMessage) {
                vscode.window.showInformationMessage('未在任何文件中解析到组件信息');
            }
            return;
        }

        if (!workspaceFolders || workspaceFolders.length === 0) {
            if (showMessage) {
                vscode.window.showInformationMessage('未找到工作区');
            }
            return;
        }
        const root = workspaceRoot!;

        if (components.length === 0) {
            logger.warn('文件中未解析到任何 props');
            if (showMessage) {
                const missingMessage = buildComponentsWithoutPropsMessage(componentsWithoutProps, root);
                const baseMessage = '未在任何文件中解析到 props';
                const finalMessage = missingMessage ? `${baseMessage}\n${missingMessage}` : baseMessage;
                vscode.window.showInformationMessage(finalMessage);
            }
        }
        const outDir = path.join(root, '.vscode');
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }
        const dtsFile = path.join(outDir, 'component-props-hints.d.ts');
        const jsonFile = path.join(outDir, 'component-props-hints.json');
        const dtsContent = buildHintsContent(components);
        const allComponents = componentsWithoutProps.length > 0 ? [...components, ...componentsWithoutProps] : components;
        const jsonContent = buildHintsJson(allComponents);
        fs.writeFileSync(dtsFile, dtsContent, 'utf8');
        fs.writeFileSync(jsonFile, jsonContent, 'utf8');
        logger.info(`写入 ${dtsFile} 与 ${jsonFile}，包含 ${components.length} 个 props 组件，Hover 可展示 ${allComponents.length} 个组件`);
        if (componentsWithoutProps.length > 0) {
            logger.info(`另有 ${componentsWithoutProps.length} 个组件未声明 props`);
        }

        if (showMessage) {
            vscode.window.showInformationMessage(`props 提示文件已生成: ${dtsFile}`);
            if (componentsWithoutProps.length > 0 && components.length > 0) {
                const missingMessage = buildComponentsWithoutPropsMessage(componentsWithoutProps, root);
                if (missingMessage) {
                    vscode.window.showInformationMessage(missingMessage);
                }
            }
        }
        logger.info(`props 提示生成流程完成，耗时 ${Date.now() - startTime}ms`);
    } catch (err) {
        logger.error('生成 props 提示文件失败', err as Error);
        if (showMessage) {
            vscode.window.showErrorMessage('生成 props 提示文件失败，详情见输出面板。');
        }
    }
}

/**
 * 注册 extension.generatePropsHints 命令。
 * @returns VS Code Disposable，用于在扩展停用时清理命令。
 */
export function registerGeneratePropsHintsCommand(): vscode.Disposable {
    const command = vscode.commands.registerCommand('extension.generatePropsHints', async () => {
        await generatePropsHintsOnce(true);
    });
    return command;
}
