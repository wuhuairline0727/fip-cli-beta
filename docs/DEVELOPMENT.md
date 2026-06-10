# FIP CLI 开发文档

## 开发命令

```bash
# 运行测试
npm test                    # 全部测试（37 个）
npm run test:unit           # 仅单元测试

# 代码质量
npm run lint                # ESLint 检查
npm run lint:fix            # 自动修复
npm run format              # Prettier 格式化
npm run format:check        # 格式检查
```

## 项目结构

```
fip-cli/
├── bin/
│   └── fip-cli.js              # CLI 命令入口（45+ 个命令）
├── lib/
│   ├── doctor.js               # 环境诊断模块
│   ├── browser.js                # WebBridge 客户端封装
│   ├── fip.js                    # 主入口（聚合导出所有功能）
│   ├── output.js                 # 输出格式化 + 自动截图
│   ├── config.js                 # ~/.fiprc.json 配置管理
│   ├── config-schema.js          # 配置项格式验证
│   ├── logger.js                 # Debug/Verbose 日志系统
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
│   │       ├── domestic-travel.js # SLBX 配置
│   │       ├── general-expense.js # TBX 配置
│   │       ├── external-payment.js # CFK 配置
│   │       ├── travel-expense.js  # CBX 配置
│   │       └── yjk.js            # YJK 配置（预缴计算单）
│   ├── ledgers/                  # 税务系统 - 台账查询
│   │   ├── unbilled-income.js    # 未开票收入台账
│   │   ├── input-transfer.js     # 进项转出明细台账
│   │   ├── output-invoice.js     # 销项发票明细台账
│   │   ├── vat-prepayment.js     # 增值税预缴款台账
│   │   └── passenger-transport.js # 旅客运输服务台账
│   └── utils/                    # 通用工具
│       ├── index.js              # utils 聚合导出
│       ├── cdp.js                # CDP 抽象层（真实点击，端口 9222）
│       ├── common.js             # 通用 DOM 操作
│       ├── dialog.js             # 弹窗检测与自动关闭
│       ├── form.js               # 表单操作
│       ├── picker.js             # Picker 弹窗操作
│       ├── navigation.js         # 导航操作
│       ├── bill.js               # 单据操作（openBill/closeBill）
│       ├── table.js              # 表格数据读取
│       └── attachment.js         # 附件列表/下载
├── test/                         # 单元测试（mocha + chai）
│   ├── unit/
│   │   ├── browser.test.js
│   │   ├── doctor.test.js
│   │   ├── bills/
│   │   │   └── extractor.test.js
│   │   └── config-schema.test.js
│   └── basic.test.js
├── .github/
│   └── workflows/
│       ├── ci.yml                # GitHub Actions CI
│       └── release.yml           # 自动发布工作流
├── eslint.config.js              # ESLint v10 flat config
├── .prettierrc                   # Prettier 配置
├── package.json
├── package-lock.json
└── README.md
```

## 技术栈

- **运行时**: Node.js ≥ v16
- **测试**: mocha + chai
- **代码质量**: ESLint v10 (flat config) + Prettier
- **CI/CD**: GitHub Actions
- **浏览器自动化**: Kimi WebBridge + Chrome DevTools Protocol (CDP)

## 添加新的单据类型

1. 在 `lib/bills/config/` 下创建新的配置文件
2. 在 `lib/bills/config/index.js` 中注册类型识别规则
3. 在 `lib/bills/extractor.js` 中添加必要的 `postProcess` 函数
4. 在 `test/unit/bills/` 下添加单元测试
5. 更新 `README.md` 和 `docs/GUIDE.md` 中的支持类型列表

## 发布流程

```bash
# 1. 确保所有测试通过
npm test

# 2. 检查代码质量
npm run lint
npm run format:check

# 3. 更新版本号
npm version patch|minor|major

# 4. 推送标签触发自动发布
git push && git push --tags
```

GitHub Actions 会自动执行 `npm publish`。
