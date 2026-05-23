const { evaluate } = require('../browser');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 公共辅助函数：通过文本查找可见元素坐标
 * @param {string} text - 要查找的文本
 * @param {Object} constraints - 位置约束条件 {leftMin, leftMax, topMin, topMax}
 * @returns {Promise<Object|null>} - 元素坐标或 null
 */
async function findVisibleElementByText(text, constraints = {}) {
  const { leftMin = 0, leftMax = 9999, topMin = 0, topMax = 9999 } = constraints;
  const code = `
    (function() {
      var all = document.querySelectorAll('*');
      for (var i = 0; i < all.length; i++) {
        if (all[i].textContent.trim() === '${text}') {
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
  const [url, title] = await Promise.all([
    evaluate('location.href'),
    evaluate('document.title')
  ]);
  return {
    url: url.data?.value,
    title: title.data?.value
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
          var rect = node.parentElement.getBoundingClientRect();
          candidates.push({ x: rect.left + rect.width/2, y: rect.top + rect.height/2, top: rect.top });
        }
      }
      var target = candidates.find(function(c) { return c.y > 150; });
      if (!target && candidates.length > 0) target = candidates[0];
      return target ? { x: target.x, y: target.y, found: true } : { found: false };
    })()
  `;
  const result = await evaluate(code);
  if (!result.ok || !result.data?.value?.found) {
    throw new Error(`Tab "${tabName}" not found`);
  }
  const { x, y } = result.data.value;
  await evaluate(`document.elementFromPoint(${x}, ${y}).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))`);
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
