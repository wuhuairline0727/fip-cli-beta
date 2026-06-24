import * as http from 'http';
import { debug } from './logger';
import type { WebBridgeRequest, WebBridgeResponse } from './types/webbridge';

const BASE_URL = 'http://127.0.0.1:10086/command';
const SESSION = 'fip';

let connectionCheckPromise: Promise<boolean> | null = null;

export interface WebBridgeError extends Error {
  code: string;
}

function rawRequest(
  action: string,
  args?: Record<string, unknown>,
  session: string = SESSION
): Promise<WebBridgeResponse> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ action, args, session } as WebBridgeRequest);
    debug('rawRequest: action=', action, 'args=', JSON.stringify(args));
    const req = http.request(
      BASE_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
        timeout: 30000,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const result = JSON.parse(body) as WebBridgeResponse;
            debug('rawRequest: action=', action, 'ok=', result.ok);
            resolve(result);
          } catch (_e) {
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
      reject(new Error('WebBridge request timeout (30s)'));
    });
    req.on('error', (err) => {
      reject(new Error(`WebBridge request failed: ${err.message}`));
    });
    req.write(data);
    req.end();
  });
}

/**
 * 检查 WebBridge 连接状态
 */
export async function checkConnection(): Promise<boolean> {
  try {
    const result = await rawRequest('list_tabs');
    return result.ok === true;
  } catch (_e) {
    return false;
  }
}

/**
 * 确保 WebBridge 已连接，未连接时抛出明确错误
 */
export async function ensureConnection(): Promise<void> {
  const connected = await checkConnection();
  if (!connected) {
    const error = new Error(
      'Kimi WebBridge 未连接。请执行以下步骤：\n' +
        '1. 检查浏览器扩展是否启用\n' +
        '2. 执行: <用户目录>/.kimi-webbridge/bin/kimi-webbridge.exe status\n' +
        '3. 如果未运行，执行: <用户目录>/.kimi-webbridge/bin/kimi-webbridge.exe start\n' +
        '4. 如果启动失败，执行: rm -f <用户目录>/.kimi-webbridge/*.pid && <用户目录>/.kimi-webbridge/bin/kimi-webbridge.exe start'
    ) as WebBridgeError;
    error.code = 'WEBBRIDGE_NOT_CONNECTED';
    throw error;
  }
}

export async function request(
  action: string,
  args?: Record<string, unknown>,
  session: string = SESSION
): Promise<WebBridgeResponse> {
  debug('request: action=', action);
  // 首次请求时检查连接，使用 Promise 锁避免竞态
  if (!connectionCheckPromise) {
    connectionCheckPromise = checkConnection();
  }
  const connectionOk = await connectionCheckPromise;
  if (!connectionOk) {
    connectionCheckPromise = null; // 重置，下次重新检查连接
    throw new Error(
      'Kimi WebBridge 未连接。请执行: <用户目录>/.kimi-webbridge/bin/kimi-webbridge.exe start'
    );
  }
  const result = await rawRequest(action, args, session);
  debug('request: action=', action, 'response ok=', result.ok);
  return result;
}

export async function navigate(
  url: string,
  newTab: boolean = true
): Promise<WebBridgeResponse> {
  debug('navigate: url=', url, 'newTab=', newTab);
  const tabResult = await request('find_tab', {
    url: 'fip.cscec.com',
    active: false,
  });
  if (
    tabResult.ok &&
    tabResult.data &&
    (tabResult.data as unknown as { tabId: string }).tabId
  ) {
    return request('find_tab', { url: 'fip.cscec.com', active: true });
  }
  return request('navigate', { url, newTab, group_title: 'fip' });
}

export async function evaluate(code: string): Promise<WebBridgeResponse<any>> {
  debug('evaluate: code length=', code.length);
  const result = await request('evaluate', { code });
  // WebBridge evaluate 返回 { ok: true, data: { type, value } }
  // 统一包装为 { ok: true, data: { value } } 以兼容测试断言
  if (result.ok && result.data && 'value' in result.data) {
    return { ok: true, data: { value: (result.data as any).value } };
  }
  return result;
}

export async function screenshot(
  format: string = 'png'
): Promise<WebBridgeResponse> {
  return request('screenshot', { format });
}
