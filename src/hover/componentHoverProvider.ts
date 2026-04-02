import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { parsePropsFromContent } from '../commands/generatePropsHints';

interface HoverPropEntry {
  prop: string;
  type?: string;
  defaultValue?: string;
  description?: string;
  required?: boolean;
}

interface HoverComponentHint {
  component: string;
  name?: string;
  filePath: string;
  line?: number;
  props: HoverPropEntry[];
}

let cachedHints: HoverComponentHint[] | undefined;
let cachedWorkspaceRoot: string | undefined;
let cachedHintsSignature: string | undefined;
let cachedFileHintsRoot: string | undefined;
const componentFileHintCache = new Map<string, HoverComponentHint | null>();

function getWorkspaceRoot(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return undefined;
  }
  const root = folders[0].uri.fsPath;
  if (cachedFileHintsRoot !== root) {
    componentFileHintCache.clear();
    cachedFileHintsRoot = root;
  }
  return root;
}

function loadHintsFromWorkspace(): HoverComponentHint[] | undefined {
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

  let signature: string;
  try {
    const jsonStat = fs.statSync(jsonPath);
    const dtsPath = path.join(root, '.vscode', 'component-props-hints.d.ts');
    let dtsMtime = 0;
    try {
      const dtsStat = fs.statSync(dtsPath);
      dtsMtime = dtsStat.mtimeMs;
    } catch {
      dtsMtime = 0;
    }
    signature = `${jsonStat.mtimeMs}-${dtsMtime}`;
  } catch {
    return undefined;
  }

  if (cachedHints && cachedWorkspaceRoot === root && cachedHintsSignature === signature) {
    return cachedHints;
  }

  try {
    const content = fs.readFileSync(jsonPath, 'utf8');
    const parsed = JSON.parse(content) as HoverComponentHint[];
    cachedHints = parsed;
    cachedWorkspaceRoot = root;
    cachedHintsSignature = signature;
    return parsed;
  } catch {
    return undefined;
  }
}

function normalizePathForCompare(p?: string): string | undefined {
  if (!p) return undefined;
  return p.replace(/\\/g, '/').toLowerCase();
}

function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

export function normalizeComponentNameForCompare(name?: string): string | undefined {
  if (!name) return undefined;
  const trimmed = String(name).trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/[-_\s]/g, '').toLowerCase();
}

function isSameComponentName(left?: string, right?: string): boolean {
  const normalizedLeft = normalizeComponentNameForCompare(left);
  const normalizedRight = normalizeComponentNameForCompare(right);
  return !!normalizedLeft && normalizedLeft === normalizedRight;
}

function buildFileLinkLine(filePath?: string, line?: number): string | undefined {
  if (!filePath) return undefined;
  let absolutePath = filePath;
  const root = getWorkspaceRoot();
  if (!path.isAbsolute(filePath)) {
    if (!root) return undefined;
    absolutePath = path.join(root, filePath);
  }
  const base = vscode.Uri.file(absolutePath).toString();
  const target = line ? `${base}#L${line}` : base;
  const displayPath = filePath.replace(/\\/g, '/');
  return `_文件路径：[${displayPath}](${target})_`;
}

function buildHoverHintFromComponentFile(absolutePath: string): HoverComponentHint | undefined {
  const normalizedAbsolutePath = path.normalize(absolutePath);
  if (componentFileHintCache.has(normalizedAbsolutePath)) {
    return componentFileHintCache.get(normalizedAbsolutePath) ?? undefined;
  }

  try {
    const content = fs.readFileSync(normalizedAbsolutePath, 'utf8');
    const parsed = parsePropsFromContent(normalizedAbsolutePath, content);
    const root = getWorkspaceRoot();
    if (!parsed || !root) {
      componentFileHintCache.set(normalizedAbsolutePath, null);
      return undefined;
    }

    const hint: HoverComponentHint = {
      component: parsed.componentName,
      name: parsed.componentScriptName ?? parsed.componentName,
      filePath: path.relative(root, normalizedAbsolutePath),
      line: parsed.propsLine,
      props: parsed.props.map(prop => ({
        prop: prop.name,
        type: prop.type,
        defaultValue: prop.defaultValue,
        description: prop.description,
        required: prop.required,
      })),
    };

    componentFileHintCache.set(normalizedAbsolutePath, hint);
    return hint;
  } catch {
    componentFileHintCache.set(normalizedAbsolutePath, null);
    return undefined;
  }
}

function resolveGlobalComponentCandidates(componentName: string): string[] {
  const root = getWorkspaceRoot();
  if (!root) return [];

  const kebabName = toKebabCase(componentName);
  const srcRoot = path.join(root, 'src');
  const componentsRoot = path.join(srcRoot, 'components');

  return [
    path.join(componentsRoot, kebabName, 'index.vue'),
    path.join(componentsRoot, kebabName, `${componentName}.vue`),
    path.join(componentsRoot, `${componentName}.vue`),
    path.join(componentsRoot, kebabName + '.vue'),
    path.join(srcRoot, kebabName, 'index.vue'),
    path.join(srcRoot, kebabName + '.vue'),
  ];
}

function resolveHoverHintsForWord(document: vscode.TextDocument, word: string, importMap: Map<string, string>, hints: HoverComponentHint[]): HoverComponentHint[] {
  // console.log('🟡 [resolveHoverHintsForWord] word:', word);
  // console.log('🟡 [resolveHoverHintsForWord] hints总数:', hints.length);
  // console.log('🟡 [resolveHoverHintsForWord] importMap:', Array.from(importMap.entries()));

  let matched = hints.filter(h => isSameComponentName(h.component, word) || isSameComponentName(h.name, word));
  // console.log('🟡 [resolveHoverHintsForWord] hints中匹配到:', matched.length, '个');

  const importedPath = Array.from(importMap.entries()).find(([importName]) => isSameComponentName(importName, word))?.[1];
  // console.log('🟡 [resolveHoverHintsForWord] importedPath:', importedPath);

  if (importedPath) {
    const normalizedTarget = normalizePathForCompare(importedPath);
    // console.log('🟡 [resolveHoverHintsForWord] normalizedTarget:', normalizedTarget);

    const filtered = matched.filter(h => normalizePathForCompare(h.filePath) === normalizedTarget);
    // console.log('🟡 [resolveHoverHintsForWord] 按importedPath过滤后:', filtered.length, '个');

    if (filtered.length > 0) {
      // console.log('🟡 [resolveHoverHintsForWord] ✅ 返回filtered结果');
      return filtered;
    }

    const root = getWorkspaceRoot();
    if (root) {
      const fullPath = path.join(root, importedPath);
      // console.log('🟡 [resolveHoverHintsForWord] 尝试从文件解析:', fullPath);

      const fallbackHint = buildHoverHintFromComponentFile(fullPath);
      if (fallbackHint) {
        // console.log('🟡 [resolveHoverHintsForWord] ✅ 从文件解析成功');
        return [fallbackHint];
      } else {
        // console.log('🟡 [resolveHoverHintsForWord] ❌ 从文件解析失败');
      }
    }
  }

  if (matched.length > 0) {
    // console.log('🟡 [resolveHoverHintsForWord] ✅ 返回hints匹配结果:', matched.length, '个');
    return matched;
  }

  // console.log('🟡 [resolveHoverHintsForWord] 尝试全局组件路径fallback...');
  const candidates = resolveGlobalComponentCandidates(word);
  // console.log('🟡 [resolveHoverHintsForWord] 候选路径:', candidates);

  for (const candidate of candidates) {
    // console.log('🟡 [resolveHoverHintsForWord] 检查:', candidate, 'exists:', fs.existsSync(candidate));
    if (!fs.existsSync(candidate)) continue;

    // console.log('🟡 [resolveHoverHintsForWord] ✅ 文件存在，尝试解析');
    const fallbackHint = buildHoverHintFromComponentFile(candidate);
    if (fallbackHint) {
      // console.log('🟡 [resolveHoverHintsForWord] ✅ 从全局路径解析成功');
      return [fallbackHint];
    }
  }

  // console.log('🟡 [resolveHoverHintsForWord] ❌ 所有尝试都失败，返回空数组');
  return [];
}

function resolveImportTarget(document: vscode.TextDocument, rawImportPath: string): string | undefined {
  const root = getWorkspaceRoot();
  if (!root) return undefined;

  const documentDir = path.dirname(document.uri.fsPath);
  const normalizedRaw = rawImportPath.replace(/\\/g, '/');
  let absolutePath: string;

  if (normalizedRaw.startsWith('.')) {
    absolutePath = path.resolve(documentDir, normalizedRaw);
  } else if (normalizedRaw.startsWith('@/')) {
    absolutePath = path.join(root, 'src', normalizedRaw.slice(2));
  } else if (normalizedRaw.startsWith('/')) {
    absolutePath = path.join(root, normalizedRaw.slice(1));
  } else if (normalizedRaw.startsWith('@')) {
    absolutePath = path.join(root, normalizedRaw.slice(1));
  } else {
    absolutePath = path.join(root, normalizedRaw);
  }

  const candidates: string[] = [];
  if (path.extname(absolutePath)) {
    candidates.push(absolutePath);
  } else {
    ['.vue', '.ts', '.tsx', '.js', '.jsx'].forEach(ext => {
      candidates.push(absolutePath + ext);
    });
  }

  let hit: string | undefined;
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      hit = candidate;
      break;
    }
  }
  const finalAbs = hit ?? candidates[0];
  return finalAbs ? path.relative(root, finalAbs) : undefined;
}

function parseImportClause(clause: string): string[] {
  const result: string[] = [];
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
    const piece = part.trim();
    if (!piece) return;
    const aliasMatch = piece.match(/^([A-Za-z0-9_$]+)(?:\s+as\s+([A-Za-z0-9_$]+))?$/);
    if (aliasMatch) {
      result.push(aliasMatch[2] ?? aliasMatch[1]);
    }
  });

  return result;
}

function buildImportMap(document: vscode.TextDocument): Map<string, string> {
  const importMap = new Map<string, string>();
  const text = document.getText();
  const importRegex = /import\s+([^;]+?)\s+from\s+['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(text)) !== null) {
    const clause = match[1];
    const source = match[2];
    const resolved = resolveImportTarget(document, source);
    if (!resolved) {
      continue;
    }

    const names = parseImportClause(clause);
    for (const name of names) {
      if (!name) continue;
      importMap.set(name, resolved);
    }
  }

  return importMap;
}

function getWordAtOffset(text: string, offset: number): string | undefined {
  if (!text || offset < 0 || offset > text.length) {
    return undefined;
  }

  const isWordChar = (char?: string) => !!char && /[A-Za-z0-9_\-]/.test(char);

  let cursor = offset;
  if (!isWordChar(text[cursor]) && cursor > 0 && isWordChar(text[cursor - 1])) {
    cursor -= 1;
  }

  if (!isWordChar(text[cursor])) {
    return undefined;
  }

  let start = cursor;
  let end = cursor;

  while (start > 0 && isWordChar(text[start - 1])) {
    start -= 1;
  }

  while (end + 1 < text.length && isWordChar(text[end + 1])) {
    end += 1;
  }

  const word = text.slice(start, end + 1).trim();
  return word || undefined;
}

function getWordAtPosition(document: vscode.TextDocument, position: vscode.Position): string | undefined {
  try {
    const range = document.getWordRangeAtPosition(position, /[A-Za-z0-9_\-]+/);
    if (range) {
      const word = document.getText(range);
      if (word) {
        return word;
      }
    }
  } catch {
    // ignore and fallback to manual scan
  }

  try {
    const text = document.getText();
    const offset = document.offsetAt(position);
    return getWordAtOffset(text, offset);
  } catch {
    return undefined;
  }
}

interface VueTagNameMatch {
  tagName: string;
  tagNameStart: number;
  tagNameEnd: number;
}

type VueBlockType = 'template' | 'script' | 'style';

interface VueBlockRange {
  type: VueBlockType;
  contentStart: number;
  contentEnd: number;
}

function getVueBlockRanges(text: string): VueBlockRange[] {
  const ranges: VueBlockRange[] = [];

  // 只匹配顶层的 Vue SFC 块（每种类型只取第一个）
  const blockTypes: VueBlockType[] = ['template', 'script', 'style'];

  for (const blockType of blockTypes) {
    // 匹配开始标签，要求在行首（可能有空格）
    const openTagRegex = new RegExp(`^\\s*<${blockType}\\b[^>]*>`, 'im');
    const openMatch = openTagRegex.exec(text);

    if (!openMatch) {
      continue;
    }

    const contentStart = openMatch.index + openMatch[0].length;

    // 找到所有的关闭标签，取最后一个（因为可能有嵌套的同名标签）
    const closeTagRegex = new RegExp(`^\\s*</${blockType}\\s*>`, 'gim');
    const remainingText = text.slice(contentStart);

    let lastCloseMatch: RegExpExecArray | null = null;
    let match: RegExpExecArray | null;
    while ((match = closeTagRegex.exec(remainingText)) !== null) {
      lastCloseMatch = match;
    }

    if (!lastCloseMatch) {
      continue;
    }

    const contentEnd = contentStart + lastCloseMatch.index;

    ranges.push({
      type: blockType,
      contentStart,
      contentEnd,
    });

    // console.log(`🟢 [getVueBlockRanges] ${blockType}: ${contentStart}-${contentEnd}`);
  }

  // console.log('🟢 [getVueBlockRanges] 总共找到', ranges.length, '个块');
  return ranges;
}

export function getVueBlockTypeAtOffset(text: string, offset: number): VueBlockType | undefined {
  const blocks = getVueBlockRanges(text);
  const matched = blocks.find(block => offset >= block.contentStart && offset <= block.contentEnd);
  // console.log(`🟢 [getVueBlockTypeAtOffset] offset=${offset}, blockType=${matched?.type || 'undefined'}`);
  // if (matched) {
  //   console.log(`🟢 [getVueBlockTypeAtOffset] 匹配的块: ${matched.type}(${matched.contentStart}-${matched.contentEnd})`);
  // }
  return matched?.type;
}

function getVueTagNameMatchAtOffset(text: string, offset: number): VueTagNameMatch | undefined {
  const lastOpenBracket = text.lastIndexOf('<', offset);
  if (lastOpenBracket === -1) {
    return undefined;
  }

  const lastCloseBracket = text.lastIndexOf('>', offset);
  if (lastCloseBracket > lastOpenBracket) {
    return undefined;
  }

  const nextCloseBracket = text.indexOf('>', lastOpenBracket);
  if (nextCloseBracket === -1) {
    return undefined;
  }

  const tagContent = text.slice(lastOpenBracket, nextCloseBracket + 1);
  if (/^<!--/.test(tagContent) || /^<![A-Z]/i.test(tagContent)) {
    return undefined;
  }

  const tagMatch = tagContent.match(/^<\s*\/?\s*([A-Za-z][A-Za-z0-9_-]*)/);
  if (!tagMatch || !tagMatch[1]) {
    return undefined;
  }

  const tagName = tagMatch[1];
  const tagNameStart = lastOpenBracket + tagContent.indexOf(tagName);
  const tagNameEnd = tagNameStart + tagName.length - 1;

  return {
    tagName,
    tagNameStart,
    tagNameEnd,
  };
}

export function isVueTagNameAtOffset(text: string, offset: number, word: string): boolean {
  const tagMatch = getVueTagNameMatchAtOffset(text, offset);
  if (!tagMatch) {
    return false;
  }

  return offset >= tagMatch.tagNameStart
    && offset <= tagMatch.tagNameEnd
    && isSameComponentName(tagMatch.tagName, word);
}

function getComponentHoverWord(document: vscode.TextDocument, position: vscode.Position): string | undefined {
  const text = document.getText();
  const offset = document.offsetAt(position);

  // console.log('\n🔵 [getComponentHoverWord] 开始, languageId:', document.languageId, 'offset:', offset);

  if (document.languageId !== 'vue') {
    const word = getWordAtPosition(document, position);
    // console.log('🔵 [getComponentHoverWord] 非Vue文件, word:', word);
    return word;
  }

  const blockType = getVueBlockTypeAtOffset(text, offset);
  if (blockType !== 'template') {
    // console.log('🔵 [getComponentHoverWord] 不在template块中, blockType:', blockType);
    return undefined;
  }

  const directWord = getWordAtPosition(document, position);
  // console.log('🔵 [getComponentHoverWord] directWord:', directWord);

  if (directWord) {
    const isTagName = isVueTagNameAtOffset(text, offset, directWord);
    // console.log('🔵 [getComponentHoverWord] isTagName:', isTagName);
    if (isTagName) {
      // console.log('🔵 [getComponentHoverWord] ✅ 返回 directWord:', directWord);
      return directWord;
    }
  }

  const tagMatch = getVueTagNameMatchAtOffset(text, offset);
  const result = tagMatch?.tagName;
  // console.log('🔵 [getComponentHoverWord] tagMatch:', tagMatch, '最终返回:', result);
  return result;
}

export function shouldProvideComponentHover(document: vscode.TextDocument, position: vscode.Position, word: string): boolean {
  if (document.languageId !== 'vue') {
    return true;
  }

  const text = document.getText();
  const offset = document.offsetAt(position);
  const blockType = getVueBlockTypeAtOffset(text, offset);

  return blockType === 'template' && isVueTagNameAtOffset(text, offset, word);
}

export function registerComponentHoverProvider(): vscode.Disposable {
  const selector: vscode.DocumentSelector = [
    { language: 'vue', scheme: 'file' },
    { language: 'javascript', scheme: 'file' },
    { language: 'typescript', scheme: 'file' },
  ];

  const provider: vscode.HoverProvider = {
    provideHover(document, position) {
      // console.log('\n🟣 [provideHover] 开始 ========================================');
      const word = getComponentHoverWord(document, position);
      // console.log('🟣 [provideHover] word:', word);
      if (!word) {
        // console.log('🟣 [provideHover] ❌ word为空，退出');
        return undefined;
      }

      const shouldProvide = shouldProvideComponentHover(document, position, word);
      // console.log('🟣 [provideHover] shouldProvide:', shouldProvide);
      if (!shouldProvide) {
        // console.log('🟣 [provideHover] ❌ shouldProvide为false，退出');
        return undefined;
      }

      const importMap = buildImportMap(document);
      // console.log('🟣 [provideHover] importMap:', Array.from(importMap.entries()));

      const hints = loadHintsFromWorkspace() ?? [];
      // console.log('🟣 [provideHover] hints条数:', hints.length);

      const matched = resolveHoverHintsForWord(document, word, importMap, hints);
      // console.log('🟣 [provideHover] matched条数:', matched.length);

      if (matched.length === 0) {
        // console.log('🟣 [provideHover] ❌ 未找到匹配的组件，退出');
        return undefined;
      }

      // console.log('🟣 [provideHover] ✅ 找到匹配组件:', matched.map(m => m.component));


      const mdLines: string[] = [];

      matched.forEach((componentHint, index) => {
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

        const props = componentHint.props ?? [];
        if (props.length === 0) {
          mdLines.push('_该组件未声明 props_');
        } else {
          mdLines.push('| 属性 | 说明 | 类型 | 必传 | 默认值 |');
          mdLines.push('| --- | --- | --- | --- | --- |');

          for (const prop of props) {
            const typeText = prop.type && prop.type.trim().length > 0 ? prop.type : 'any';
            const desc = prop.description ?? '';
            const def = prop.defaultValue ?? '';
            const optional = prop.required ? 'true' : 'false';
            mdLines.push(` | \`${prop.prop}\` | ${desc || '—'} | ${typeText} | ${optional} | ${def || '—'} |`);
          }
        }

        if (index < matched.length - 1) {
          mdLines.push('');
          mdLines.push('---');
          mdLines.push('');
        }
      });

      const md = new vscode.MarkdownString(mdLines.join('\n'));
      md.isTrusted = true;
      return { contents: [md] } as vscode.Hover;
    }
  };

  return vscode.languages.registerHoverProvider(selector, provider);
}
