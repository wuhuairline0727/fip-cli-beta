# fip-cli CI 状态报告

**生成时间**: 2026-06-20 07:20 CST  
**检查仓库**: wuhuairline0727/fip-cli (master)

---

## 1. CI 状态检查

### 最新 5 次 GitHub Actions 运行记录

| Run ID | 状态 | 提交信息 | 触发方式 | 耗时 | 时间 |
|--------|------|----------|----------|------|------|
| 27705905401 | ✅ **成功** | fix(cli): switch-org --set 时自动启用 autoSelect 模式 | push | 1m2s | 2026-06-17 17:00 |
| 27705780820 | ❌ **失败** | fix(cli): switch-org --set 时自动启用 autoSelect 模式 | push | 36s | 2026-06-17 16:58 |
| 27705666907 | ❌ **失败** | fix(cli): switch-org --set 时自动启用 autoSelect 模式 | push | 24s | 2026-06-17 16:56 |
| 27704954900 | ✅ **成功** | fix(organization): 添加 .Menu_Item 选择器匹配实际页面结构 | push | 1m0s | 2026-06-17 16:44 |
| 27703888519 | ✅ **成功** | refactor(utils): 拆分 organization.ts 为模块化架构 | push | 1m10s | 2026-06-17 16:26 |

### 失败原因分析

- **Run 27705780820** (失败): `format:check` 未通过
  - `lib/utils/organization/workflow.ts` — Prettier 格式不符
  - `bin/fip-cli.ts` — Prettier 格式不符
  - ESLint 警告: `readDialogFields` 在 `lib/utils/organization/workflow.ts` 中定义但未使用

- **Run 27705666907** (失败): `format:check` 未通过
  - `bin/fip-cli.ts` — Prettier 格式不符

> **结论**: 最新 CI 运行 **已成功**。前两次失败为格式化问题，已在后续提交中修复，无需额外处理。

---

## 2. 本地修复验证

### 本地仓库状态
- 分支: `master`
- 与 `origin/master` 同步: ✅ 是
- 工作区: 干净 (nothing to commit, working tree clean)
- 本地 HEAD: `cddee69` (与远程一致)

### 本地工具链验证

| 检查项 | 结果 | 输出 |
|--------|------|------|
| `npm test` | ✅ 通过 | 194 tests passing (24s) |
| `npm run lint` | ✅ 通过 | 0 errors, 0 warnings |
| `npm run format:check` | ✅ 通过 | All matched files use Prettier code style! |

> **结论**: 本地验证全部通过，无需修复。

---

## 3. 推送状态

- **状态**: 无需推送
- **原因**: 本地仓库已与远程同步，且最新 CI 已通过
- **当前 HEAD**: `cddee69 fix(cli): switch-org --set 时自动启用 autoSelect 模式`

---

## 4. 未关闭 Issue 清单（需人工关注）

以下 issue 与 CI 无直接关联，但属于已知待处理问题：

| # | 标题 | 标签 | 创建时间 |
|---|------|------|----------|
| #51 | [Bug] export-* 与 export-all 命令的 ledger console.log 进度输出污染 stdout，破坏 JSON-only 约定 | bug | 2026-06-19 |
| #50 | [Bug] doctor 命令在 commander action 中直接调用 process.exit(1)，违反标准流程 | bug | 2026-06-18 |
| #49 | [Bug] audit-invoice 与 extract-bill 命令使用 console.log 输出进度，破坏 JSON-only 输出约定 | bug | 2026-06-18 |
| #48 | [Bug] common.ts clickDashboardTab 未对用户输入 escape，存在模板字符串注入风险 | bug | 2026-06-18 |
| #35 | [Defect] 5 个台账文件结构高度重复，维护困难 | bug | 2026-06-14 |

---

## 5. 总结

| 项目 | 状态 |
|------|------|
| CI 状态 | ✅ 最新一次成功 (Run 27705905401) |
| 修复情况 | 无需修复（前两次失败为格式化问题，已自动修复） |
| 推送状态 | 无需推送 |
| 本地验证 | 194 tests passing, 0 lint, 0 format issues |
| 需人工处理 | 5 个 open issue（非 CI 阻塞问题） |

**建议**: 当前 CI 状态良好，无需额外操作。建议关注 #51、#49 等 `console.log` 污染 stdout 的问题，它们可能在某些自动化场景下导致 JSON 输出解析失败。
