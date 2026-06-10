# 更新日志

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
