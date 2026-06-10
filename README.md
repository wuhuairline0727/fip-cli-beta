# FIP CLI

FIP一体化平台自动化CLI工具 - 支持中国建筑司库一体化平台(fip.cscec.com)的多系统模块自动化操作，包括报账系统单据处理、税务系统开票单审核与台账查询等。

## 适配平台

- **目标网站**: [中国建筑司库一体化平台](https://fip.cscec.com)
- **系统模块**: 报账系统、税务系统、司库系统、商旅出行

## 依赖工具

### 必需

| 工具 | 用途 | 安装方式 |
|------|------|----------|
| **Kimi WebBridge** | 浏览器自动化控制（导航、点击、提取、截图） | 浏览器扩展 + 本地守护进程 |
| **Node.js** | CLI 运行时环境 | [nodejs.org](https://nodejs.org) |
| **Git** | 版本控制 | [git-scm.com](https://git-scm.com) |
| **Chrome 浏览器** | WebBridge 目标浏览器，需开启远程调试端口 | 见下方配置 |

### 可选

| 工具 | 用途 |
|------|------|
| **GitHub CLI (gh)** | 仓库管理、Issue/PR 操作 |

## Kimi WebBridge 配置

1. 安装浏览器扩展: [Kimi WebBridge Extension](https://kimi-webbridge.moonshot.cn)
2. 启动本地守护进程:
   ```bash
   # Windows
   C:\Users\<用户名>\.kimi-webbridge\bin\kimi-webbridge.exe start
   
   # 检查状态
   C:\Users\<用户名>\.kimi-webbridge\bin\kimi-webbridge.exe status
   ```
3. 确认连接端口: `http://127.0.0.1:10086`

## Chrome 远程调试端口配置

本工具通过 Chrome DevTools Protocol (CDP) 实现真实鼠标点击操作（如 Picker 弹窗、下拉选项等），需要 Chrome 开启远程调试端口：

```bash
# 方式一：命令行启动 Chrome（推荐）
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222

# 方式二：为 Chrome 创建快捷方式，在目标后追加参数
# 右键 Chrome 快捷方式 → 属性 → 目标末尾添加: --remote-debugging-port=9222
```

验证端口是否开启：
```bash
curl http://127.0.0.1:9222/json/version
```

> **注意**: 若 Kimi WebBridge 已自动管理 Chrome 实例，通常无需手动配置。仅当 CDP 点击失败（如 Picker 弹窗无法打开）时，才需要检查远程调试端口是否开启。

## 快速开始

```bash
# 克隆仓库
git clone https://github.com/wuhuairline0727/fip-cli.git
cd fip-cli

# 安装依赖
npm install

# 确保 WebBridge 已连接
node bin/fip-cli.js login-status

# 提取待办单据
node bin/fip-cli.js extract-bill <单据编号>

# 审核开票单
node bin/fip-cli.js audit-invoice <单据编号>
```

---

## 功能模块

### 一、报账系统

报账系统单据的自动打开、字段提取、附件下载和关闭。

#### 支持的单据类型

| 类型代码 | 单据名称 | 状态 | 备注 |
|----------|----------|------|------|
| SLBX | 境内差旅报销单 | ✅ 已验收 | 费用明细、预算分配、交通费/补助费 |
| TBX | 通用报销单 | ✅ 已验收 | 费用明细、预算分配 |
| CFK | 对外成本费用付款申请 | ✅ 已验收 | 费用明细、支付信息 |
| CBX | 差旅费报销 | ✅ 已验收 | 差旅明细、补助信息 |

#### 报账系统 CLI 命令

```bash
# 打开单据（自动在各标签页搜索）
fip-cli open-bill <单据编号>

# 提取单据字段（自动识别类型）
fip-cli extract-bill <单据编号>
fip-cli extract-bill SLBX2004202605003766  # 境内差旅报销单
fip-cli extract-bill TBX2004202605003766   # 通用报销单
fip-cli extract-bill CFK2004202605003766  # 对外成本费用付款申请
fip-cli extract-bill CBX2004202605003766   # 差旅费报销

# 输出到文件
fip-cli extract-bill <单据编号> --output result.json

# 指定单据类型
fip-cli extract-bill <单据编号> --type TBX

# 列出附件
fip-cli list-attachments

# 下载附件
fip-cli download-attachments --dir ./downloads

# 关闭单据返回 Dashboard
fip-cli close-bill
```

#### 报账系统提取字段示例（SLBX）

- **基础信息**: 单据编号、提单人、项目、部门、计税模式、事前申请单号
- **费用明细**: 费用类型、金额、税率、税额、发票信息
- **预算分配**: 预算科目、分配金额
- **交通费/补助费**: 出发地、目的地、交通工具、补助标准

---

### 二、税务系统

税务单据字段提取、台账查询与导出，以及建筑施工开票单审核。

#### 支持的单据类型

| 类型代码 | 单据名称 | 状态 | 备注 |
|----------|----------|------|------|
| YJK | 预缴计算单 | ✅ 已验收 | 增值税/所得税/附加税费预缴，含税率自动计算 |
| KP | 建筑施工开票单 | ✅ 已验收 | 合同金额核对、累计确权额核对、附件完整性检查 |

#### 税务台账查询

| 台账名称 | 命令 | 状态 |
|----------|------|------|
| 未开票收入台账 | `export-unbilled` | ✅ 已验收 |
| 进项转出明细台账 | `export-input-transfer` | ✅ 已验收 |
| 销项发票明细台账 | `export-output-invoice` | ✅ 已验收 |
| 增值税预缴款台账 | `export-vat-prepayment` | ✅ 已验收 |
| 旅客运输服务台账 | `export-passenger-transport` | ✅ 已验收 |

#### 税务系统 CLI 命令

```bash
# 预缴计算单字段提取
fip-cli extract-bill YJK20042026061003638

# 开票单字段提取
fip-cli extract-invoice <单据编号>

# 开票单审核（生成审核报告）
fip-cli audit-invoice <单据编号>

# 保持单据打开（不自动关闭）
fip-cli audit-invoice <单据编号> --keep-open

# 台账查询（返回 JSON）
fip-cli export-input-transfer --start-period 2026-04 --end-period 2026-04 --query-only
fip-cli export-output-invoice --start-date 2026-04-01 --end-date 2026-04-30 --query-only
fip-cli export-vat-prepayment --start-period 2026-04 --doc-type "预缴计算单" --query-only
fip-cli export-passenger-transport --start-period 2026-04 --end-period 2026-04 --query-only
fip-cli export-unbilled --start-period 2026-04 --query-only

# 批量导出多个台账
fip-cli export-all --ledgers input-transfer,output-invoice --query-only
```

#### 税务系统配置项

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

#### YJK（预缴计算单）提取字段

- **基础信息**: 单据编号、提单人、公司名称、纳税人识别号、项目名称、计税方式、预缴分类、涉税事项报告
- **增值税预缴信息**: 预缴总税额、税务机关、预缴期间、销售额、税率、征收率、预缴增值税
- **所得税预缴信息**: 是否预缴所得税、企业所得税、个人所得税
- **附加税费预缴信息**: 城市维护建设税、教育费附加、地方教育附加、合计
- **税率自动计算**: 城市维护建设税税率 = 城市维护建设税 / 预缴增值税⑥
- **分包发票信息**: 发票代码、发票号码、开票日期、金额、税率、税额

#### 开票单审核规则

| 审核项 | 说明 |
|--------|------|
| 合同金额核对 | 比对合同金额与开票金额 |
| 累计确权额核对 | 验证累计确权额是否匹配 |
| 审批人检查 | 确认审批流程完整性 |
| 附件完整性 | 检查附件是否齐全 |

---

### 三、基础功能

跨系统通用的基础操作命令。

#### 环境诊断

```bash
# 一键诊断环境状态（检查 Node.js、依赖、WebBridge、CDP、FIP 登录等）
fip-cli doctor

# JSON 格式输出
fip-cli doctor --json
```

诊断项说明：

| 检查项 | 正常状态 | 失败时修复建议 |
|--------|----------|----------------|
| Node.js 版本 | >= v16 | 升级 Node.js |
| 项目依赖 | node_modules 完整 | `npm install` |
| Kimi WebBridge | 端口 10086 响应正常 | 启动守护进程 |
| Chrome 远程调试 | 端口 9222 已开启 | 添加 `--remote-debugging-port=9222` |
| FIP 登录状态 | 已登录 | 在浏览器中打开 FIP 并登录 |
| GitHub CLI | 已安装（可选） | `winget install --id GitHub.cli` |

#### 状态检查与导航

```bash
# 检查登录状态
fip-cli login-status

# 获取页面信息（URL、标题）
fip-cli page-info

# 切换 Dashboard 子标签页
fip-cli tab "已办结"
fip-cli tab "待办"
fip-cli tab "已办"
fip-cli tab "我的单据"

# 点击查询按钮
fip-cli query

# 获取表格行数
fip-cli rows

# 读取表格数据
fip-cli table-data --max-rows 50
```

#### 配置管理

```bash
# 查看/设置配置项
fip-cli config <key> [value]

# 常用配置项
fip-cli config companyCode   1000200020040011
fip-cli config taxCode       91110000101638302P
fip-cli config startDate     2026-04-01
fip-cli config endDate       2026-04-30
```

---

## 项目结构

```
fip-cli/
├── bin/
│   └── fip-cli.js              # CLI 命令入口（45+ 个命令）
├── lib/
│   ├── doctor.js               # 环境诊断模块（检查 Node.js/依赖/WebBridge/CDP/FIP 登录）
│   ├── browser.js                # WebBridge 客户端封装
│   ├── fip.js                    # 主入口（聚合导出所有功能）
│   ├── output.js                 # 输出格式化 + 自动截图
│   ├── config.js                 # ~/.fiprc.json 配置管理
│   ├── audit/                    # 税务系统 - 开票单审核（KP）
│   │   ├── extractor.js          # 开票单字段提取器
│   │   ├── engine.js             # 审核引擎
│   │   ├── reporter.js           # 报告生成器（text/json/md）
│   │   └── rules.json            # 审核规则配置
│   ├── bills/                    # 报账系统 + 税务系统 - 通用单据提取
│   │   ├── extractor.js          # 通用提取引擎（支持 byIdPrefix 策略）
│   │   ├── audit-hints.js        # 审核提示生成器
│   │   └── config/
│   │       ├── index.js          # 配置注册表（类型识别）
│   │       ├── common.js         # 通用字段 + 过滤配置
│   │       ├── domestic-travel.js # SLBX 配置（境内差旅报销单）
│   │       ├── general-expense.js # TBX 配置（通用报销单）
│   │       ├── external-payment.js # CFK 配置（对外成本费用付款申请）
│   │       ├── travel-expense.js  # CBX 配置（差旅费报销）
│   │       └── yjk.js            # YJK 配置（预缴计算单，税务模块）
│   ├── ledgers/                  # 税务系统 - 台账查询
│   │   ├── unbilled-income.js    # 未开票收入台账
│   │   ├── input-transfer.js     # 进项转出明细台账
│   │   ├── output-invoice.js     # 销项发票明细台账
│   │   ├── vat-prepayment.js     # 增值税预缴款台账
│   │   └── passenger-transport.js # 旅客运输服务台账
│   └── utils/                    # 通用工具
│       ├── index.js              # utils 聚合导出
│       ├── cdp.js                # CDP 抽象层（真实点击，端口 9222）
│       ├── common.js             # 通用 DOM 操作（sleep/查找/页签切换）
│       ├── dialog.js             # 弹窗检测与自动关闭（支持 GWT 审批提醒弹窗）
│       ├── form.js               # 表单操作
│       ├── picker.js             # Picker 弹窗操作
│       ├── navigation.js         # 导航操作（侧边菜单/Drawer）
│       ├── bill.js               # 单据操作（openBill/closeBill）
│       ├── table.js              # 表格数据读取
│       └── attachment.js         # 附件列表/下载
├── package.json
├── package-lock.json
└── README.md
```

---

## 技术特性

### CDP 真实点击

针对 GWT 框架中部分元素无法通过常规 DOM 点击触发的情况，本工具通过 Chrome DevTools Protocol (CDP) 实现真实鼠标点击：

- **端口**: 默认连接 `127.0.0.1:9222`
- **应用场景**: Picker 弹窗按钮、下拉选项、弹窗内元素等
- **依赖**: Chrome 必须开启 `--remote-debugging-port=9222`

### 弹窗自动处理

- 支持 GWT 审批提醒弹窗检测与自动关闭
- 兼容动态类名（`x-tool-close`、`FD26IYC-jb-a` 等）
- `extract-bill` CLI 自动执行：打开 → 关闭弹窗 → 提取 → 关闭单据

### GWT 框架兼容

- 使用 `byIdPrefix` 策略应对 GWT ID 后缀不稳定问题（如 `SW_STO_YJKF_GSMC30` vs `SW_STO_YJKF_GSMC3`）
- 多策略选择器兼容动态类名变化

### 税率自动计算

YJK 预缴计算单自动计算附加税费税率：
- 城市维护建设税税率 = 城市维护建设税 / 预缴增值税⑥
- 教育费附加税率 = 教育费附加 / 预缴增值税⑥
- 地方教育附加税率 = 地方教育附加 / 预缴增值税⑥

---

## 已知限制

1. **分页限制**: 所有表格查询只返回当前页数据（通常 20 条），暂不支持自动翻页
2. **GWT 类名动态变化**: 每次页面刷新后 class 名可能变化，代码已兼容多种类名但仍需持续维护
3. **下载路径**: 中文 Windows 系统 Chrome 下载目录为 `D:\下载`
4. **文件重命名**: Chrome 自动重命名重复文件（加 `(1)` 等），代码已支持模糊匹配
5. **YJK 提单日期**: innerText 中提单日期字段值为空，需通过其他方式获取

---

## 更新日志

### 2026-06-10
- ✅ YJK（预缴计算单）字段提取器开发完成并验收
- ✅ 修复 `extract-bill` CLI 弹窗未关闭问题（`dialog.js` 策略4新增备选选择器）
- ✅ 修复 `closeBill()` URL 验证误匹配问题（排除 `FLOW_` 前缀）
- ✅ 生产环境验证通过（22 个待办单据 + 1 个 YJK 已办结单据）

### 2026-06-09
- ✅ 开票单审核模块验收通过（KP 类型）
- ✅ 通用单据提取器验收通过（SLBX/TBX/CFK/CBX）
- ✅ 五个税务台账查询功能恢复并测试通过

---

## License

MIT
