# FIP CLI 项目组织指南

## 目录结构

```
fip-cli/
├── bin/              # CLI 命令入口
│   └── fip-cli.js
├── lib/              # 核心自动化库
│   ├── browser.js    # WebBridge 客户端
│   ├── fip.js        # 主入口（聚合导出）
│   ├── output.js     # 输出格式化
│   ├── utils/        # 通用工具模块
│   │   ├── index.js  # 聚合导出
│   │   ├── common.js # 基础工具（sleep, findVisibleElementByText, getPageInfo, getTableRowCount）
│   │   ├── navigation.js  # 页面导航（openSideMenu, clickDrawerItem）
│   │   ├── form.js   # 表单操作（clickShowQuery, setDateInput, setDateRange, setTaxPeriod）
│   │   ├── picker.js # Picker弹窗（clickPickerButton, pickFromDict, pickTaxSubject）
│   │   └── bill.js   # 单据操作（openBill, closeBill）
│   └── ledgers/      # 各台账业务模块
│       ├── unbilled-income.js
│       ├── input-transfer.js
│       ├── output-invoice.js
│       ├── vat-prepayment.js
│       └── passenger-transport.js
├── test/             # 测试文件
│   └── basic.test.js
├── screenshots/      # 截图归档
│   └── archive/
├── .gitignore
├── CLAUDE.md         # 项目指令
├── CONTRIBUTING.md   # 本文件
├── package.json
└── package-lock.json
```

## 文件放置约定

1. **CLI 命令** → `bin/` 目录
2. **基础工具**（sleep, 元素查找, 页面信息） → `lib/utils/common.js`
3. **页面导航**（菜单, Drawer） → `lib/utils/navigation.js`
4. **表单操作**（日期, 税期, 显示查询） → `lib/utils/form.js`
5. **Picker弹窗**（帮助字典, 纳税主体选择） → `lib/utils/picker.js`
6. **单据操作**（打开, 关闭） → `lib/utils/bill.js`
7. **具体台账业务逻辑** → `lib/ledgers/` 目录
8. **主入口（聚合导出）** → `lib/fip.js`
9. **测试文件** → `test/` 目录
10. **临时截图** → `screenshots/archive/` 目录
11. **文档/经验指引** → `docs/` 目录

## 代码规范

1. 所有导出函数必须在 `lib/fip.js` 的 `module.exports` 中注册
2. CLI 命令使用 `commander` 库定义
3. 坐标查找必须通过可见性检查
4. 文本匹配使用精确匹配（`===`）而非包含匹配

## 添加新台账流程

1. 在 `lib/ledgers/` 下新建 `xxx-ledger.js` 文件，实现 `exportXxxLedger` 函数
2. 在 `lib/fip.js` 中 `require` 并注册到 `module.exports`
3. 在 `bin/fip-cli.js` 中注册命令
4. 添加基本测试

## 代码拆分原则

- **通用函数**按职责拆分：
  - `lib/utils/common.js` — 基础工具（sleep, findVisibleElementByText, getPageInfo, getTableRowCount）
  - `lib/utils/navigation.js` — 页面导航（openSideMenu, clickDrawerItem）
  - `lib/utils/form.js` — 表单操作（clickShowQuery, setDateInput, setDateRange, setTaxPeriod）
  - `lib/utils/picker.js` — Picker弹窗（clickPickerButton, pickFromDict, pickTaxSubject）
  - `lib/utils/bill.js` — 单据操作（openBill, closeBill）
- **业务逻辑**（各台账的查询/导出流程）独立为 `lib/ledgers/*.js` 文件
- **主入口** `lib/fip.js` 和 `lib/utils/index.js` 仅做聚合导出，不实现具体逻辑
