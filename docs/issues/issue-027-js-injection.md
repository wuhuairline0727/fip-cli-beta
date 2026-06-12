## 问题描述

`lib/ledgers/unbilled-income.js:149` 将用户输入的 `voidStatus` 直接拼接到浏览器端执行的 JavaScript 字符串中：

```javascript
return el.textContent.trim() === '${opts.voidStatus}';
```

`voidStatus` 来自 CLI 参数（`--void-status`），虽然当前默认值为中文枚举（未作废/已作废），实际注入风险极低，但如果未来支持任意文本输入，字符串中的 `'` 或 `</script>` 会破坏 JS 字符串结构。

## 复现步骤

1. 运行 `fip-cli export-unbilled --void-status "未作废'"`（含单引号）
2. 浏览器端执行代码会因 JS 语法错误而失败

## 影响范围

- `lib/ledgers/unbilled-income.js:149`
- 类似模式可能存在于其他 ledger 文件的 JS 字符串拼接处

## 修复方向

1. 统一封装 `escapeJsString()` 工具函数，对所有 `${userInput}` 拼接前进行转义
2. 或改用 CDP `Runtime.evaluate` 的 `args` 参数传递（避免字符串拼接）

## 优先级

P1 — 建议修复（低危但需预防）

---

_扫描时间_: 2026-06-11 23:29 (Asia/Shanghai)
_扫描来源_: fip-cli 系统性 bug 扫描
