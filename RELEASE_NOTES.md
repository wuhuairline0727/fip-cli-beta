# 发布说明 (v1.1.0-beta.1)

## 状态
**Pre-release** — 测试版本，功能可能随时调整。

## 修复内容

本次版本累计修复 **50+** 个 issue，覆盖安全性、字段提取、输出规范和代码质量等方面。

### 安全与注入防护
- **#30** 5 个 ledger 文件 26 处模板字符串注入，用 `escapeJsString` 防护
- **#42** `navigation.ts` 和 `cdp.ts` 用户输入未 escape 直接拼入 JS 字符串
- **#43** `picker.ts` `queryCode`/`taxCode` 未 escape
- **#48** `clickDashboardTab` 未对用户输入 escape
- **#57** `bill.ts` `billId` 未 escape 直接拼入 JS 字符串

### 输出规范与日志
- **#34** `examples` 命令使用 `console.log` 而非 stderr
- **#37** `logger.ts` 混用 `console.error` 与 `console.log`
- **#39** `--version` 输出硬编码 `1.0.0`，改为动态读取 `package.json`
- **#44** `examples` 命令 `process.exit(0)` 违反 commander 标准流程
- **#49** `audit-invoice`/`extract-bill` 的 `console.log` 污染 stdout
- **#51** `export-*` 与 `export-all` 的 `console.log` 污染 stdout
- **#52** `cdpEvaluateAndClick` 的 `log` 参数通过 `console.log` 输出到 stdout
- **#53** `parseAsync catch` 中不可达的 `process.exit(1)`
- **#54** `pickFromDict` 使用 `indexOf` 模糊匹配
- **#55** `bill.ts` 13 处 `console.log` 污染 stdout
- **#56** `dialog.ts` 2 处 `console.log` 污染 stdout

### 字段提取修复
- **#31** `saveConfig` 无原子性保护，改为 `tmpFile + renameSync`
- **#32** `export-all` 无白名单校验，添加循环前严格校验
- **#33** `audit/engine` `RULES` 单例副作用污染，暴露 `resetRules()`
- **#52-54** `budget_category` 修正和 `total_amount` 统一字段

### 代码结构与质量
- **#36** `organization.ts` 1196 行拆分为模块化架构
- **#40** `npm audit` 修复 `esbuild`/`ws` 高危漏洞 + `diff` 升级
- **#41** `clickDrawerItem` fallback 从 `indexOf` 改为精确匹配
- 移除仓库内硬编码本地路径（`C:/Users/40427/`、`D:/claude/fip-cli/`）
- 清理无用文件：`CODE_OF_CONDUCT.md`、`SECURITY.md`、`check-*.js`、`fip-cli-ci-status.md`

### 文档
- **#58** `examples` 命令示例税号与默认值不一致

## 验证状态

- **测试**: 194 个单元测试全部通过
- **lint**: 0 errors, 0 warnings
- **format**: Prettier 检查通过
- **audit**: 0 vulnerabilities
- **CI**: GitHub Actions 通过

## 已知限制

- 当前为 **Beta** 版本，API 可能随时调整
- `fip-cli` 仅限 Windows 运行（Kimi WebBridge 路径硬编码）
- macOS 兼容性待验证（代码逻辑跨平台，但路径和 Chrome 启动提示为 Windows 硬编码）
- 仅支持 5 种单据类型：SLBX / TBX / CFK / CBX / YJK

## 安装

```bash
npm install -g @wuhuairline0727/fip-cli
```

或使用 npx：
```bash
npx @wuhuairline0727/fip-cli --version
```

## 反馈

发现问题请提交 [GitHub Issue](https://github.com/wuhuairline0727/fip-cli/issues)。
