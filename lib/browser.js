const http = require('http');
const { debug } = require('./logger');

const BASE_URL = 'http://127.0.0.1:10086/command';
const SESSION = 'fip';

let connectionCheckPromise = null;

function rawRequest(action, args, session = SESSION) {
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
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const result = JSON.parse(body);
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
    req.on('error', (err) => {
      reject(new Error(`WebBridge request failed: ${err.message}`));
    });
    req.write(data);
    req.end();
  });
}

/**
 * 检查 WebBridge 连接状态
 * @returns {Promise<boolean>}
 */
async function checkConnection() {
  try {
    const result = await rawRequest('list_tabs');
    return result.ok === true;
  } catch (e) {
    return false;
  }
}

/**
 * 确保 WebBridge 已连接，未连接时抛出明确错误
 */
async function ensureConnection() {
  const connected = await checkConnection();
  if (!connected) {
    const error = new Error(
      'Kimi WebBridge 未连接。请执行以下步骤：\n' +
        '1. 检查浏览器扩展是否启用\n' +
        '2. 执行: C:/Users/40427/.kimi-webbridge/bin/kimi-webbridge.exe status\n' +
        '3. 如果未运行，执行: C:/Users/40427/.kimi-webbridge/bin/kimi-webbridge.exe start\n' +
        '4. 如果启动失败，执行: rm -f C:/Users/40427/.kimi-webbridge/*.pid && C:/Users/40427/.kimi-webbridge/bin/kimi-webbridge.exe start'
    );
    error.code = 'WEBBRIDGE_NOT_CONNECTED';
    throw error;
  }
}

async function request(action, args, session = SESSION) {
  debug('request: action=', action);
  // 首次请求时检查连接，使用 Promise 锁避免竞态
  if (!connectionCheckPromise) {
    connectionCheckPromise = checkConnection();
  }
  const connectionOk = await connectionCheckPromise;
  if (!connectionOk) {
    throw new Error(
      'Kimi WebBridge 未连接。请执行: C:/Users/40427/.kimi-webbridge/bin/kimi-webbridge.exe start'
    );
  }
  const result = await rawRequest(action, args, session);
  debug('request: action=', action, 'response ok=', result.ok);
  return result;
}

async function navigate(url, newTab = true) {
  debug('navigate: url=', url, 'newTab=', newTab);
  const tabResult = await request('find_tab', {
    url: 'fip.cscec.com',
    active: false,
  });
  if (tabResult.ok && tabResult.data && tabResult.data.tabId) {
    return request('find_tab', { url: 'fip.cscec.com', active: true });
  }
  return request('navigate', { url, newTab, group_title: 'fip' });
}

async function evaluate(code) {
  debug('evaluate: code length=', code.length);
  return request('evaluate', { code });
}

async function screenshot(format = 'png') {
  return request('screenshot', { format });
}

module.exports = {
  request,
  navigate,
  evaluate,
  screenshot,
  checkConnection,
  ensureConnection,
};
