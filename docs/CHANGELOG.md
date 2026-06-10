---
description: FIP CLI 开发进度时间线，按日期记录功能开发、验收、bug修复
---

# FIP CLI 开发日志

## 2026-06-10

### 新增功能
- **YJK（预缴计算单）字段提取器** ✅ 已验收
  - 文件: `lib/bills/config/yjk.js` — 31 个 input 字段 + 2 个子表配置
  - 引擎增强: `extractor.js` 支持 `byIdPrefix` 策略（GWT ID 后缀不稳定）
  - 引擎增强: 分包发票表头检测（`发票代码`+`发票号码`），防止表格数据混入
  - 后处理: `postProcessYjk` 自动计算附加税费税率
  - 验证单据: YJK20042026061003638（简易计税，跨区域预缴）
  - 验证结果: 全部字段准确，税率计算正确

- **doctor 环境诊断命令** ✅ 已验收
  - 文件: `lib/doctor.js`
  - 检查 6 项环境指标: Node.js 版本、项目依赖、Kimi WebBridge、Chrome CDP、FIP 登录、GitHub CLI
  - 支持 `--json` 参数输出结构化报告
  - 错误时退出码非零，便于脚本集成

### Bug 修复
- **弹窗检测修复** — `lib/utils/dialog.js`
  - 问题: `extract-bill` CLI 执行后弹窗未关闭（审批提醒弹窗残留）
  - 根因: 策略4只查找 `x-tool` 类名，但 GWT 审批提醒弹窗关闭按钮类名为 `FD26IYC-jb-a`
  - 解决: 策略4新增备选选择器 `.FD26IYC-jb-a, [class*="jb-a"]`

- **单据关闭修复** — `lib/utils/bill.js`
  - 问题: `closeBill()` 错误地将 `FLOW_Pending` 当作"已返回首页"
  - 根因: URL 验证条件 `url.includes('FLOW_Pending')` 误匹配
  - 解决: 首页验证改为 `(url.includes('#/dashboard') || url.includes('CSCPortal.jsp')) && !url.includes('FLOW_')`

- **README 系统模块分类修正**
  - KP（建筑施工开票单）从"司库系统"修正为"税务系统"
  - Chrome 浏览器从"可选"提升为"必需"
  - 补充 Chrome 远程调试端口配置说明

### 生产验证
- 22 个待办单据（5 CFK + 2 SLBX + 15 TBX）— 全部成功提取
- 1 个已办结单据 YJK20042026061003638 — 全部字段准确，税率计算正确
- CLI 执行后浏览器状态检查 — URL=`#/dashboard`、1 个标签页、无弹窗 ✅

---

## 2026-06-09

### 新增功能
- **开票单审核模块（KP 类型）** ✅ 已验收
  - 文件: `lib/audit/extractor.js`、`engine.js`、`reporter.js`、`rules.json`
  - 功能: 合同金额核对、累计确权额核对、审批人检查、附件完整性
  - 报告格式: text / json / md
  - 支持 `--keep-open` 保持单据打开

- **通用单据提取器** ✅ 已验收
  - 支持类型: SLBX / TBX / CFK / CBX
  - 文件: `lib/bills/extractor.js` + `config/` 下各类型配置
  - 功能: 自动识别单据类型、提取基础字段、费用明细、预算分配

### 生产验证
- 测试单据: KP20002026060500211
- 字段提取: 完整提取基本信息、金额、合同、开票明细、预缴信息、销方/收票信息
- 审核引擎: 3 项通过，4 项需人工核对
- 附件下载: 5/5 全部成功

---

## 2026-06-08

### 功能恢复
- **五个税务台账查询** 从 experiments 分支恢复并测试通过
  - `export-input-transfer` — 12 条记录 ✅
  - `export-output-invoice` — 17 条记录 ✅
  - `export-passenger-transport` — 20 条记录 ✅
  - `export-vat-prepayment` — 23 条记录 ✅
  - `export-unbilled` — 14 条记录 ✅（2026-06-09 测试）

- **表格数据读取** (`table-data`) 恢复 ✅
- **附件操作** (`list-attachments` / `download-attachments`) 恢复 ✅
- **批量导出** (`export-all`) 恢复 ✅

### 废弃功能
- `explore-dashboard` → 用 `page-info` + `tab` + `rows` 替代
- `switch-tab` → 用 `tab` 替代
- `search-bill` → 用 `open-bill` 替代
- `data-*` 命令 → 用 `export-* --query-only` 替代

---

## 更早阶段

### Phase 1 基础功能
- `login-status`、`page-info`、`navigate`、`tab`、`query`、`rows`
- `config` 配置管理 (`~/.fiprc.json`)
- `menu` / `drawer` 导航操作

### 技术基建
- `lib/browser.js` — WebBridge 客户端封装（端口 10086）
- `lib/utils/cdp.js` — CDP 抽象层（端口 9222，真实鼠标点击）
- `lib/output.js` — JSON 输出标准化 + 自动截图
