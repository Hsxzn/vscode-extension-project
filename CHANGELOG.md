# CHANGELOG

## [0.0.3] - 2025-11-26
### Added
- 为 `src/utils/logger.ts` 与 `src/types/vscode.d.ts` 引入 Output Channel 支持，并将运行日志同步输出到 VS Code 的 `Component Props Hints` 面板。
- 在 README.md、development.md 中补充扩展的痛点说明、日志定位方法，并新增 `media/image.png`、`media/image2.png` 示例截图。

### Changed
- 重写 `src/extension.ts` 的激活/注销流程，集中管理所有 Disposables、增加详细日志，并改进文件监听与命令注册；`generatePropsHintsOnce` 现会记录扫描数量与耗时。
- `src/commands/propsHintsSettings.ts` 直接从扩展根目录打开 README，避免依赖工作区结构，同时更新提示文案。
- 测试用例 `src/test/suite/extension.test.ts` 改为校验扩展能返回可释放的 Disposable；构建产物与 `package.json` 同步更新。

### Removed
- 删除示例命令（`src/commands/sampleCommand.ts`）及其贡献点、激活事件和相关测试/产物，使扩展聚焦于 props 提示主功能。

## [0.0.2] - 2025-11-20
### Added
- 修复props 修改之后hover 显示没有更新

## [0.0.1] - 2025-11-20
### Added
- Initial release of the VS Code extension.
- Implemented main entry point in `src/extension.ts`.
- Added sample command in `src/commands/sampleCommand.ts`.
- Created logging utility in `src/utils/logger.ts`.
- Set up testing framework with initial tests in `src/test/suite/extension.test.ts`.
- Defined TypeScript types in `src/types/index.d.ts`.
- Configured `package.json` with necessary metadata and dependencies.
- Established TypeScript configuration in `tsconfig.json`.
- Created README.md for project documentation.
