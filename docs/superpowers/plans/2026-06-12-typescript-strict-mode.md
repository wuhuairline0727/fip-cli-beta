# Superpowers 计划: TypeScript 迁移收尾 (Phase A-C)

**日期**: 2026-06-12
**分支**: typescript-migration
**目标**: 完成 TypeScript 迁移的"最后一公里"，启用 strict 模式，测试 TS 化，完善类型系统

---

## Phase A: 启用 strict 模式

### 任务 A1: 创建 chrome-remote-interface 类型声明
**文件**: `lib/types/cdp.d.ts`
**时间**: 5 分钟
**内容**:
- `declare module 'chrome-remote-interface'`
- 导出 `CDP` 函数，返回 `Client` 对象
- `Client` 包含 `Runtime`, `Input`, `close()` 等
- 所有方法参数和返回值用 `any`（外部库，无需精确类型）

**验证**: `tsc --noEmit` 不再报 `TS7016: Could not find a declaration file`

### 任务 A2: 创建 WebBridge 响应类型声明
**文件**: `lib/types/webbridge.d.ts`（已存在，需扩展）
**时间**: 5 分钟
**内容**:
- 扩展 `WebBridgeResponse` 接口，添加 `data?: { value?: unknown; [key: string]: unknown }`
- 添加 `EvaluateResponse`, `ScreenshotResponse` 等专用类型

### 任务 A3: 修复 `result.data?.value` 的 unknown 类型收窄
**文件**: 涉及 `lib/utils/*.ts`, `lib/ledgers/*.ts`, `lib/bills/extractor.ts`
**时间**: 15 分钟
**策略**:
- 所有 `result?.data?.value` 改为 `(result?.data as any)?.value`
- 或定义辅助函数 `getValue<T>(result: WebBridgeResponse): T | undefined`
- 优先使用类型断言，最小化代码变更

**验证**: `tsc --noEmit` 0 errors

### 任务 A4: 分步启用 strict 模式
**文件**: `tsconfig.json`
**时间**: 10 分钟
**步骤**:
1. 先启用 `noImplicitAny: true`
2. 修复所有 `implicitly has an 'any' type` 错误
3. 再启用 `strictNullChecks: true`
4. 修复所有 `possibly undefined` 错误
5. 最终启用 `strict: true`

**验证**: 每步 `tsc --noEmit` 0 errors + `npm test` 192 passing

---

## Phase B: 测试 TS 化 + 完善类型声明

### 任务 B1: 测试文件改为 .ts
**文件**: `test/unit/**/*.test.js` → `.test.ts`
**时间**: 10 分钟
**内容**:
- 重命名所有 `.test.js` 为 `.test.ts`
- 添加 `import { expect } from 'chai'` 替代 `require('chai')`
- 更新 `package.json` test 脚本 glob: `"test/unit/**/*.test.{js,ts}"` → `"test/unit/**/*.test.ts"`

**验证**: `npm test` 192 passing

### 任务 B2: 完善公共类型声明
**文件**: `lib/types/fip.d.ts`（新建）
**时间**: 10 分钟
**内容**:
- 统一导出所有公共接口
- `BillConfig`, `LedgerOptions`, `AuditResult`, `DiagnosticCheck` 等
- 从各模块收集分散的接口定义，集中管理

**验证**: `tsc --noEmit` 0 errors

---

## Phase C: CLI 入口 + CI 流程

### 任务 C1: CLI 入口改为 .ts
**文件**: `bin/fip-cli.js` → `bin/fip-cli.ts`
**时间**: 10 分钟
**内容**:
- 重命名文件
- 添加类型注解（`program` 选项、命令处理函数）
- 更新 `package.json` bin 字段: `"fip-cli": "./bin/fip-cli.ts"`
- 保留 shebang `#!/usr/bin/env node`

**验证**: `node bin/fip-cli.ts --help` 正常输出

### 任务 C2: 添加 typecheck 脚本
**文件**: `package.json`
**时间**: 5 分钟
**内容**:
- `"typecheck": "tsc --noEmit"`
- `"test:ts": "npm run typecheck && npm test"`

**验证**: `npm run typecheck` 0 errors

### 任务 C3: 更新 npm scripts
**文件**: `package.json`
**时间**: 5 分钟
**内容**:
- 更新 `test` 脚本支持 `.ts` 测试文件
- 更新 `lint` 脚本覆盖 `.ts` 文件
- 更新 `format` 脚本覆盖 `.ts` 文件

**验证**: `npm run lint` 无错误

---

## 审查检查点

### Phase A 审查
- [ ] `tsc --noEmit` 0 errors
- [ ] `npm test` 192 passing
- [ ] `node bin/fip-cli.js --help` 正常
- [ ] 无运行时错误

### Phase B 审查
- [ ] 所有测试文件为 `.ts`
- [ ] `npm test` 192 passing
- [ ] `tsc --noEmit` 0 errors
- [ ] 类型声明文件完整

### Phase C 审查
- [ ] CLI 入口为 `.ts` 且正常工作
- [ ] `npm run typecheck` 可用
- [ ] `npm run lint` 无错误
- [ ] `npm test` 192 passing

---

## 风险与回滚

| 风险 | 缓解措施 |
|:---|:---|
| strict 模式导致大量错误 | 分步启用，每步验证 |
| 测试 TS 化破坏测试 | 保留原 JS 测试作为备份，逐步替换 |
| CLI 入口改 TS 后无法运行 | 保留原 JS 备份，验证通过后再删除 |
| 类型声明不完整 | 先用 `any`，后续迭代完善 |

**回滚**: 任何阶段失败，执行 `git checkout -- .` 回滚到上一阶段状态。
