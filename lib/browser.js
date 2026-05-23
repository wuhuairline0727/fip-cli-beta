const http = require('http');

const BASE_URL = 'http://127.0.0.1:10086/command';
const SESSION = 'fip';

function request(action, args, session = SESSION) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ action, args, session });
    const req = http.request(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ ok: false, error: { code: 'parse_error', message: body } });
        }
      });
    });
    req.on('error', (err) => {
      reject(new Error(`WebBridge request failed: ${err.message}`));
    });
    req.write(data);
    req.end();
  });
}

async function navigate(url, newTab = true) {
  const tabResult = await request('find_tab', { url: 'fip.cscec.com', active: false });
  if (tabResult.ok && tabResult.data && tabResult.data.tabId) {
    return request('find_tab', { url: 'fip.cscec.com', active: true });
  }
  return request('navigate', { url, newTab, group_title: 'fip' });
}

async function evaluate(code) {
  return request('evaluate', { code });
}

async function screenshot(format = 'png') {
  return request('screenshot', { format });
}

module.exports = { request, navigate, evaluate, screenshot };
