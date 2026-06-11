## 问题描述

`bin/fip-cli.js` 第 474 行在模块加载时执行 `const cfg = config.get()`，导致所有 commander option 的默认值被冻结在进程启动时刻：

```javascript
const cfg = config.get();   // ← 进程启动时执行一次

program
  .command('export-unbilled')
  .option('--start-period <period>', '起始税期 (YYYY-MM)', cfg.startPeriod)
  .option('--end-period <period>', '截止税期 (YYYY-MM)', cfg.endPeriod)
  // ... 所有 export-* 命令都用 cfg.xx 作为默认值
```

**影响**：用户在 shell 里执行 `fip-cli config set companyCode XXX` 后，**必须重启 CLI 进程**才能让新配置生效。同一进程内后续命令仍然使用旧值。

## 复现步骤

1. 启动 CLI 进程（或保持 Node.js REPL 长驻）
2. `fip-cli config set companyCode 1000200020040012`
3. `fip-cli export-unbilled` — 仍然使用旧的 `companyCode`

## 期望行为

每次命令执行时动态读取最新配置，或 commander 的 `defaultValue` 支持函数延迟求值。

## 修复方向

将 `config.get()` 调用挪到每个 action 函数内部：

```javascript
.option('--company-code <code>', '申请单位编码')  // 不传默认值
.action(async (options) => {
  const cfg = config.get();  // ← 运行时读取
  const companyCode = options.companyCode || cfg.companyCode;
  // ...
})
```

## 影响范围

- `export-unbilled`
- `export-input-transfer`
- `export-output-invoice`
- `export-passenger-transport`
- `export-vat-prepayment`
- `export-all`

---

**标签**: `bug`, `P0`, `config`
**文件**: `bin/fip-cli.js:474`
