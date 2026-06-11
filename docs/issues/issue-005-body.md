## 问题描述

`lib/config.js` 第 25 行在模块加载时计算 `lastMonth`：

```javascript
const lastMonth = getLastMonthRange();   // ← 模块加载时算一次

const DEFAULTS = {
  startDate: lastMonth.startDate,        // ← 冻结在启动时刻
  endDate: lastMonth.endDate,
  startPeriod: lastMonth.startPeriod,
  endPeriod: lastMonth.endPeriod,
  // ...
};
```

## 影响

- CLI 是短进程，当前影响**极小**
- 但如果未来引入长驻模式（如 daemon 或 REPL），跨月时默认值不会刷新
- 例如：6 月 1 日 0 点启动 daemon，7 月时 startDate 仍然是 5 月 1 日

## 修复方向

把 `getLastMonthRange()` 调用挪进 `get()` 函数内部，每次调用时动态计算：

```javascript
function get() {
  const lastMonth = getLastMonthRange();  // ← 运行时计算
  return {
    ...DEFAULTS,  // 不含日期字段的静态默认值
    startDate: lastMonth.startDate,
    endDate: lastMonth.endDate,
    startPeriod: lastMonth.startPeriod,
    endPeriod: lastMonth.endPeriod,
    ...userConfig,
  };
}
```

## 优先级

低 — 当前 CLI 短进程模式下无实际影响，属于防御性修复。

---

**标签**: `enhancement`, `config`
**文件**: `lib/config.js:25`
