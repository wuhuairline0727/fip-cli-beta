# P0 + P1 基础设施完善计划

**分支**: `feature/p0-p1-infrastructure`
**目标**: 解决 P0（测试/代码质量/CI）和 P1（Debug/发布/配置验证）问题
**原则**: 保证现有功能正常运行，不破坏任何已有 CLI 命令

---

## P0 任务清单

### P0-1: ESLint + Prettier 配置

**文件变更**:
- 新建 `.eslintrc.js`
- 新建 `.prettierrc`
- 修改 `package.json`（添加 devDependencies 和 scripts）

**验证命令**:
```bash
npm run lint
npm run format:check
```

**要求**:
- ESLint 规则不破坏现有代码（先 warn 后 error）
- Prettier 格式化所有 lib/ 和 bin/ 下的 JS 文件
- 如果现有代码有大量风格问题，先 `--fix` 自动修复

### P0-2: GitHub Actions CI

**文件变更**:
- 新建 `.github/workflows/ci.yml`

**验证方式**:
- 推送到 feature 分支后检查 Actions 是否触发
- 检查 lint 和 test 是否通过

**要求**:
- 支持 Node.js 18.x 和 20.x
- 运行 lint、format:check、test
- 只在 push 到 master 和 PR 时触发

### P0-3: 测试框架 + 基础测试

**文件变更**:
- 修改 `package.json`（添加 mocha + chai）
- 新建 `test/unit/browser.test.js`
- 新建 `test/unit/doctor.test.js`
- 新建 `test/unit/bills/extractor.test.js`
- 修改 `test/basic.test.js`（保留并扩展）

**验证命令**:
```bash
npm test
npm run test:unit
```

**要求**:
- 测试 browser.js 的 checkConnection 逻辑
- 测试 doctor.js 的诊断检查函数
- 测试 bills/extractor.js 的 parseAmount 和 buildExtractionCode
- 所有测试不依赖 WebBridge（纯 Node.js 测试）

---

## P1 任务清单

### P1-1: Debug 模式 + 日志系统

**文件变更**:
- 新建 `lib/logger.js`
- 修改 `bin/fip-cli.js`（添加 --debug 和 --verbose 选项）
- 修改 `lib/browser.js`（集成 debug 日志）
- 修改 `lib/bills/extractor.js`（集成 debug 日志）

**验证命令**:
```bash
node bin/fip-cli.js doctor --debug
node bin/fip-cli.js login-status --verbose
```

**要求**:
- `--debug` 输出详细调试信息到控制台
- `--verbose` 输出操作日志
- 自动写入 `fip-debug.log` 文件
- 不影响正常输出格式

### P1-2: npm 发布准备

**文件变更**:
- 修改 `package.json`（完善字段）
- 新建 `.github/workflows/release.yml`

**验证方式**:
- `npm pack` 检查打包内容
- 检查 `npm publish --dry-run`

**要求**:
- 完善 name、description、keywords、repository、bugs、homepage
- 添加 engines 字段（node >= 16）
- 添加 files 字段控制发布内容
- 支持 `npm install -g fip-cli`

### P1-3: 配置 Schema 验证

**文件变更**:
- 新建 `lib/config-schema.js`
- 修改 `lib/config.js`（集成验证）

**验证命令**:
```bash
node bin/fip-cli.js config companyCode abc
# 应该报错：格式不正确
```

**要求**:
- 验证 companyCode、taxCode 等配置项格式
- 验证日期格式（YYYY-MM-DD）
- 验证期间格式（YYYY-MM）
- 错误时给出明确提示

---

## 执行顺序

```
P0-1 (ESLint+Prettier)
  → P0-2 (CI)
  → P0-3 (测试框架)
  → P0 验证（npm test + npm run lint）
  → P1-1 (Debug+日志)
  → P1-2 (npm发布)
  → P1-3 (配置验证)
  → P1 验证（浏览器实际测试）
  → 合并到 master
```

## 浏览器测试验证清单

P0/P1 全部完成后，必须在实际浏览器中验证以下命令：

```bash
# 基础功能
node bin/fip-cli.js doctor
node bin/fip-cli.js doctor --debug
node bin/fip-cli.js login-status
node bin/fip-cli.js page-info

# 单据提取（核心功能）
node bin/fip-cli.js extract-bill YJK20042026061003638 --current-page

# 台账查询
node bin/fip-cli.js export-input-transfer --start-period 2026-04 --end-period 2026-04 --query-only
```

**通过标准**:
- 所有命令正常执行，不报错
- `--debug` 输出详细日志
- 提取结果字段完整准确
- 无弹窗残留、无单据未关闭

---

**计划编写时间**: 2026-06-10
