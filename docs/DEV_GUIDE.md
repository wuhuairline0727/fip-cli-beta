---
description: FIP CLI 开发速查手册 — 目录结构、配置key、CLI命令、已知限制、修复记录
---

# FIP CLI 开发速查手册 (Beta)

> ⚠️ **测试版本声明** — 本项目目前处于 **Beta / 测试阶段**，内部结构、配置项、命令及接口可能随时调整。

```
fip-cli/
├── bin/
│   └── fip-cli.ts              # CLI 命令入口（45+ 个命令）
├── lib/
│   ├── browser.ts                # WebBridge 客户端封装（端口 10086）
│   ├── fip.ts                    # 主入口（聚合导出所有功能）
│   ├── output.ts                 # 输出格式化 + 自动截图
│   ├── config.ts                 # ~/.fiprc.json 配置管理
│   ├── doctor.ts                 # 环境诊断模块（2026-06-10新增）
│   ├── audit/                    # 税务系统 - 开票单审核（KP）
│   │   ├── extractor.ts          # 开票单字段提取器
│   │   ├── engine.ts             # 审核引擎
│   │   ├── reporter.ts           # 报告生成器（text/json/md）
│   │   └── rules.json            # 审核规则配置
│   ├── bills/                    # 报账系统 + 税务系统 - 通用单据提取
│   │   ├── extractor.ts          # 通用提取引擎（支持 byIdPrefix 策略）
│   │   ├── audit-hints.ts        # 审核提示生成器
│   │   └── config/
│   │       ├── index.ts          # 配置注册表（类型识别）
│   │       ├── common.ts         # 通用字段 + 过滤配置
│   │       ├── domestic-travel.ts # SLBX 配置（境内差旅报销单）
│   │       ├── general-expense.ts # TBX 配置（通用报销单）
│   │       ├── external-payment.ts # CFK 配置（对外成本费用付款申请）
│   │       ├── travel-expense.ts  # CBX 配置（差旅费报销）
│   │       └── yjk.ts            # YJK 配置（预缴计算单，税务模块）
│   ├── ledgers/                  # 税务系统 - 台账查询
│   │   ├── unbilled-income.ts    # 未开票收入台账
│   │   ├── input-transfer.ts     # 进项转出明细台账
│   │   ├── output-invoice.ts     # 销项发票明细台账
│   │   ├── vat-prepayment.ts     # 增值税预缴款台账
│   │   └── passenger-transport.ts # 旅客运输服务台账
│   └── utils/                    # 通用工具
│       ├── index.ts              # utils 聚合导出
│       ├── cdp.ts                # CDP 抽象层（真实点击，端口 9222）
│       ├── common.ts             # 通用 DOM 操作
│       ├── dialog.ts             # 弹窗检测与自动关闭
│       ├── form.ts               # 表单操作
│       ├── picker.ts             # Picker 弹窗操作
│       ├── navigation.ts         # 导航操作
│       ├── bill.ts               # 单据操作（openBill/closeBill）
│       ├── table.ts              # 表格数据读取
│       └── attachment.ts         # 附件列表/下载
├── docs/
│   ├── CHANGELOG.md              # 开发进度时间线
│   ├── DEV_GUIDE.md              # 本文件
│   └── ARCHITECTURE.md           # 架构与系统模块归属
├── package.json
├── package-lock.json
└── README.md
```

## 常用 CLI 命令速查

### 状态检查

```bash
fip-cli login-status
fip-cli page-info
fip-cli doctor                          # 环境诊断
fip-cli doctor --json                   # JSON格式输出
```

### Dashboard 操作

```bash
fip-cli tab "已办结"
fip-cli tab "待办"
fip-cli tab "已办"
fip-cli tab "我的单据"
fip-cli query
fip-cli rows
fip-cli table-data --max-rows 50
```

### 单据操作

```bash
fip-cli open-bill <单据编号>
fip-cli close-bill
fip-cli extract-bill <单据编号>
fip-cli extract-bill <单据编号> --output result.json
fip-cli extract-bill <单据编号> --type TBX
fip-cli list-attachments
fip-cli download-attachments --dir ./downloads
```

### 台账查询

```bash
fip-cli export-input-transfer --start-period 2026-04 --end-period 2026-04 --query-only
fip-cli export-output-invoice --start-date 2026-04-01 --end-date 2026-04-30 --query-only
fip-cli export-vat-prepayment --start-period 2026-04 --doc-type "预缴计算单" --query-only
fip-cli export-passenger-transport --start-period 2026-04 --end-period 2026-04 --query-only
fip-cli export-unbilled --start-period 2026-04 --query-only
fip-cli export-all --ledgers input-transfer,output-invoice --query-only
```

### 开票单审核

```bash
fip-cli extract-invoice <单据编号>
fip-cli audit-invoice <单据编号>
fip-cli audit-invoice <单据编号> --keep-open
```

## 配置 Key

```bash
fip-cli config companyCode   1000200020040011
fip-cli config taxCode       91110000101638302P
fip-cli config startDate     2026-04-01
fip-cli config endDate       2026-04-30
fip-cli config startPeriod   2026-04
fip-cli config endPeriod     2026-04
fip-cli config docStatus     流程结束
fip-cli config voidStatus    未作废
fip-cli config docType       预缴计算单
fip-cli config sellerCode    91110000101638302P
```

## 导航路径

```
税务系统 → 税务台账 → 未开票收入台账
税务系统 → 税务台账 → 进项转出台账
税务系统 → 税务台账 → 销项发票台账
税务系统 → 税务台账 → 增值税预缴款台账
税务系统 → 税务台账 → 旅客运输服务台账
```

## 已知限制

1. **分页限制**: 所有表格查询只返回当前页数据（通常 20 条），暂不支持自动翻页
2. **GWT 类名动态变化**: 每次页面刷新后 class 名可能变化，代码已兼容多种类名但仍需持续维护
3. **下载路径**: 中文 Windows 系统 Chrome 下载目录为 `D:\下载`
4. **文件重命名**: Chrome 自动重命名重复文件（加 `(1)` 等），代码已支持模糊匹配
5. **GWT ID 后缀不稳定**: 不同单据实例的 input ID 后缀数字不同，已使用 `byIdPrefix` 策略兼容
6. **CDP 端口依赖**: CDP 真实点击需 Chrome 开启 `--remote-debugging-port=9222`

## Chrome 远程调试端口配置

```bash
# 命令行启动
"<Chrome安装路径>\chrome.exe" --remote-debugging-port=9222

# 验证端口
curl http://127.0.0.1:9222/json/version
```

> 若 Kimi WebBridge 已自动管理 Chrome 实例，通常无需手动配置。仅当 CDP 点击失败（如 Picker 弹窗无法打开）时检查。

## 关键修复记录

### 2026-06-10 YJK 提单日期提取修复

- **问题**: `bill_date`（提单日期）提取为 null
  - 根因: 提单日期值不在 innerText 中，而是在 `FormDateField1-input` 的 value 属性中；该 ID 有多个实例，第一个对应涉税报告到期时间
  - 解决: 使用 `byLabel: '提单日期'` 策略，通过 label 向上遍历父元素链定位正确的 input
  - 文件: `lib/bills/config/yjk.ts`
- **验证**: `bill_date` = `2026-06-10` ✅

### 2026-06-10 弹窗检测与 closeBill 双重修复

- **问题1**: `extract-bill` CLI 执行后弹窗未关闭
  - 根因: `dialog.ts` 策略4只查找 `x-tool` 类名，但 GWT 审批提醒弹窗关闭按钮类名为 `FD26IYC-jb-a`
  - 解决: 策略4新增备选选择器 `.FD26IYC-jb-a, [class*="jb-a"]`
  - 文件: `lib/utils/dialog.ts`
- **问题2**: `closeBill()` 错误地将 `FLOW_Pending` 当作"已返回首页"
  - 根因: URL 验证条件 `url.includes('FLOW_Pending')` 误匹配
  - 解决: 首页验证改为 `(url.includes('#/dashboard') || url.includes('CSCPortal.jsp')) && !url.includes('FLOW_')`
  - 文件: `lib/utils/bill.ts`

### 2026-06-10 YJK 提取器开发

- 新增 `lib/bills/config/yjk.ts` — 31 个 input 字段 + 2 个子表
- 引擎增强 `byIdPrefix` 策略 + 分包发票表头检测
- `postProcessYjk` 自动计算附加税费税率

### 2026-06-10 表头行过滤

- 问题: `expense_items` 混入表头文本（"发票状态"、"验真状态"等）
- 解决: 添加 `headerTexts` 过滤和 `isInvoiceRow` 过滤
- 文件: `lib/bills/extractor.ts`
