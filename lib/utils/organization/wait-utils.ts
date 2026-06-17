/**
 * 集中超时管理工具
 * 替代 organization.ts 中分散的 setTimeout 硬编码等待
 */

interface DomElement {
  getBoundingClientRect(): { width: number };
}

/**
 * 等待 DOM 条件满足
 * 替代所有 `await new Promise((r) => setTimeout(r, XXXX))` 的固定等待
 */
export async function waitForDomStable(
  condition: () => DomElement | null,
  timeout: number
): Promise<DomElement> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = condition();
    if (el && el.getBoundingClientRect().width > 0) {
      return el;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`DOM 条件未在 ${timeout}ms 内满足`);
}

export interface WaitOptions {
  timeout: number; // 总超时时间（毫秒）
  interval: number; // 轮询间隔（毫秒）
  onTimeout?: () => void; // 超时回调
}

/**
 * 轮询等待条件满足
 * 替代所有 `while (attempts < 10) { await sleep(500); ... }` 的硬编码轮询
 */
export async function pollForCondition<T>(
  condition: () => Promise<T | null>,
  options: WaitOptions
): Promise<T> {
  const start = Date.now();
  let interval = options.interval;
  while (Date.now() - start < options.timeout) {
    const result = await condition();
    if (result) return result;
    await new Promise((r) => setTimeout(r, interval));
    interval = Math.min(interval * 2, 1000); // 指数退避，最多 1 秒
  }
  if (options.onTimeout) options.onTimeout();
  throw new Error(`条件未在 ${options.timeout}ms 内满足`);
}
