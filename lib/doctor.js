const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WEBBRIDGE_PORT = 10086;
const CDP_PORT = 9222;

/**
 * 执行检查并返回结果
 * @returns {Promise<Array>} 检查结果数组
 */
async function runDiagnostics() {
  const checks = [];

  // 1. Node.js 版本
  checks.push(checkNodeVersion());

  // 2. 项目依赖
  checks.push(checkDependencies());

  // 3. Kimi WebBridge 守护进程
  checks.push(await checkWebBridgeDaemon());

  // 4. Chrome 远程调试端口
  checks.push(await checkCdpPort());

  // 5. FIP 网站连接状态
  checks.push(await checkFipConnection());

  // 6. GitHub CLI（可选）
  checks.push(checkGitHubCli());

  return checks;
}

/**
 * 检查 Node.js 版本
 */
function checkNodeVersion() {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0], 10);
  const required = 16;

  if (major >= required) {
    return {
      name: 'Node.js 版本',
      status: 'ok',
      message: `当前版本 ${version}（要求 >= v${required}）`,
    };
  }
  return {
    name: 'Node.js 版本',
    status: 'error',
    message: `当前版本 ${version}，要求 >= v${required}`,
    fix: '请升级 Node.js: https://nodejs.org',
  };
}

/**
 * 检查项目依赖
 */
function checkDependencies() {
  const projectRoot = path.resolve(__dirname, '..');
  const nodeModules = path.join(projectRoot, 'node_modules');

  if (!fs.existsSync(nodeModules)) {
    return {
      name: '项目依赖',
      status: 'error',
      message: 'node_modules 不存在',
      fix: `cd "${projectRoot}" && npm install`,
    };
  }

  const required = ['commander', 'chrome-remote-interface'];
  const missing = [];
  for (const pkg of required) {
    if (!fs.existsSync(path.join(nodeModules, pkg))) {
      missing.push(pkg);
    }
  }

  if (missing.length > 0) {
    return {
      name: '项目依赖',
      status: 'error',
      message: `缺少依赖: ${missing.join(', ')}`,
      fix: `cd "${projectRoot}" && npm install`,
    };
  }

  return {
    name: '项目依赖',
    status: 'ok',
    message: `所有依赖已安装（${required.join(', ')}）`,
  };
}

/**
 * 检查 Kimi WebBridge 守护进程
 */
async function checkWebBridgeDaemon() {
  const isRunning = await isPortOpen(WEBBRIDGE_PORT);

  if (isRunning) {
    // 进一步检查是否能响应请求
    try {
      const result = await webBridgeRequest('list_tabs');
      if (result.ok) {
        return {
          name: 'Kimi WebBridge',
          status: 'ok',
          message: `守护进程运行中（端口 ${WEBBRIDGE_PORT}），响应正常`,
        };
      }
      return {
        name: 'Kimi WebBridge',
        status: 'warn',
        message: `端口 ${WEBBRIDGE_PORT} 可连接但响应异常`,
        fix: '尝试重启守护进程: C:\\Users\\<用户名>\\.kimi-webbridge\\bin\\kimi-webbridge.exe restart',
      };
    } catch (e) {
      return {
        name: 'Kimi WebBridge',
        status: 'warn',
        message: `端口 ${WEBBRIDGE_PORT} 可连接但请求失败: ${e.message}`,
        fix: '尝试重启守护进程: C:\\Users\\<用户名>\\.kimi-webbridge\\bin\\kimi-webbridge.exe restart',
      };
    }
  }

  return {
    name: 'Kimi WebBridge',
    status: 'error',
    message: `守护进程未运行（端口 ${WEBBRIDGE_PORT} 无响应）`,
    fix:
      '1. 确认 Kimi WebBridge 浏览器扩展已启用\n' +
      '2. 启动守护进程: C:\\Users\\<用户名>\\.kimi-webbridge\\bin\\kimi-webbridge.exe start\n' +
      '3. 检查状态: C:\\Users\\<用户名>\\.kimi-webbridge\\bin\\kimi-webbridge.exe status',
  };
}

/**
 * 检查 Chrome 远程调试端口
 */
async function checkCdpPort() {
  const isOpen = await isPortOpen(CDP_PORT);

  if (isOpen) {
    // 尝试获取版本信息验证
    try {
      const version = await cdpVersion();
      return {
        name: 'Chrome 远程调试',
        status: 'ok',
        message: `端口 ${CDP_PORT} 已开启（Chrome ${version.Browser?.split('/')[1] || '未知版本'}）`,
      };
    } catch (e) {
      return {
        name: 'Chrome 远程调试',
        status: 'ok',
        message: `端口 ${CDP_PORT} 已开启`,
      };
    }
  }

  return {
    name: 'Chrome 远程调试',
    status: 'warn',
    message: `端口 ${CDP_PORT} 未开启，CDP 真实点击功能将不可用`,
    fix:
      '1. 关闭所有 Chrome 窗口\n' +
      '2. 命令行启动: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222\n' +
      '3. 或为 Chrome 快捷方式添加启动参数: --remote-debugging-port=9222',
  };
}

/**
 * 检查 FIP 网站连接状态
 */
async function checkFipConnection() {
  // 先检查 WebBridge 是否可用
  const wbOk = await isPortOpen(WEBBRIDGE_PORT);
  if (!wbOk) {
    return {
      name: 'FIP 登录状态',
      status: 'skip',
      message: '跳过（Kimi WebBridge 未连接）',
    };
  }

  try {
    const result = await webBridgeRequest('list_tabs');
    if (!result.ok) {
      return {
        name: 'FIP 登录状态',
        status: 'warn',
        message: 'WebBridge 响应异常',
        fix: '尝试重启守护进程: C:\\Users\\<用户名>\\.kimi-webbridge\\bin\\kimi-webbridge.exe restart',
      };
    }

    // WebBridge 返回结构: { ok: true, data: { success: true, tabs: [...] } }
    const tabs = result.data && result.data.tabs ? result.data.tabs : [];
    if (!Array.isArray(tabs) || tabs.length === 0) {
      return {
        name: 'FIP 登录状态',
        status: 'warn',
        message: '浏览器无打开的标签页',
        fix: '请在 Chrome 中打开 https://fip.cscec.com 并登录',
      };
    }

    const fipTab = tabs.find((t) => t.url && t.url.includes('fip.cscec.com'));

    if (!fipTab) {
      return {
        name: 'FIP 登录状态',
        status: 'warn',
        message: '浏览器未打开 FIP 网站',
        fix: '请在 Chrome 中打开 https://fip.cscec.com 并登录',
      };
    }

    if (fipTab.url.includes('login') || fipTab.url.includes('Login')) {
      return {
        name: 'FIP 登录状态',
        status: 'warn',
        message: 'FIP 网站处于登录页面，尚未登录',
        fix: '请在浏览器中完成登录',
      };
    }

    return {
      name: 'FIP 登录状态',
      status: 'ok',
      message: `已登录（${fipTab.title || 'FIP'}）`,
    };
  } catch (e) {
    return {
      name: 'FIP 登录状态',
      status: 'warn',
      message: `检查失败: ${e.message}`,
      fix: '请确认 Kimi WebBridge 正常工作',
    };
  }
}

/**
 * 检查 GitHub CLI（可选）
 */
function checkGitHubCli() {
  try {
    const version = execSync('gh --version', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    const line = version.split('\n')[0];
    return {
      name: 'GitHub CLI',
      status: 'ok',
      message: `已安装（${line}）`,
    };
  } catch (e) {
    return {
      name: 'GitHub CLI',
      status: 'warn',
      message: '未安装（可选依赖，用于仓库管理）',
      fix: '安装: winget install --id GitHub.cli 或 https://cli.github.com',
    };
  }
}

// ==================== 工具函数 ====================

/**
 * 检查端口是否开放
 */
function isPortOpen(port) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/',
        method: 'GET',
        timeout: 2000,
      },
      (res) => {
        resolve(true);
        req.destroy();
      }
    );
    req.on('error', () => {
      resolve(false);
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

/**
 * 向 WebBridge 发送请求
 */
function webBridgeRequest(action) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ action, args: {}, session: 'fip' });
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: WEBBRIDGE_PORT,
        path: '/command',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
        timeout: 5000,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error('解析响应失败'));
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });
    req.write(data);
    req.end();
  });
}

/**
 * 获取 CDP 版本信息
 */
function cdpVersion() {
  return new Promise((resolve, reject) => {
    const req = http.get(
      {
        hostname: '127.0.0.1',
        port: CDP_PORT,
        path: '/json/version',
        timeout: 3000,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('超时'));
    });
  });
}

/**
 * 生成诊断报告文本
 */
function generateReport(checks) {
  const lines = [];
  lines.push('');
  lines.push(
    '╔══════════════════════════════════════════════════════════════╗'
  );
  lines.push(
    '║                    FIP CLI 诊断报告                          ║'
  );
  lines.push(
    '╚══════════════════════════════════════════════════════════════╝'
  );
  lines.push('');

  const statusIcon = {
    ok: '✅',
    warn: '⚠️ ',
    error: '❌',
    skip: '⏭️ ',
  };

  let errorCount = 0;
  let warnCount = 0;
  const fixes = [];

  for (const check of checks) {
    const icon = statusIcon[check.status] || '❓';
    lines.push(`${icon} ${check.name}`);
    lines.push(`   ${check.message}`);
    if (check.fix) {
      lines.push(`   💡 修复: ${check.fix.split('\n').join('\n      ')}`);
      if (check.status === 'error') errorCount++;
      if (check.status === 'warn') warnCount++;
    }
    lines.push('');
  }

  // 汇总
  lines.push('──────────────────────────────────────────────────────────────');
  if (errorCount === 0 && warnCount === 0) {
    lines.push('🎉 所有检查通过，环境就绪！');
  } else {
    lines.push(`📊 汇总: ${errorCount} 个错误, ${warnCount} 个警告`);
    if (errorCount > 0) {
      lines.push('');
      lines.push('🔧 建议按以下顺序修复:');
      let idx = 1;
      for (const check of checks) {
        if (check.status === 'error' && check.fix) {
          lines.push(`${idx}. ${check.name}`);
          lines.push(`   ${check.fix.split('\n').join('\n   ')}`);
          idx++;
        }
      }
    }
  }
  lines.push('──────────────────────────────────────────────────────────────');

  return lines.join('\n');
}

/**
 * 生成 JSON 格式报告
 */
function generateJsonReport(checks) {
  const summary = {
    ok: checks.filter((c) => c.status === 'ok').length,
    warn: checks.filter((c) => c.status === 'warn').length,
    error: checks.filter((c) => c.status === 'error').length,
    skip: checks.filter((c) => c.status === 'skip').length,
  };
  return {
    healthy: summary.error === 0,
    summary,
    checks,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  runDiagnostics,
  checkNodeVersion,
  checkDependencies,
  generateReport,
  generateJsonReport,
};
