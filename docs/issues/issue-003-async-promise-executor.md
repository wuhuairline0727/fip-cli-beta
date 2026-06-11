## 问题描述

`lib/browser.js` 第 84 行使用 `new Promise(async executor)` 模式：

```javascript
function request(action, args, session = SESSION) {
  return new Promise(async (resolve, reject) => {
    debug('request: action=', action);
    if (!connectionCheckPromise) {
      connectionCheckPromise = checkConnection();
    }
    const connectionOk = await connectionCheckPromise;
    if (!connectionOk) {
      reject(new Error('Kimi WebBridge 未连接...'));
      return;
    }
    // ...
  });
}
```

**问题**：
1. `eslint.config.js` 中 `no-async-promise-executor` 被关闭就是为了绕过此问题
2. async executor 中如果出现同步语法错误 / 未捕获异常，错误会被吞掉（因为 Promise 已被 async 函数包裹）
3. 首次请求失败时，`connectionCheckPromise` 被永久污染，后续所有请求都复用同一个失败的 Promise

## 修复方向

重构为标准 `new Promise((resolve, reject) => { ... })`，把 async/await 逻辑挪出 executor：

```javascript
function request(action, args, session = SESSION) {
  return (async () => {
    debug('request: action=', action);
    if (!connectionCheckPromise) {
      connectionCheckPromise = checkConnection();
    }
    const connectionOk = await connectionCheckPromise;
    if (!connectionOk) {
      throw new Error('Kimi WebBridge 未连接...');
    }
    // ... 原有逻辑 ...
  })();
}
```

或直接使用 async 函数：

```javascript
async function request(action, args, session = SESSION) {
  debug('request: action=', action);
  if (!connectionCheckPromise) {
    connectionCheckPromise = checkConnection();
  }
  const connectionOk = await connectionCheckPromise;
  if (!connectionOk) {
    throw new Error('Kimi WebBridge 未连接...');
  }
  // ...
}
```

## 影响范围

- `lib/browser.js` 核心请求函数
- 所有通过 `browser.js` 发送的 WebBridge 请求

---

**标签**: `bug`, `P0`, `browser`, `promise`
**文件**: `lib/browser.js:84`
