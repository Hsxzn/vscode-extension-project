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
exports.registerComponentHoverProvider = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let cachedHints;
let cachedWorkspaceRoot;
let cachedHintsSignature;
function getWorkspaceRoot() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        return undefined;
    }
    return folders[0].uri.fsPath;
}
function loadHintsFromWorkspace() {
    const root = getWorkspaceRoot();
    if (!root) {
        return undefined;
    }
    const jsonPath = path.join(root, '.vscode', 'component-props-hints.json');
    if (!fs.existsSync(jsonPath)) {
        cachedHints = undefined;
        cachedWorkspaceRoot = undefined;
        cachedHintsSignature = undefined;
        return undefined;
    }
    let signature;
    try {
        const jsonStat = fs.statSync(jsonPath);
        const dtsPath = path.join(root, '.vscode', 'component-props-hints.d.ts');
        let dtsMtime = 0;
        try {
            const dtsStat = fs.statSync(dtsPath);
            dtsMtime = dtsStat.mtimeMs;
        }
        catch {
            dtsMtime = 0;
        }
        signature = `${jsonStat.mtimeMs}-${dtsMtime}`;
    }
    catch {
        return undefined;
    }
    if (cachedHints && cachedWorkspaceRoot === root && cachedHintsSignature === signature) {
        return cachedHints;
    }
    try {
        const content = fs.readFileSync(jsonPath, 'utf8');
        const parsed = JSON.parse(content);
        cachedHints = parsed;
        cachedWorkspaceRoot = root;
        cachedHintsSignature = signature;
        return parsed;
    }
    catch {
        return undefined;
    }
}
function normalizePathForCompare(p) {
    if (!p)
        return undefined;
    return p.replace(/\\/g, '/').toLowerCase();
}
function buildFileLinkLine(filePath, line) {
    if (!filePath)
        return undefined;
    let absolutePath = filePath;
    const root = getWorkspaceRoot();
    if (!path.isAbsolute(filePath)) {
        if (!root)
            return undefined;
        absolutePath = path.join(root, filePath);
    }
    const base = vscode.Uri.file(absolutePath).toString();
    const target = line ? `${base}#L${line}` : base;
    const displayPath = filePath.replace(/\\/g, '/');
    return `_文件路径：[${displayPath}](${target})_`;
}
function resolveImportTarget(document, rawImportPath) {
    const root = getWorkspaceRoot();
    if (!root)
        return undefined;
    const documentDir = path.dirname(document.uri.fsPath);
    const normalizedRaw = rawImportPath.replace(/\\/g, '/');
    let absolutePath;
    if (normalizedRaw.startsWith('.')) {
        absolutePath = path.resolve(documentDir, normalizedRaw);
    }
    else if (normalizedRaw.startsWith('@/')) {
        absolutePath = path.join(root, 'src', normalizedRaw.slice(2));
    }
    else if (normalizedRaw.startsWith('/')) {
        absolutePath = path.join(root, normalizedRaw.slice(1));
    }
    else if (normalizedRaw.startsWith('@')) {
        absolutePath = path.join(root, normalizedRaw.slice(1));
    }
    else {
        absolutePath = path.join(root, normalizedRaw);
    }
    const candidates = [];
    if (path.extname(absolutePath)) {
        candidates.push(absolutePath);
    }
    else {
        ['.vue', '.ts', '.tsx', '.js', '.jsx'].forEach(ext => {
            candidates.push(absolutePath + ext);
        });
    }
    let hit;
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            hit = candidate;
            break;
        }
    }
    const finalAbs = hit !== null && hit !== void 0 ? hit : candidates[0];
    return finalAbs ? path.relative(root, finalAbs) : undefined;
}
function parseImportClause(clause) {
    const result = [];
    const trimmed = clause.trim();
    if (!trimmed || trimmed.startsWith('*')) {
        return result;
    }
    const braceStart = trimmed.indexOf('{');
    if (braceStart === -1) {
        const name = trimmed.replace(/,\s*$/, '').trim();
        if (name) {
            result.push(name);
        }
        return result;
    }
    const defaultPart = trimmed.slice(0, braceStart).trim().replace(/,\s*$/, '');
    if (defaultPart) {
        result.push(defaultPart);
    }
    const braceEnd = trimmed.indexOf('}', braceStart);
    if (braceEnd === -1) {
        return result;
    }
    const namedSection = trimmed.slice(braceStart + 1, braceEnd);
    namedSection.split(',').forEach(part => {
        var _a;
        const piece = part.trim();
        if (!piece)
            return;
        const aliasMatch = piece.match(/^([A-Za-z0-9_$]+)(?:\s+as\s+([A-Za-z0-9_$]+))?$/);
        if (aliasMatch) {
            result.push((_a = aliasMatch[2]) !== null && _a !== void 0 ? _a : aliasMatch[1]);
        }
    });
    return result;
}
function buildImportMap(document) {
    const importMap = new Map();
    const text = document.getText();
    const importRegex = /import\s+([^;]+?)\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(text)) !== null) {
        const clause = match[1];
        const source = match[2];
        const resolved = resolveImportTarget(document, source);
        if (!resolved) {
            continue;
        }
        const names = parseImportClause(clause);
        for (const name of names) {
            if (!name)
                continue;
            importMap.set(name, resolved);
        }
    }
    return importMap;
}
function getWordAtPosition(document, position) {
    const range = document.getWordRangeAtPosition(position, /[A-Za-z0-9_\-]+/);
    if (!range)
        return undefined;
    return document.getText(range);
}
function registerComponentHoverProvider() {
    const selector = [
        { language: 'vue', scheme: 'file' },
        { language: 'javascript', scheme: 'file' },
        { language: 'typescript', scheme: 'file' },
    ];
    const provider = {
        provideHover(document, position) {
            const word = getWordAtPosition(document, position);
            if (!word)
                return undefined;
            const hints = loadHintsFromWorkspace();
            if (!hints || hints.length === 0)
                return undefined;
            let matched = hints.filter(h => String(h.component).toLocaleLowerCase() === word.toLocaleLowerCase() || String(h.name).toLocaleLowerCase() === word.toLocaleLowerCase());
            if (matched.length === 0)
                return undefined;
            const importMap = buildImportMap(document);
            const importedPath = importMap.get(word);
            if (importedPath) {
                const normalizedTarget = normalizePathForCompare(importedPath);
                const filtered = matched.filter(h => normalizePathForCompare(h.filePath) === normalizedTarget);
                if (filtered.length > 0) {
                    matched = filtered;
                }
            }
            const mdLines = [];
            matched.forEach((componentHint, index) => {
                var _a, _b;
                const displayName = componentHint.name && componentHint.name !== componentHint.component
                    ? `${componentHint.component} (${componentHint.name})`
                    : componentHint.component;
                mdLines.push(`**${displayName}**`);
                mdLines.push('');
                const fileLink = buildFileLinkLine(componentHint.filePath, componentHint.line);
                if (fileLink) {
                    mdLines.push(fileLink);
                    mdLines.push('');
                }
                mdLines.push('| 属性 | 说明 | 类型 | 必传 | 默认值 |');
                mdLines.push('| --- | --- | --- | --- | --- |');
                for (const prop of componentHint.props) {
                    const typeText = prop.type && prop.type.trim().length > 0 ? prop.type : 'any';
                    const desc = (_a = prop.description) !== null && _a !== void 0 ? _a : '';
                    const def = (_b = prop.defaultValue) !== null && _b !== void 0 ? _b : '';
                    const optional = prop.required ? 'false' : 'true';
                    // mdLines.push(`- \`${prop.prop}\``);
                    // mdLines.push(`  - 说明：${desc || '—'}`);
                    // mdLines.push(`  - type：${typeText}`);
                    // mdLines.push(`  - required：${optional}`);
                    // mdLines.push(`  - default：${def || '—'}`);
                    // | `extension.generatePropsHints` | collect props:Generate Vue / JS Props Hints | 立即重新扫描并生成提示文件。|
                    mdLines.push(` | \`${prop.prop}\` | ${desc || '—'} | ${typeText} | ${optional} | ${def || '—'} |`);
                }
                if (index < matched.length - 1) {
                    // mdLines.push('');
                    // mdLines.push('---');
                    // mdLines.push('');
                    mdLines.push('| --- | --- | --- | --- | --- |');
                }
            });
            const md = new vscode.MarkdownString(mdLines.join('\n'));
            md.isTrusted = true;
            return { contents: [md] };
        }
    };
    return vscode.languages.registerHoverProvider(selector, provider);
}
exports.registerComponentHoverProvider = registerComponentHoverProvider;
//# sourceMappingURL=componentHoverProvider.js.map