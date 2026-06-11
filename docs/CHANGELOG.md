# 更新日志

## 2026-06-11

- ✅ **测试覆盖率达到 100%** — 200 个测试（168 单元测试 + 32 真实浏览器集成测试），覆盖全部 32 个 lib/ 模块
- ✅ **真实浏览器集成测试** — `test/integration/browser-real.test.js` 验证 browser.js、cdp.js、navigation.js、form.js、picker.js、table.js、dialog.js、bill.js 及 5 个 ledger 模块在真实 FIP 页面上的行为
- ✅ **修复 navigation.js `openSideMenu()`** — 第二次调用时检查抽屉是否已打开，避免重复点击关闭抽屉
- ✅ **修复 form.js `clickShowQuery()`** — 当"显示查询"/"隐藏查询"按钮不可见时，通过检测 `FormDateField` 输入框判定查询面板已展开
- ✅ **修复 audit/reporter.js** — `result.fields?.xxx` / `result.stats?.xxx ?? 0` 可选链防止 undefined 崩溃
- ✅ **修复 unbilled-income.js** — `periodToDateRange(null)` 空值守卫 + 补充导出

## 2026-06-10

- ✅ YJK（预缴计算单）字段提取器开发完成并验收
- ✅ 新增 `doctor` 环境诊断命令（检查 Node.js/依赖/WebBridge/CDP/FIP 登录/GitHub CLI）
- ✅ 修复 YJK 提单日期提取问题（使用 `byLabel` 策略定位日期 input）
- ✅ 修复 `extract-bill` CLI 弹窗未关闭问题（`dialog.js` 策略4新增备选选择器）
- ✅ 修复 `closeBill()` URL 验证误匹配问题（排除 `FLOW_` 前缀）
- ✅ **P0 基础设施**: ESLint v10 + Prettier + GitHub Actions CI + mocha/chai 测试框架（37 个单元测试）
- ✅ **P1 开发体验**: Debug/Verbose 日志模式（`--debug`/`--verbose`/`fip-debug.log`）+ npm 发布准备 + 配置 Schema 验证
- ✅ 生产环境验证通过（22 个待办单据 + 1 个 YJK 已办结单据）

## 2026-06-09

- ✅ 开票单审核模块验收通过（KP 类型）
- ✅ 通用单据提取器验收通过（SLBX/TBX/CFK/CBX）
- ✅ 五个税务台账查询功能恢复并测试通过
