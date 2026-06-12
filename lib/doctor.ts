import * as http from 'http';
import type { WebBridgeResponse, ListTabsData, TabInfo } from './types/webbridge';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const WEBBRIDGE_PORT = 10086;
const CDP_PORT = 9222;

interface CDPVersionResponse {
  Browser?: string;
  [key: string]: unknown;
}

export interface DiagnosticCheck {
  name: string;
  status: 'ok' | 'warn' | 'error' | 'skip';
  message: string;
  fix?: string;
}

export async function runDiagnostics(): Promise<DiagnosticCheck[]> {
  const checks: DiagnosticCheck[] = [];
  checks.push(checkNodeVersion());
  checks.push(checkDependencies());
  checks.push(await checkWebBridgeDaemon());
  checks.push(await checkCdpPort());
  checks.push(await checkFipConnection());
  checks.push(checkGitHubCli());
  return checks;
}

export function checkNodeVersion(): DiagnosticCheck {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0], 10);
  const required = 20;

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

export function checkDependencies(): DiagnosticCheck {
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

export async function checkWebBridgeDaemon(): Promise<DiagnosticCheck> {
  const isRunning = await isPortOpen(WEBBRIDGE_PORT);

  if (isRunning) {
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
    } catch (e: any) {
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

export async function checkCdpPort(): Promise<DiagnosticCheck> {
  const isOpen = await isPortOpen(CDP_PORT);

  if (isOpen) {
    try {
      const version = await cdpVersion();
      return {
        name: 'Chrome 远程调试',
        status: 'ok',
        message: `端口 ${CDP_PORT} 已开启（Chrome ${(version as CDPVersionResponse).Browser?.split('/')[1] || '未知版本'}）`,
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

export async function checkFipConnection(): Promise<DiagnosticCheck> {
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

    const listData = result.data as ListTabsData | undefined;
    const tabs = listData?.tabs ?? [];
    if (!Array.isArray(tabs) || tabs.length === 0) {
      return {
        name: 'FIP 登录状态',
        status: 'warn',
        message: '浏览器无打开的标签页',
        fix: '请在 Chrome 中打开 https://fip.cscec.com 并登录',
      };
    }

    const fipTab = tabs.find((t: TabInfo) => t.url.includes('fip.cscec.com'));

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
  } catch (e: any) {
    return {
      name: 'FIP 登录状态',
      status: 'warn',
      message: `检查失败: ${e.message}`,
      fix: '请确认 Kimi WebBridge 正常工作',
    };
  }
}

export function checkGitHubCli(): DiagnosticCheck {
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

function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/',
        method: 'GET',
        timeout: 2000,
      },
      () => {
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

function webBridgeRequest(action: string): Promise<WebBridgeResponse> {
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

function cdpVersion(): Promise<CDPVersionResponse> {
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

export function generateReport(checks: DiagnosticCheck[]): string {
  const lines: string[] = [];
  lines.push('');
  lines.push('╔══════════════════════════════════════════════════════════════╗');
  lines.push('║                    FIP CLI 诊断报告                          ║');
  lines.push('╚══════════════════════════════════════════════════════════════╝');
  lines.push('');

  const statusIcon: Record<string, string> = {
    ok: '✅',
    warn: '⚠️ ',
    error: '❌',
    skip: '⏭️ ',
  };

  let errorCount = 0;
  let warnCount = 0;

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

export function generateJsonReport(checks: DiagnosticCheck[]): { healthy: boolean; summary: Record<string, number>; checks: DiagnosticCheck[]; timestamp: string } {
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
