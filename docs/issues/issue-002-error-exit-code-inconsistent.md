> **注意**：本文档记录的是 JavaScript 版本时期的问题分析，当前项目已迁移至 TypeScript。文件路径已更新，但行号可能不准确。

## 问题描述

`lib/output.ts` 的 `error()` 函数在输出 JSON 后会 `throw err`，但 `bin/fip-cli.ts` 中每个 commander action 都用 `try/catch` 包裹：

```javascript
// lib/output.ts
async function error(code, message) {
  console.log(JSON.stringify({ ok: false, error: { code, message } }, null, 2));
  throw new Error(message);  // ← 抛出去
}

// bin/fip-cli.ts
.action(async (name) => {
  try {
    await fip.clickDashboardTab(name);
    success({ tab: name, switched: true });
  } catch (e) {
    error('tab_switch_error', e.message);  // ← 抛了又被 try/catch 吞掉
  }
});
```

**实际行为不一致**：

- `tab` 等简单命令：因 `error()` 的 throw 变成 unhandled rejection，**EXIT_CODE=1** ✅
- `export-all` 等命令：错误被封装在 JSON 结果中返回，**EXIT_CODE=0** ❌

```bash
$ fip-cli export-all --ledgers foo
# 输出: { ok: true, data: { results: { foo: { error: "Unknown ledger" } } } }
# EXIT_CODE=0 — 脚本无法判断失败
```

## 影响

- CI 脚本、自动化流程无法通过 `$?` 判断命令是否成功
- 部分成功部分失败的场景（如 `--ledgers unbilled,foo`）没有明确报错

## 修复方向（二选一）

**方案 A**：`error()` 不 throw，直接 `process.exit(1)`

```javascript
async function error(code, message) {
  // ... 输出 JSON ...
  process.exit(1);
}
```

**方案 B**：commander action 的 catch 中设置退出码

```javascript
} catch (e) {
  error('tab_switch_error', e.message);
  process.exitCode = 1;
}
```

## 影响范围

所有使用 `try/catch + error()` 模式的命令（约 30+ 个）。

---

**标签**: `bug`, `P0`, `cli`, `exit-code`
**文件**: `lib/output.ts:52`, `bin/fip-cli.ts` (多处)
