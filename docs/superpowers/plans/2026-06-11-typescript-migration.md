# fip-cli TypeScript 渐进迁移计划

> **分支**: `typescript-migration`  
> **创建日期**: 2026-06-11  
> **策略**: 渐进迁移（JS/TS 混用 → 全 TS）  
> **验证原则**: 每文件迁移后必须 `npm test` 全绿 + 浏览器验证（如涉 WebBridge）

---

## 全局约束

- **禁止臆想**: 所有 WebBridge/CDP 相关类型定义必须通过浏览器实际测试验证
- **回滚策略**: 每完成一个 Phase 提交一次，`git checkout master` 可立即回滚
- **测试门禁**: `npm test` 必须 192+ passing，0 failing，否则阻塞下一任务
- **lint 门禁**: `npm run lint` 0 errors，warnings 可接受

---

## Phase 0: 基础设施（预计 1-2 小时）

### Task 0.1: 安装 TypeScript 及相关依赖

**文件**: `package.json`  
**操作**: 安装开发依赖

```bash
npm install -D typescript @types/node ts-mocha @types/mocha @types/chai @types/sinon
```

**验证**:
```bash
npx tsc --version  # 应输出 5.x
```

---

### Task 0.2: 创建 tsconfig.json

**文件**: `tsconfig.json`（新建）  
**策略**: `allowJs: true` 起步，先不启用 `strict`，避免一次性报错过多

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": ".",
    "allowJs": true,
    "checkJs": false,
    "strict": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": false,
    "declarationMap": false,
    "sourceMap": true,
    "moduleResolution": "node",
    "types": ["node", "mocha"]
  },
  "include": ["lib/**/*", "bin/**/*", "test/**/*"],
  "exclude": ["node_modules", "dist", "data"]
}
```

**验证**:
```bash
npx tsc --noEmit
# 预期: 0 errors（因为 checkJs: false，不检查现有 JS）
```

---

### Task 0.3: 更新测试配置支持 TypeScript

**文件**: `package.json`  
**修改 scripts**:

```json
{
  "scripts": {
    "test": "ts-mocha 'test/unit/**/*.test.{js,ts}' --timeout 10000",
    "test:unit": "ts-mocha 'test/unit/**/*.test.{js,ts}' --timeout 10000",
    "test:integration": "ts-mocha 'test/integration/**/*.test.{js,ts}' --timeout 300000",
    "lint": "eslint lib/ bin/ test/",
    "lint:fix": "eslint lib/ bin/ test/ --fix",
    "format": "prettier --write 'lib/**/*.{js,ts}' 'bin/**/*.{js,ts}' 'test/**/*.{js,ts}'",
    "format:check": "prettier --check 'lib/**/*.{js,ts}' 'bin/**/*.{js,ts}' 'test/**/*.{js,ts}'",
    "typecheck": "tsc --noEmit"
  }
}
```

**验证**:
```bash
npm test
# 预期: 所有现有 .test.js 仍通过
```

---

### Task 0.4: 创建类型声明文件（WebBridge API）

**文件**: `lib/types/webbridge.d.ts`（新建）  
**说明**: 这是整个迁移中最关键的类型定义，必须通过浏览器测试验证每个字段

```typescript
/**
 * Kimi WebBridge API 类型定义
 * 基于 browser.js 实际 HTTP 请求/响应验证
 * 所有字段必须与浏览器返回的 JSON 结构一致
 */

export interface WebBridgeRequest {
  action: string;
  args?: Record<string, unknown>;
  session?: string;
}

export interface WebBridgeResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface TabInfo {
  tabId: string;
  url: string;
  title?: string;
  active?: boolean;
}

export interface NavigateOptions {
  url: string;
  newTab?: boolean;
  group_title?: string;
}

export interface ScreenshotOptions {
  format?: 'png' | 'jpeg';
}

export type WebBridgeAction =
  | 'list_tabs'
  | 'find_tab'
  | 'navigate'
  | 'evaluate'
  | 'screenshot'
  | string;
```

**浏览器验证步骤**:
1. 启动浏览器，确保 WebBridge 连接
2. 运行 `node -e "const b = require('./lib/browser'); b.request('list_tabs').then(console.log)"`
3. 对比返回 JSON 与类型定义，如有差异立即修正

---

### Task 0.5: 提交 Phase 0

```bash
git add -A
git commit -m "Phase 0: TypeScript 基础设施

- 安装 typescript, @types/node, ts-mocha
- 创建 tsconfig.json (allowJs: true, strict: false)
- 更新 package.json scripts 支持 .ts
- 创建 WebBridge API 类型声明（待浏览器验证）

Refs: #23"
```

---

## Phase 1: 核心模块迁移（无浏览器依赖，预计 2-3 小时）

### Task 1.1: 迁移 config-schema.js → config-schema.ts

**文件**: `lib/config-schema.ts`（新建），`lib/config-schema.js`（保留或删除）  
**说明**: 这是最简单的迁移，纯数据 + 函数，无外部依赖

```typescript
export interface ConfigSchemaEntry {
  type: string;
  pattern?: RegExp;
  message?: string;
}

export interface ConfigSchema {
  [key: string]: ConfigSchemaEntry;
}

export const CONFIG_SCHEMA: ConfigSchema = {
  companyCode: {
    type: 'string',
    pattern: /^\d+$/,
    message: '公司代码应为纯数字',
  },
  taxCode: {
    type: 'string',
    pattern: /^[A-Z0-9]{15,20}$/i,
    message: '税号应为15-20位字母数字',
  },
  startDate: {
    type: 'date',
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    message: '日期格式应为 YYYY-MM-DD',
  },
  endDate: {
    type: 'date',
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    message: '日期格式应为 YYYY-MM-DD',
  },
  startPeriod: {
    type: 'string',
    pattern: /^\d{4}-\d{2}$/,
    message: '期间格式应为 YYYY-MM',
  },
  endPeriod: {
    type: 'string',
    pattern: /^\d{4}-\d{2}$/,
    message: '期间格式应为 YYYY-MM',
  },
  docStatus: { type: 'string' },
  voidStatus: { type: 'string' },
  docType: { type: 'string' },
  sellerCode: {
    type: 'string',
    pattern: /^[A-Z0-9]{15,20}$/i,
    message: '销方税号应为15-20位字母数字',
  },
};

export function validateConfigValue(key: string, value: unknown): string | null {
  const schema = CONFIG_SCHEMA[key];
  if (!schema) return null;
  if (value === null || value === undefined || value === '') return null;

  if (schema.pattern && !schema.pattern.test(String(value))) {
    return schema.message || `${key} 格式不正确: ${value}`;
  }
  return null;
}

export function validateConfig(config: Record<string, unknown>): string[] {
  const errors: string[] = [];
  for (const [key, value] of Object.entries(config)) {
    const error = validateConfigValue(key, value);
    if (error) errors.push(error);
  }
  return errors;
}
```

**验证**:
```bash
npm test -- test/unit/config-schema.test.js
# 预期: 通过
```

---

### Task 1.2: 迁移 config.js → config.ts

**文件**: `lib/config.ts`  
**关键类型**: `FipConfig` 接口，包含所有配置字段

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { validateConfigValue, validateConfig } from './config-schema';

export interface FipConfig {
  companyCode: string;
  taxCode: string;
  voidStatus: string;
  docStatus: string;
  docType: string;
  sellerCode: string;
  startDate: string;
  endDate: string;
  startPeriod: string;
  endPeriod: string;
  [key: string]: unknown;
}

export interface FipConfigWithValidation extends FipConfig {
  _validation: { errors: string[] };
}

export const CONFIG_FILE: string = path.join(os.homedir(), '.fiprc.json');
const LOCAL_CONFIG: string = path.join(process.cwd(), 'fip.config.json');

function getLastMonthRange(): {
  startDate: string;
  endDate: string;
  startPeriod: string;
  endPeriod: string;
} {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastMonth = month === 0 ? 12 : month;
  const lastMonthYear = month === 0 ? year - 1 : year;
  const mm = String(lastMonth).padStart(2, '0');
  const lastDay = new Date(lastMonthYear, lastMonth, 0).getDate();
  return {
    startDate: `${lastMonthYear}-${mm}-01`,
    endDate: `${lastMonthYear}-${mm}-${String(lastDay).padStart(2, '0')}`,
    startPeriod: `${lastMonthYear}-${mm}`,
    endPeriod: `${lastMonthYear}-${mm}`,
  };
}

const DEFAULTS: Omit<FipConfig, 'startDate' | 'endDate' | 'startPeriod' | 'endPeriod'> = {
  companyCode: '1000200020040011',
  taxCode: '91110000101638302P',
  voidStatus: '未作废',
  docStatus: '流程结束',
  docType: '预缴计算单',
  sellerCode: '91110000101638302P',
};

export function loadConfig(): FipConfig {
  let config: Record<string, unknown> = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      config = { ...config, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
    } catch (e) {
      console.error('Warning: Failed to parse ~/.fiprc.json');
    }
  }
  if (fs.existsSync(LOCAL_CONFIG)) {
    try {
      config = { ...config, ...JSON.parse(fs.readFileSync(LOCAL_CONFIG, 'utf8')) };
    } catch (e) {
      console.error('Warning: Failed to parse fip.config.json');
    }
  }
  const lastMonth = getLastMonthRange();
  return {
    ...DEFAULTS,
    startDate: lastMonth.startDate,
    endDate: lastMonth.endDate,
    startPeriod: lastMonth.startPeriod,
    endPeriod: lastMonth.endPeriod,
    ...config,
  } as FipConfig;
}

export function saveConfig(config: FipConfig): void {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function get(key?: string): FipConfig | FipConfigWithValidation | unknown {
  const config = loadConfig();
  if (key) {
    return config[key];
  }
  return {
    ...config,
    _validation: { errors: validateConfig(config) },
  } as FipConfigWithValidation;
}

export function set(key: string, value: unknown): FipConfig {
  const error = validateConfigValue(key, value);
  if (error) {
    throw new Error(`配置验证失败: ${error}`);
  }
  const config = loadConfig();
  (config as Record<string, unknown>)[key] = value;
  saveConfig(config);
  return config;
}
```

**验证**:
```bash
npm test -- test/unit/config.test.js
# 预期: 全部通过
```

---

### Task 1.3: 迁移 output.js → output.ts

**文件**: `lib/output.ts`  
**说明**: 输出格式化模块，无浏览器依赖

```typescript
export interface OutputResult<T = unknown> {
  ok: true;
  data: T;
}

export interface OutputError {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

export type OutputResponse<T = unknown> = OutputResult<T> | OutputError;

export function success<T>(data: T): OutputResult<T> {
  return { ok: true, data };
}

export function error(code: string, message: string): OutputError {
  return {
    ok: false,
    error: { code, message },
  };
}

export function print<T>(result: OutputResponse<T>): void {
  console.log(JSON.stringify(result, null, 2));
}
```

**验证**:
```bash
npm test -- test/unit/output.test.js
```

---

### Task 1.4: 迁移 logger.js → logger.ts

**文件**: `lib/logger.ts`  
**说明**: 日志模块，最简单

```typescript
const DEBUG = process.env.FIP_DEBUG === '1' || process.env.FIP_DEBUG === 'true';

export function debug(...args: unknown[]): void {
  if (DEBUG) {
    console.error('[fip-cli]', ...args);
  }
}

export function info(...args: unknown[]): void {
  console.log('[fip-cli]', ...args);
}

export function warn(...args: unknown[]): void {
  console.warn('[fip-cli]', ...args);
}
```

---

### Task 1.5: 迁移 fip.js → fip.ts

**文件**: `lib/fip.ts`  
**说明**: 入口封装模块

```typescript
export { loadConfig, saveConfig, get, set, CONFIG_FILE } from './config';
export { request, navigate, evaluate, screenshot, checkConnection, ensureConnection } from './browser';
export { success, error, print } from './output';
export { debug, info, warn } from './logger';
```

**验证**:
```bash
npm test
# 预期: 全部通过
```

---

### Task 1.6: 提交 Phase 1

```bash
git add -A
git commit -m "Phase 1: 核心模块 TypeScript 迁移

- config-schema.ts: 配置验证 schema + 类型
- config.ts: 配置管理 + FipConfig 接口
- output.ts: 输出格式化 + OutputResponse 联合类型
- logger.ts: 日志模块
- fip.ts: 统一导出

所有测试通过，0 failing。

Refs: #23"
```

---

## Phase 2: browser.js 迁移（需浏览器验证，预计 2-3 小时）

### Task 2.1: 迁移 browser.js → browser.ts

**文件**: `lib/browser.ts`  
**⚠️ 关键**: 这是唯一需要浏览器验证的模块。HTTP 请求/响应类型必须与浏览器实际返回一致。

```typescript
import * as http from 'http';
import { debug } from './logger';
import type { WebBridgeResponse, TabInfo, NavigateOptions, ScreenshotOptions } from './types/webbridge';

const BASE_URL = 'http://127.0.0.1:10086/command';
const SESSION = 'fip';

let connectionCheckPromise: Promise<boolean> | null = null;

function rawRequest<T = unknown>(
  action: string,
  args?: Record<string, unknown>,
  session = SESSION
): Promise<WebBridgeResponse<T>> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ action, args, session });
    debug('rawRequest: action=', action, 'args=', JSON.stringify(args));

    const req = http.request(
      BASE_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
        timeout: 15000,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk: string) => (body += chunk));
        res.on('end', () => {
          try {
            const result = JSON.parse(body) as WebBridgeResponse<T>;
            debug('rawRequest: action=', action, 'ok=', result.ok);
            resolve(result);
          } catch (e) {
            resolve({
              ok: false,
              error: { code: 'parse_error', message: body },
            });
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('WebBridge request timeout (15s)'));
    });

    req.on('error', (err: Error) => {
      reject(new Error(`WebBridge request failed: ${err.message}`));
    });

    req.write(data);
    req.end();
  });
}

export async function checkConnection(): Promise<boolean> {
  try {
    const result = await rawRequest('list_tabs');
    return result.ok === true;
  } catch (e) {
    return false;
  }
}

export async function ensureConnection(): Promise<void> {
  const connected = await checkConnection();
  if (!connected) {
    const error = new Error(
      'Kimi WebBridge 未连接。请执行以下步骤：\n' +
        '1. 检查浏览器扩展是否启用\n' +
        '2. 执行: C:/Users/40427/.kimi-webbridge/bin/kimi-webbridge.exe status\n' +
        '3. 如果未运行，执行: C:/Users/40427/.kimi-webbridge/bin/kimi-webbridge.exe start\n' +
        '4. 如果启动失败，执行: rm -f C:/Users/40427/.kimi-webbridge/*.pid && C:/Users/40427/.kimi-webbridge/bin/kimi-webbridge.exe start'
    );
    (error as NodeJS.ErrnoException).code = 'WEBBRIDGE_NOT_CONNECTED';
    throw error;
  }
}

export async function request<T = unknown>(
  action: string,
  args?: Record<string, unknown>,
  session = SESSION
): Promise<WebBridgeResponse<T>> {
  debug('request: action=', action);
  if (!connectionCheckPromise) {
    connectionCheckPromise = checkConnection();
  }
  const connectionOk = await connectionCheckPromise;
  if (!connectionOk) {
    throw new Error(
      'Kimi WebBridge 未连接。请执行: C:/Users/40427/.kimi-webbridge/bin/kimi-webbridge.exe start'
    );
  }
  const result = await rawRequest<T>(action, args, session);
  debug('request: action=', action, 'response ok=', result.ok);
  return result;
}

export async function navigate(url: string, newTab = true): Promise<WebBridgeResponse<TabInfo>> {
  debug('navigate: url=', url, 'newTab=', newTab);
  const tabResult = await request<TabInfo>('find_tab', {
    url: 'fip.cscec.com',
    active: false,
  });
  if (tabResult.ok && tabResult.data && tabResult.data.tabId) {
    return request<TabInfo>('find_tab', { url: 'fip.cscec.com', active: true });
  }
  return request<TabInfo>('navigate', { url, newTab, group_title: 'fip' });
}

export async function evaluate<T = unknown>(code: string): Promise<WebBridgeResponse<T>> {
  debug('evaluate: code length=', code.length);
  return request<T>('evaluate', { code });
}

export async function screenshot(format: 'png' | 'jpeg' = 'png'): Promise<WebBridgeResponse<string>> {
  return request<string>('screenshot', { format });
}
```

**浏览器验证步骤**（必须在提交前完成）:
1. 启动浏览器，确保 WebBridge 连接
2. 运行测试脚本验证每个函数:
   ```bash
   node -e "
   const b = require('./dist/lib/browser');
   b.checkConnection().then(c => console.log('connected:', c));
   b.request('list_tabs').then(r => console.log('list_tabs:', JSON.stringify(r, null, 2)));
   "
   ```
3. 对比返回 JSON 与 `WebBridgeResponse<T>` 类型，如有字段缺失/类型不符，立即修正
4. 运行 `npm test -- test/unit/browser.test.js`

---

### Task 2.2: 提交 Phase 2

```bash
git add -A
git commit -m "Phase 2: browser.js → browser.ts 迁移

- browser.ts: WebBridge HTTP 客户端 + 类型安全
- 类型定义经浏览器实际响应验证
- 所有测试通过

Refs: #23"
```

---

## Phase 3: utils 和辅助模块（预计 1-2 小时）

### Task 3.1-3.x: 逐个迁移 utils/ 下模块

**策略**: 逐个文件迁移，每文件后 `npm test`

**文件列表**（需读取实际内容后确定）:
- `lib/utils/navigation.js`
- `lib/utils/...`（其他辅助模块）

**通用模式**:
```typescript
// 对每个 utils 模块:
// 1. 重命名为 .ts
// 2. 添加函数参数/返回类型
// 3. 运行 npm test 验证
// 4. 通过后再下一个
```

---

## Phase 4: commands 模块（预计 3-5 小时）

### Task 4.1-4.x: 逐个迁移 commands 模块

**文件列表**:
- `lib/audit/*.js`
- `lib/bills/*.js`
- `lib/ledgers/*.js`

**策略**: 按依赖关系从叶子到根迁移，先无依赖的辅助模块，再主命令模块

---

## Phase 5: CLI 入口（预计 1-2 小时）

### Task 5.1: 迁移 bin/fip-cli.js → bin/fip-cli.ts

**文件**: `bin/fip-cli.ts`  
**说明**: 最后迁移，因为依赖所有其他模块

---

## Phase 6: 清理与严格模式（预计 1-2 小时）

### Task 6.1: 启用 checkJs

**文件**: `tsconfig.json`  
**修改**: `"checkJs": true`

**验证**:
```bash
npx tsc --noEmit
# 修复所有 JS 文件中的类型错误
```

---

### Task 6.2: 逐步启用 strict 选项

**文件**: `tsconfig.json`  
**分步启用**:
1. `"strictNullChecks": true`
2. `"noImplicitAny": true`
3. `"strictFunctionTypes": true`
4. 最后 `"strict": true`

每步后运行 `npx tsc --noEmit`，修复错误后再下一步

---

### Task 6.3: 移除 allowJs，全部 .ts

**文件**: `tsconfig.json`  
**修改**: `"allowJs": false`

**验证**:
```bash
npm test
npm run lint
npm run typecheck
# 全部通过
```

---

### Task 6.4: 最终提交

```bash
git add -A
git commit -m "Phase 6: TypeScript 迁移完成

- 全部模块转为 .ts
- 启用 strict 模式
- 所有测试通过
- lint 0 errors

Closes: #23"
```

---

## 验证矩阵

| 阶段 | 验证命令 | 通过标准 |
|------|---------|---------|
| Phase 0 | `npx tsc --noEmit` | 0 errors |
| Phase 0 | `npm test` | 192+ passing, 0 failing |
| Phase 1 | `npm test` | 全部通过 |
| Phase 2 | 浏览器实际测试 + `npm test` | HTTP 请求/响应类型与实际一致 |
| Phase 3-5 | `npm test` | 每文件后通过 |
| Phase 6 | `npm test && npm run lint && npm run typecheck` | 全部通过 |

---

## 风险与回滚

| 风险 | 缓解措施 |
|------|---------|
| 类型定义与实际浏览器响应不符 | 每涉 WebBridge 的模块必须浏览器验证 |
| ts-mocha 与现有测试不兼容 | Phase 0 先验证，不兼容则回滚到 mocha |
| strict 模式报错过多 | 分步启用，不一次性全开 |
| 某模块迁移后测试失败 | 该模块回滚到 .js，修复后再转 |

**回滚命令**:
```bash
# 回滚到迁移前状态
git checkout master

# 或丢弃当前分支所有改动
git checkout master
git branch -D typescript-migration
```
