# vscode-extension-project

VS Code 扩展：自动收集工作区 Vue/JavaScript 组件的 `props` 信息，生成类型提示文件并提供悬浮提示。本文档侧重说明各个依赖与脚本的用途，便于开发者快速理解和二次开发。

## 功能概览
- 启动或命令触发时扫描工作区根目录下 `src/**/*.js`、`src/**/*.vue` 文件，解析组件 `props`。
- 自动生成 `.vscode/component-props-hints.d.ts` 与 `.vscode/component-props-hints.json`，用于类型提示与悬浮提示数据源。
- 监听 `src` 目录中 `.js/.vue` 的增删改，自动增量更新提示文件。
- 提供命令面板操作（生成提示文件、打开配置说明、打开生成文件）。
- 对在编辑器中引用的组件提供 `hover` 悬浮提示，展示 `props` 描述、类型、默认值等信息。

## VS Code 命令
| 命令 ID | 标题 | 说明 |
| --- | --- | --- |
| `extension.generatePropsHints` | collect props:Generate Vue/JS Props Hints | 立即重新扫描并生成提示文件。|
| `extension.openPropsHintsSettings` | collect props:Open Props Hints Settings | 打开内置 Markdown 说明，介绍生成策略。|
| `extension.openPropsHintsFile` | collect props:Open Generated Props Hints File | 打开 `.vscode/component-props-hints.d.ts`。|
| `extension.sampleCommand` | collect props:Sample Command | 用于扩展脚手架示例，可按需替换。|

## 生成产物
- `.vscode/component-props-hints.d.ts`：导出 `componentPropsHints` 数组，便于在编辑器或其他脚本中引用。
- `.vscode/component-props-hints.json`：悬浮提示数据源，包含 `component`、`filePath`、`line`、`props` 等字段。

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
## 项目中 .gitignore 配置忽略
```
*.vscode/component-props-hints.*
```



## 常见问题
- **未找到 `src` 目录**：扩展不会生成任何文件，请确保工作区根目录存在 `src`。
- **提示文件未刷新**：确认 `src` 下文件事件是否被监听，或手动运行 `Generate Vue/JS Props Hints`。
- **Hover 无数据**：确保 `.vscode/component-props-hints.json` 存在且解析成功，必要时在输出面板查看日志（`getLogger()` 会打印错误信息）。

## 贡献
欢迎提交问题和拉取请求！请确保遵循项目的贡献指南。

## 许可证
本项目遵循 MIT 许可证。有关详细信息，请参阅 LICENSE 文件。

欢迎通过 Issue/PR 反馈问题或提交改进想法。
