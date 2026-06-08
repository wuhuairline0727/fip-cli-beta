const { evaluate } = require('../browser');
const CDP = require('chrome-remote-interface');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 公共辅助函数：通过文本查找可见元素坐标
 * @param {string} text - 要查找的文本
 * @param {Object} constraints - 位置约束条件 {leftMin, leftMax, topMin, topMax}
 * @returns {Promise<Object|null>} - 元素坐标或 null
 */
function escapeJsString(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
}

async function findVisibleElementByText(text, constraints = {}) {
  const { leftMin = 0, leftMax = 9999, topMin = 0, topMax = 9999 } = constraints;
  const safeText = escapeJsString(text);
  const code = `
    (function() {
      var all = document.querySelectorAll('*');
      for (var i = 0; i < all.length; i++) {
        if (all[i].textContent.trim() === '${safeText}') {
          var rect = all[i].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && rect.left > 0 &&
              rect.left >= ${leftMin} && rect.left <= ${leftMax} &&
              rect.top >= ${topMin} && rect.top <= ${topMax}) {
            return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
          }
        }
      }
      return { found: false };
    })()
  `;
  const result = await evaluate(code);
  return result?.data?.value?.found ? result.data.value : null;
}

/**
 * 获取页面信息
 */
async function getPageInfo() {
  const url = await evaluate('location.href');
  const title = await evaluate('document.title');
  // 检测当前激活的标签页（支持 ant-tabs 和 GWT 两种标签系统）
  const activeTab = await evaluate(`
    (function() {
      // 1. 检查 GWT 侧边栏标签
      const gwtTabs = document.querySelectorAll('.FD26IYC-z-f');
      for (const tab of gwtTabs) {
        if (tab.classList.contains('FD26IYC-z-p')) {
          return { type: 'gwt', name: tab.textContent.trim() };
        }
      }
      // 2. 检查 ant-tabs 标签
      const antTab = document.querySelector('.ant-tabs-tab-active');
      if (antTab) {
        return { type: 'ant', name: antTab.textContent.trim() };
      }
      return { type: 'unknown', name: 'none' };
    })()
  `);
  return {
    url: url.data?.value,
    title: title.data?.value,
    activeTab: activeTab.data?.value
  };
}
/**
 * 点击 Dashboard 子页签
 */
async function clickDashboardTab(tabName) {
  const code = `
    (function() {
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
      var candidates = [];
      var node;
      while (node = walker.nextNode()) {
        if (node.textContent.trim() === '${tabName}') {
          var el = node.parentElement;
          // 向上查找到可点击的父元素（LI 或包含 onclick 的元素）
          while (el && el !== document.body) {
            if (el.tagName === 'LI' || el.onclick || el.getAttribute('onclick') || el.classList.contains('ant-tabs-tab')) {
              break;
            }
            el = el.parentElement;
          }
          var rect = el.getBoundingClientRect();
          candidates.push({ el: el, x: rect.left + rect.width/2, y: rect.top + rect.height/2, top: rect.top });
        }
      }
      // 优先选择顶部标签页（y 坐标在 50-150 之间）
      var target = candidates.find(function(c) { return c.y > 50 && c.y < 150; });
      // 如果没有找到，选择 y 坐标最小的（最上方的）
      if (!target && candidates.length > 0) {
        target = candidates.reduce(function(prev, curr) { return prev.y < curr.y ? prev : curr; });
      }
      return target ? { x: target.x, y: target.y, found: true } : { found: false };
    })()
  `;
  const result = await evaluate(code);
  if (!result.ok || !result.data?.value?.found) {
    throw new Error(`Tab "${tabName}" not found`);
  }
  const { x, y } = result.data.value;

  // 使用 CDP 真实点击（GWT 标签页需要真实点击才能触发）
  await sleep(500);
  const client = await CDP({ port: 9222 });
  try {
    const { Input } = client;
    await Input.dispatchMouseEvent({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await Input.dispatchMouseEvent({ type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  } finally {
    await client.close();
  }

  await sleep(1500);
  return true;
}

/**
 * 点击查询按钮
 */
async function clickQueryButton() {
  const result = await findVisibleElementByText('查询');
  if (!result) {
    throw new Error('Query button not found');
  }
  await evaluate(`document.elementFromPoint(${result.x}, ${result.y}).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))`);
  await sleep(2000);
  return true;
}
/**
 * 获取表格行数
 */
async function getTableRowCount() {
  const code = `
    (function() {
      var allDivs = Array.from(document.querySelectorAll('div'));
      var rows = allDivs.filter(function(d) {
        var c = d.className || '';
        return typeof c === 'string' && c.indexOf('FD26IYC') !== -1 && d.children.length >= 5;
      });
      var visible = rows.filter(function(r) {
        var rect = r.getBoundingClientRect();
        return rect.width > 10 && rect.height > 10;
      });
      return { total: rows.length, visible: visible.length };
    })()
  `;
  const result = await evaluate(code);
  return result.data?.value || { total: 0, visible: 0 };
}

/**
 * 条件轮询：等待指定文本元素出现
 * @param {string} text - 要查找的文本
 * @param {Object} options - 选项 {timeout, interval, constraints}
 */
async function waitForElement(text, options = {}) {
  const { timeout = 10000, interval = 500, constraints = {} } = options;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const result = await findVisibleElementByText(text, constraints);
    if (result) {
      return { found: true, text, waited: Date.now() - start, coordinates: result };
    }
    await sleep(interval);
  }
  return { found: false, text, waited: Date.now() - start };
}

/**
 * 条件轮询：等待弹窗出现
 * @param {number} timeout - 超时毫秒数
 */
async function waitForPopup(timeout = 10000) {
  const start = Date.now();
  const interval = 500;
  while (Date.now() - start < timeout) {
    const check = await evaluate(`
      (function() {
        var popups = document.querySelectorAll('.FD26IYC-a-g, .gwt-DialogBox, [class*=DialogBox]');
        for (var i = 0; i < popups.length; i++) {
          var rect = popups[i].getBoundingClientRect();
          if (rect.left > 0 && rect.width > 0) return 'exists';
        }
        return 'none';
      })()
    `);
    if (check.data?.value === 'exists') {
      return { found: true, waited: Date.now() - start };
    }
    await sleep(interval);
  }
  return { found: false, waited: Date.now() - start };
}

/**
 * 条件轮询：等待 URL 匹配指定模式
 * @param {string|RegExp} pattern - URL 匹配模式
 * @param {number} timeout - 超时毫秒数
 */
async function waitForUrl(pattern, timeout = 10000) {
  const start = Date.now();
  const interval = 500;
  const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
  while (Date.now() - start < timeout) {
    const urlResult = await evaluate('location.href');
    const url = urlResult.data?.value || '';
    if (regex.test(url)) {
      return { matched: true, url, waited: Date.now() - start };
    }
    await sleep(interval);
  }
  return { matched: false, waited: Date.now() - start };
}

module.exports = {
  sleep, findVisibleElementByText, getPageInfo,
  clickDashboardTab, clickQueryButton, getTableRowCount,
  waitForElement, waitForPopup, waitForUrl
};
