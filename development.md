# vscode-extension-project

VS Code 扩展：自动收集工作区 Vue/JavaScript 组件的 `props` 信息，生成类型提示文件并提供悬浮提示。本文档侧重说明各个依赖与脚本的用途，便于开发者快速理解和二次开发。

## 功能概览
- 启动或命令触发时扫描工作区根目录下 `src/**/*.js`、`src/**/*.vue` 文件，解析组件 `props`。
- 自动生成 `.vscode/component-props-hints.d.ts` 与 `.vscode/component-props-hints.json`，用于类型提示与悬浮提示数据源。
- 监听 `src` 目录中 `.js/.vue` 的增删改，自动增量更新提示文件。
- 提供命令面板操作（生成提示文件、打开配置说明、打开生成文件）。
- 对在编辑器中引用的组件提供 `hover` 悬浮提示，展示 `props` 描述、类型、默认值等信息。

## 环境要求
- VS Code 版本 ≥ 1.60.0。
- Node.js 版本建议 ≥ 16（与 `@types/node@16`、`webpack@5`、`ts-loader@9` 等依赖保持一致）。

## 快速开始
1. 克隆仓库并安装依赖：
   ```bash
   git clone https://github.com/Hsxzn/vscode-extension-project.git
   cd vscode-extension-project
   npm install
   ```
2. 编译 TypeScript：`npm run compile`
3. 在 VS Code 中按 `F5`（或运行 “Launch Extension”）进入调试模式，测试扩展行为。

## VS Code 命令
| 命令 ID | 标题 | 说明 |
| --- | --- | --- |
| `extension.generatePropsHints` | collect props:Generate Vue/JS Props Hints | 立即重新扫描并生成提示文件。|
| `extension.openPropsHintsSettings` | collect props:Open Props Hints Settings | 打开内置 Markdown 说明，介绍生成策略。|
| `extension.openPropsHintsFile` | collect props:Open Generated Props Hints File | 打开 `.vscode/component-props-hints.d.ts`。|

## 生成产物
- `.vscode/component-props-hints.d.ts`：导出 `componentPropsHints` 数组，便于在编辑器或其他脚本中引用。
- `.vscode/component-props-hints.json`：悬浮提示数据源，包含 `component`、`filePath`、`line`、`props` 等字段。

## 日志输出
- 所有运行信息会写入 VS Code Output 面板名为 `Component Props Hints` 的通道，并同步打印到调试控制台，方便开发期间排查。

`component-props-hints.d.ts` 示例：
```ts
export interface ComponentPropHint {
  component: string;
  prop: string;
  type?: string;
  required?: boolean;
  description?: string;
  defaultValue?: string;
}

export const componentPropsHints: ComponentPropHint[] = [
  { component: 'MyCard', prop: 'title', type: 'string', required: false, description: '标题文案', defaultValue: '' },
  // ...
];
```

## 依赖与用途
| 依赖 | 类型 | 用途 |
| --- | --- | --- |
| `typescript` | 构建 | 编译扩展源码。|
| `ts-loader`、`webpack`、`webpack-cli` | 构建 | 将 TypeScript 打包为 `out/extension.js`，便于调试与发布。|
| `eslint` | 构建 | 保障代码质量，可在 `npm run lint`（自定义）中使用。|
| `@types/node`, `@types/vscode`, `@types/mocha`, `@types/chai` | 类型定义 | 提供 VS Code/Node/测试框架的类型提示。|
| `mocha`, `chai`, `@vscode/test-electron` | 测试 | 执行 VS Code 扩展测试（`npm test`）。|
| `glob` | 工具 | 可用于匹配文件路径（当前解析流程使用 `fs` + 递归，可按需替换为 `glob`）。|
| `@vscode/vsce` | 发布 | 使用 `npm run package:vsix` 生成 `.vsix` 安装包。|

> 提示：项目目前没有运行时第三方依赖，运行依靠 VS Code API 与 Node.js 内置模块；上表均为开发/构建阶段依赖。

## NPM 脚本
| 脚本 | 说明 |
| --- | --- |
| `npm run compile` | 调用 `tsc -p .` 编译 TypeScript。|
| `npm test` | 编译后运行 `test/runTest.js`，执行 VS Code 集成测试。|
| `npm run package:vsix` | 使用 `vsce` 打包扩展，添加 `--no-git` 以跳过 Git 检查。|
| `npm run vscode:prepublish` | 发布前自动执行 `compile`。|

## 开发调试流程
1. `npm run compile` 生成 `out/extension.js`。
2. 打开 VS Code 调试视图，选择 “Run Extension” 配置启动目标 VS Code 实例。
3. 在测试工作区中准备 `src` 目录及 `.vue/.js` 组件，运行 `Generate Vue/JS Props Hints`，观察 `.vscode` 目录下的文件输出以及 hover 效果。
4. 如需覆盖更多 `props` 格式，可在 `src/commands/generatePropsHints.ts` 内扩展解析逻辑（如 script setup、TypeScript 类型）。

## 测试
- 使用 `npm test`，其流程为：先执行 `npm run compile`，再调用 `@vscode/test-electron` 运行 `test/suite/extension.test.ts`。
- 若需新增测试，请在 `src/test` 中编写逻辑，并在 `test/suite/extension.test.ts` 中引用。

## 发布到 VS Code Marketplace
1. 确保 `package.json` 中的 `publisher`、`version`、`engines.vscode` 等字段正确。
2. 登陆 `vsce`：`npx vsce login <publisher>`。
3. 打包：`npm run package:vsix`。
4. 发布：`npx vsce publish`（需要提前 bump 版本）。

## 常见问题
- **未找到 `src` 目录**：扩展不会生成任何文件，请确保工作区根目录存在 `src`。
- **提示文件未刷新**：确认 `src` 下文件事件是否被监听，或手动运行 `Generate Vue/JS Props Hints`。
- **Hover 无数据**：确保 `.vscode/component-props-hints.json` 存在且解析成功，并在 Output 面板选择 `Component Props Hints` 检查日志。

欢迎通过 Issue/PR 反馈问题或提交改进想法。
