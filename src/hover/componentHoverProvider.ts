import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

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

function getWorkspaceRoot(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return undefined;
  }
  return folders[0].uri.fsPath;
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

function getWordAtPosition(document: vscode.TextDocument, position: vscode.Position): string | undefined {
  const range = document.getWordRangeAtPosition(position, /[A-Za-z0-9_\-]+/);
  if (!range) return undefined;
  return document.getText(range);
}

export function registerComponentHoverProvider(): vscode.Disposable {
  const selector: vscode.DocumentSelector = [
    { language: 'vue', scheme: 'file' },
    { language: 'javascript', scheme: 'file' },
    { language: 'typescript', scheme: 'file' },
  ];

  const provider: vscode.HoverProvider = {
    provideHover(document, position) {
      const word = getWordAtPosition(document, position);
      if (!word) return undefined;

      const hints = loadHintsFromWorkspace();
      if (!hints || hints.length === 0) return undefined;

      let matched = hints.filter(h => String(h.component).toLocaleLowerCase() === word.toLocaleLowerCase() || String(h.name).toLocaleLowerCase() === word.toLocaleLowerCase());
      if (matched.length === 0) return undefined;

      const importMap = buildImportMap(document);
      const importedPath = importMap.get(word);
      if (importedPath) {
        const normalizedTarget = normalizePathForCompare(importedPath);
        const filtered = matched.filter(h => normalizePathForCompare(h.filePath) === normalizedTarget);
        if (filtered.length > 0) {
          matched = filtered;
        }
      }

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

        mdLines.push('| 属性 | 说明 | 类型 | 必传 | 默认值 |');
        mdLines.push('| --- | --- | --- | --- | --- |')

        for (const prop of componentHint.props) {
          const typeText = prop.type && prop.type.trim().length > 0 ? prop.type : 'any';
          const desc = prop.description ?? '';
          const def = prop.defaultValue ?? '';
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
          mdLines.push('| --- | --- | --- | --- | --- |')
        }
      });

      const md = new vscode.MarkdownString(mdLines.join('\n'));
      md.isTrusted = true;
      return { contents: [md] } as vscode.Hover;
    }
  };

  return vscode.languages.registerHoverProvider(selector, provider);
}
