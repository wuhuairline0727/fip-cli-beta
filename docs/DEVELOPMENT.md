# FIP CLI 开发文档 (Beta)

> ⚠️ **测试版本声明** — 本项目目前处于 **Beta / 测试阶段**，API、接口及内部实现可能随时调整。请据此评估使用风险。

## 开发命令

```bash
# 运行测试
npm test                    # 全部测试（192 单元测试）
npm run test:unit           # 仅单元测试
npm run test:integration    # 仅真实浏览器集成测试（需要 WebBridge + Chrome）

# 代码质量
npm run typecheck           # TypeScript 类型检查（strict 模式）
npm run lint                # ESLint 检查
npm run lint:fix            # 自动修复
npm run format              # Prettier 格式化
npm run format:check        # 格式检查
```

## 项目结构

```
fip-cli/
├── bin/
│   ├── fip-cli.js              # CLI 入口 shim（加载 tsx + fip-cli.ts）
│   └── fip-cli.ts              # CLI 命令实现（45+ 个命令，TypeScript）
├── lib/
│   ├── doctor.ts               # 环境诊断模块
│   ├── browser.ts              # WebBridge 客户端封装
│   ├── fip.ts                  # 主入口（聚合导出所有功能）
│   ├── output.ts               # 输出格式化 + 自动截图
│   ├── config.ts               # ~/.fiprc.json 配置管理
│   ├── config-schema.ts        # 配置项格式验证
│   ├── logger.ts               # Debug/Verbose 日志系统
│   ├── report-generator.ts     # 报告生成器
│   ├── types/                  # 类型定义
│   │   ├── cdp.d.ts            # chrome-remote-interface 模块声明
│   │   ├── webbridge.d.ts      # WebBridge API 类型
│   │   └── fip.d.ts            # FIP 主模块类型接口
│   ├── audit/                  # 税务系统 - 开票单审核（KP）
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
│   │       ├── domestic-travel.ts # SLBX 配置
│   │       ├── general-expense.ts # TBX 配置
│   │       ├── external-payment.ts # CFK 配置
│   │       ├── travel-expense.ts  # CBX 配置
│   │       └── yjk.ts            # YJK 配置（预缴计算单）
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
│       ├── attachment.ts         # 附件列表/下载
│       ├── organization.ts       # 组织机构切换
│       └── organization-cache.ts # 组织机构缓存
├── test/                         # 测试（mocha + chai + sinon，全部 TypeScript）
│   ├── basic.test.ts             # 基础测试
│   ├── integration/              # 真实浏览器集成测试
│   │   ├── browser-real.test.ts  # 真实浏览器测试
│   │   └── organization-auto-select.test.ts
│   └── unit/                     # 单元测试（纯 Node.js，无需浏览器）
│       ├── audit/
│       ├── bills/
│       ├── browser.test.ts
│       ├── config.test.ts
│       ├── config-schema.test.ts
│       ├── doctor.test.ts
│       ├── fip.test.ts
│       ├── ledgers/
│       ├── logger.test.ts
│       ├── output.test.ts
│       └── utils/
├── .github/
│   └── workflows/
│       ├── ci.yml                # GitHub Actions CI
│       └── release.yml           # 自动发布工作流
├── eslint.config.js              # ESLint v10 flat config
├── .prettierrc                   # Prettier 配置
├── tsconfig.json                 # TypeScript 配置（strict: true）
├── package.json
├── package-lock.json
└── README.md
```

## 技术栈

- **运行时**: Node.js ≥ v20
- **语言**: TypeScript（strict 模式，零 `.js` 源文件）
- **加载器**: tsx（CJS 模式，运行时解析 `.ts`）
- **测试**: mocha + chai + sinon（测试文件全部 `.ts`）
- **代码质量**: ESLint v10 (flat config) + Prettier + TypeScript strict check
- **CI/CD**: GitHub Actions（typecheck + lint + test）
- **浏览器自动化**: Kimi WebBridge + Chrome DevTools Protocol (CDP)

## TypeScript 类型系统

### 类型定义文件

| 文件                       | 说明                                         |
| -------------------------- | -------------------------------------------- |
| `lib/types/cdp.d.ts`       | `chrome-remote-interface` 模块声明           |
| `lib/types/webbridge.d.ts` | WebBridge HTTP API 请求/响应类型             |
| `lib/types/fip.d.ts`       | FIP 主模块 `FipAPI` 接口（覆盖所有导出函数） |

### 类型检查

```bash
npm run typecheck    # tsc --noEmit，strict 模式零错误
```

### 关键类型约束

- `lib/browser.ts` 中 `evaluate()` 返回 `Promise<WebBridgeResponse<T>>`
- `lib/utils/cdp.ts` 中 `cdpEvaluate<T>()` 支持泛型返回值
- `lib/fip.ts` 通过 `FipAPI` 接口提供完整类型提示
- CLI 入口 `bin/fip-cli.ts` 使用 `fipTyped = fip as FipAPI` 获得类型安全

## 测试说明

### 单元测试

纯 Node.js 测试，无需浏览器连接，覆盖所有模块的导出验证、配置合并、数据解析等逻辑：

```bash
npm run test:unit
```

### 集成测试（真实浏览器）

需要 WebBridge 连接 + Chrome（`--remote-debugging-port=9222`），自动操作真实 FIP 页面验证功能：

```bash
npm run test:integration
```

**注意**: 集成测试会真实点击页面元素、查询台账数据，请在非生产高峰期运行。

### 测试统计

| 类型     | 数量    | 说明                                |
| -------- | ------- | ----------------------------------- |
| 单元测试 | 192     | 35 个测试文件，覆盖 39 个 lib/ 模块 |
| 集成测试 | 2       | 2 个测试文件，真实浏览器验证        |
| **总计** | **194** | **37 个测试文件**                   |

## 添加新的单据类型

1. 在 `lib/bills/config/` 下创建新的 `.ts` 配置文件
2. 在 `lib/bills/config/index.ts` 中注册类型识别规则
3. 在 `lib/bills/extractor.ts` 中添加必要的 `postProcess` 函数
4. 在 `test/unit/bills/` 下添加单元测试
5. 更新 `README.md` 和 `docs/GUIDE.md` 中的支持类型列表

## 发布流程

```bash
# 1. 确保所有测试通过
npm test

# 2. 检查代码质量
npm run typecheck
npm run lint
npm run format:check

# 3. 更新版本号
npm version patch|minor|major

# 4. 推送标签触发自动发布
git push && git push --tags
```

GitHub Actions 会自动执行 `npm publish`。
