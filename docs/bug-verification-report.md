# 🐛 Bug 验证报告

**验证时间**: 2026-06-11 22:30 (Asia/Shanghai)
**验证方式**: 静态代码审查 + 实际运行验证
**验证人**: Agent (systematic-debugging)

---

## 验证方法

对每个 debug 报告中的问题：
1. 读取相关源代码确认问题存在
2. 运行实际命令验证行为
3. 判断是否为真实 Bug（影响功能/正确性）

---

## P0 问题验证结果

| # | 问题 | 验证方法 | 结果 | 是否 Bug |
|---|:---|:---|:---|:---:|
| 1.1 | `config.get()` 启动时冻结 | 读取 `bin/fip-cli.js:474` `const cfg = config.get()`，确认所有 option 默认值在模块加载时冻结 | **确认存在**。用户 `config set` 后必须重启 CLI 新默认值才生效 | ✅ |
| 1.2 | `error()` throw 后被吞掉 | 运行 `fip-cli tab 不存在的标签页` (EXIT_CODE=1) 和 `fip-cli export-all --ledgers foo` (EXIT_CODE=0) | **部分确认**。`tab` 等简单命令因 unhandled rejection 返回 1，但 `export-all` 等命令将错误封装在 JSON 中返回 0，**行为不一致** | ✅ |
| 1.3 | `new Promise(async executor)` | 读取 `lib/browser.js:84` | **确认存在**。`return new Promise(async (resolve, reject) => {...})`，ESLint `no-async-promise-executor` 规则被关闭绕过 | ✅ |
| 1.4 | `DEFAULTS` 模块加载时计算 `lastMonth` | 读取 `lib/config.js:25` | 确认存在，但 CLI 是短进程，跨月影响极小 | ❌ |
| 1.5 | `taxCode` 默认值不一致 | `config.js` DEFAULTS 为 `91110000101107173B`，`pick-tax-subject` 帮助文字第一个示例为 `91110000101638302P` | 确认存在，但用户 `~/.fiprc.json` 已覆盖，影响仅新用户 | ⚠️ |
| 1.6 | 菜单匹配用 `indexOf` | 读取 `lib/utils/navigation.js:20` | **确认存在**。`indexOf('${menuName}') !== -1` 会误命中相似菜单名（如"税务系统"匹配"税务系统管理员"） | ✅ |

## P1 问题验证结果

| # | 问题 | 验证方法 | 结果 | 是否 Bug |
|---|:---|:---|:---|:---:|
| 2.1 | 模板字符串注入 | 读取 `lib/ledgers/unbilled-income.js:149` | 确认存在，但 `voidStatus` 输入为中文枚举（未作废/已作废），实际注入风险极低 | ❌ |
| 2.2 | `examples` 命令用 `console.log` | 读取 `bin/fip-cli.js:685` | 确认存在，风格不一致但功能正常 | ❌ |
| 2.3 | 文档/测试数不一致 | 运行 `npm test` → 192 passing | 确认：文档写 200，实际 192 | ⚠️ |
| 2.4 | 46 个 `no-unused-vars` | 运行 `eslint` → 46 warnings | 确认存在，死代码/未使用变量 | ❌ |
| 2.5 | 5 个 ledger 文件重复 | 读取 `input-transfer.js`(450行) / `output-invoice.js`(351行) | 确认：大量重复 import 和 CDP 点击逻辑 | ❌ |
| 2.6 | `organization.js` 1030 行 | 读取文件 | 确认存在 | ❌ |
| 2.7 | `cdp.js` 双重 click | 读取 `lib/utils/cdp.js:39-49` | 确认：`mousePressed+Released` 后又注入 `dispatchEvent('click')` | ❌ |

---

## 结论

**真正的 Bug（4 个）**：

1. **P0-1.1** `config.get()` 启动时冻结默认值 — 影响配置热更新
2. **P0-1.2** `export-all` 等命令错误时返回退出码 0 — 影响 CI/脚本判断
3. **P0-1.3** `browser.js` 使用 `new Promise(async executor)` — 潜在异常吞没
4. **P0-1.6** `navigation.js` 菜单匹配使用模糊 `indexOf` — 可能误操作相似菜单

**设计缺陷/低优先级（2 个）**：
- P0-1.4 `DEFAULTS` 模块加载时计算 `lastMonth` — CLI 短进程，实际影响极小
- P0-1.5 `taxCode` 默认值与帮助文字不一致 — 影响新用户，但用户有配置覆盖

**非 Bug（7 个）**：
- P1-2.1 ~ P1-2.7 均为代码风格、重构建议、文档不一致，不影响功能

---

## 建议

- **立即修复**：4 个真正 Bug
- **文档更新**：修正测试数量（192 vs 200）
- **代码清理**：46 个 lint warnings 可在一个 PR 中清理
- **重构规划**：ledger 重复代码、organization.js 拆分可排入后续迭代
