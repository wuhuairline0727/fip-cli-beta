# FIP CLI

FIP一体化平台自动化CLI工具 - 支持中国建筑司库一体化平台(fip.cscec.com)的单据提取、台账查询、开票单审核。

## 适配平台

- **目标网站**: [中国建筑司库一体化平台](https://fip.cscec.com)
- **系统模块**: 报账系统、司库系统、税务系统、商旅出行

## 依赖工具

### 必需

| 工具 | 用途 | 安装方式 |
|------|------|----------|
| **Kimi WebBridge** | 浏览器自动化控制（导航、点击、提取、截图） | 浏览器扩展 + 本地守护进程 |
| **Node.js** | CLI 运行时环境 | [nodejs.org](https://nodejs.org) |
| **Git** | 版本控制 | [git-scm.com](https://git-scm.com) |

### 可选

| 工具 | 用途 |
|------|------|
| **GitHub CLI (gh)** | 仓库管理、Issue/PR 操作 |
| **Chrome 浏览器** | WebBridge 目标浏览器 |

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

## 支持的单据类型

| 类型代码 | 单据名称 | 状态 |
|----------|----------|------|
| SLBX | 境内差旅报销单 | ✅ |
| TBX | 通用报销单 | ✅ |
| CFK | 对外成本费用付款申请 | ✅ |
| CBX | 差旅费报销 | ✅ |
| YJK | 预缴计算单（税务模块） | ✅ |
| KP | 建筑施工开票单 | ✅ |

## 功能模块

- **单据字段提取**: 自动识别类型，提取基础信息、费用明细、预算分配
- **台账查询导出**: 未开票收入、进项转出、销项发票、增值税预缴、旅客运输
- **开票单审核**: 合同金额核对、累计确权额核对、附件完整性检查
- **弹窗自动处理**: 审批提醒弹窗检测与关闭

## 项目结构

```
fip-cli/
├── bin/
│   └── fip-cli.js              # CLI 命令入口
├── lib/
│   ├── browser.js                # WebBridge 客户端封装
│   ├── fip.js                    # 主入口（聚合导出所有功能）
│   ├── output.js                 # 输出格式化 + 自动截图
│   ├── config.js                 # ~/.fiprc.json 配置管理
│   ├── audit/
│   │   ├── extractor.js          # 开票单字段提取器
│   │   ├── engine.js             # 审核引擎
│   │   ├── reporter.js           # 报告生成器（text/json/md）
│   │   └── rules.json            # 审核规则配置
│   ├── bills/
│   │   ├── extractor.js          # 通用单据提取引擎
│   │   ├── audit-hints.js        # 审核提示生成器
│   │   └── config/
│   │       ├── index.js          # 配置注册表（类型识别）
│   │       ├── common.js         # 通用字段 + 过滤配置
│   │       ├── domestic-travel.js # SLBX 配置
│   │       ├── general-expense.js # TBX 配置
│   │       ├── external-payment.js # CFK 配置
│   │       ├── travel-expense.js  # CBX 配置
│   │       └── yjk.js            # YJK 配置（预缴计算单）
│   ├── ledgers/
│   │   ├── unbilled-income.js    # 未开票收入台账
│   │   ├── input-transfer.js     # 进项转出明细台账
│   │   ├── output-invoice.js     # 销项发票明细台账
│   │   ├── vat-prepayment.js    # 增值税预缴款台账
│   │   └── passenger-transport.js # 旅客运输服务台账
│   └── utils/
│       ├── index.js              # utils 聚合导出
│       ├── cdp.js                # CDP 抽象层（真实点击）
│       ├── common.js             # 通用 DOM 操作（sleep/查找/页签切换）
│       ├── dialog.js             # 弹窗检测与自动关闭
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

## 注意事项

- GWT 框架类名动态变化，需持续维护选择器兼容性
- 中文 Windows 系统 Chrome 下载目录可能为 `D:\下载`
- 所有表格查询只返回当前页数据，暂不支持自动翻页

## License

MIT
