## 问题描述

`lib/utils/cdp.js:39-49` 的 `cdpClick` 在 `mousePressed` + `mouseReleased` 之后，又通过 `Runtime.evaluate` 注入一次 `dispatchEvent('click')`：

```javascript
await Input.dispatchMouseEvent({ type: 'mousePressed', ... });
await Input.dispatchMouseEvent({ type: 'mouseReleased', ... });
// 又注入一次 click 事件
await Runtime.evaluate({
  expression: `
    (function() {
      var el = document.elementFromPoint(${x}, ${y});
      if (el) {
        el.dispatchEvent(new MouseEvent('click', ...));
      }
    })()
  `,
});
```

问题：
- `mousePressed` + `mouseReleased` 已构成浏览器层面的 click
- 再注入一次 click 事件是**双重触发**
- GWT 应用对重复 click 可能产生"已点击"又"再次点击"行为（如复选框被切换两次）
- 注释 "GWT 需要" 可能是旧版本兼容代码，当前 Chrome 149 + GWT 2026 可能已不需要

## 复现步骤

1. 观察任何使用 `cdpClick` 的 GWT 交互
2. 在浏览器 DevTools Event Listeners 中可看到同一元素触发两次 click

## 修复方向

1. 验证去掉 `Runtime.evaluate` 部分是否仍能正常工作
2. 如果不能，至少在日志里说明双重触发是故意的
3. 考虑改为条件触发（仅在 GWT 旧版本需要时启用）

## 优先级

P1 — 建议修复（影响功能正确性）

---
*扫描时间*: 2026-06-11 23:29 (Asia/Shanghai)
*扫描来源*: fip-cli 系统性 bug 扫描
