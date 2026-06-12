# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/lang/zh-CN/).

## [Unreleased]

## [1.1.0] - 2026-06-11

### Added
- **TypeScript 全面迁移**：lib/ (40 .ts)、test/ (35 .ts)、bin/ (1 .ts + shim)，启用 `strict: true`
- **类型定义系统**：`lib/types/cdp.d.ts`、`webbridge.d.ts`、`fip.d.ts`（467 行 FipAPI 接口）
- **ESLint + Prettier CI 合规**：安装 @typescript-eslint，更新 flat config
- **组织机构切换自动选择**：支持完整自动选择流程 + 本地缓存机制
- **统一报表生成器**：`report-generator.js` 支持单据汇总表生成
- **GitHub 语言检测**：`.gitattributes` 标记 .d.ts 为 TypeScript
- **开发文档**：DEVELOPMENT.md、CHANGELOG.md、issues/ 目录

### Fixed
- **截图超时**：15s → 30s（实际耗时 ~18s）
- **cdpClick 双重 click 事件**：移除多余 Runtime.evaluate，仅保留 mousePressed + mouseReleased
- **模板字符串注入风险**：`unbilled-income.js` 添加 `escapeJsString()` 转义
- **audit/engine 副作用污染**：移除模块级 RULES 单例缓存
- **export-all 白名单校验**：未知台账类型立即报错
- **saveConfig 原子写入**：tmp + rename 防止配置文件损坏
- **examples 命令输出**：改用 `success()` 输出结构化 JSON
- **12 个 GitHub issues**：#17-#28 全部修复并关闭

### Changed
- CLI 入口改为 `bin/fip-cli.js` (shim) → `bin/fip-cli.ts` (逻辑)
- Node.js 要求从 >=v16 更新为 >=v20
- Commander.js 从 12.1.0 升级至 15.0.0

## [1.0.0] - 2026-05

### Added
- 初始版本发布
- 单据字段提取：SLBX（境内差旅报销单）、TBX（通用报销单）、CFK（对外付款单）、CBX（成本报销单）、YJK（预缴计算单）
- 台账数据导出：未开票收入、进项转出、销项发票、增值税预缴、旅客运输服务
- 开票单智能审核：规则引擎 + 审核提示生成
- Dashboard 自动化操作：登录状态检查、页面导航、单位/税主体选择
- CDP 浏览器自动化：基于 Chrome DevTools Protocol 与 GWT 前端交互
- 192 个单元测试覆盖核心模块

[Unreleased]: https://github.com/wuhuairline0727/fip-cli/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/wuhuairline0727/fip-cli/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/wuhuairline0727/fip-cli/releases/tag/v1.0.0
