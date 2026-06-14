import { evaluate } from '../browser';
import CDP from 'chrome-remote-interface';

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function escapeJsString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

export interface ElementConstraints {
  leftMin?: number;
  leftMax?: number;
  topMin?: number;
  topMax?: number;
}

export interface FoundElement {
  found: boolean;
  x?: number;
  y?: number;
}

export async function findVisibleElementByText(
  text: string,
  constraints: ElementConstraints = {}
): Promise<FoundElement | null> {
  const {
    leftMin = 0,
    leftMax = 9999,
    topMin = 0,
    topMax = 9999,
  } = constraints;
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

export interface PageInfo {
  url?: string;
  title?: string;
  activeTab?: { type: string; name: string };
}

export async function getPageInfo(): Promise<PageInfo> {
  const url = await evaluate('location.href');
  const title = await evaluate('document.title');
  const activeTab = await evaluate(`
    (function() {
      const gwtTabs = document.querySelectorAll('.FD26IYC-z-f');
      for (const tab of gwtTabs) {
        if (tab.classList.contains('FD26IYC-z-p')) {
          return { type: 'gwt', name: tab.textContent.trim() };
        }
      }
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
    activeTab: activeTab.data?.value,
  };
}

export async function clickDashboardTab(tabName: string): Promise<boolean> {
  const code = `
    (function() {
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
      var candidates = [];
      var node;
      while (node = walker.nextNode()) {
        if (node.textContent.trim() === '${tabName}') {
          var el = node.parentElement;
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
      var target = candidates.find(function(c) { return c.y > 50 && c.y < 150; });
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

  await sleep(500);
  const client = await CDP({ port: 9222 });
  try {
    const { Input } = client;
    await Input.dispatchMouseEvent({
      type: 'mousePressed',
      x,
      y,
      button: 'left',
      clickCount: 1,
    });
    await Input.dispatchMouseEvent({
      type: 'mouseReleased',
      x,
      y,
      button: 'left',
      clickCount: 1,
    });
  } finally {
    await client.close();
  }

  await sleep(1500);
  return true;
}

export async function clickQueryButton(): Promise<boolean> {
  const result = await findVisibleElementByText('查询');
  if (!result) {
    throw new Error('Query button not found');
  }
  await evaluate(
    `document.elementFromPoint(${result.x}, ${result.y}).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))`
  );
  await sleep(2000);
  return true;
}

export interface TableRowCount {
  total: number;
  visible: number;
}

export async function getTableRowCount(): Promise<TableRowCount> {
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

export interface WaitForElementResult {
  found: boolean;
  text: string;
  waited: number;
  coordinates?: FoundElement;
}

export async function waitForElement(
  text: string,
  options: {
    timeout?: number;
    interval?: number;
    constraints?: ElementConstraints;
  } = {}
): Promise<WaitForElementResult> {
  const { timeout = 10000, interval = 500, constraints = {} } = options;
  const start = Date.now();
  let currentInterval = Math.min(100, interval);
  while (Date.now() - start < timeout) {
    const result = await findVisibleElementByText(text, constraints);
    if (result) {
      return {
        found: true,
        text,
        waited: Date.now() - start,
        coordinates: result,
      };
    }
    await sleep(currentInterval);
    currentInterval = Math.min(currentInterval * 2, interval);
  }
  return { found: false, text, waited: Date.now() - start };
}

export interface WaitForPopupResult {
  found: boolean;
  waited: number;
}

export async function waitForPopup(
  timeout = 10000
): Promise<WaitForPopupResult> {
  const start = Date.now();
  let interval = 100;
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
    interval = Math.min(interval * 2, 500);
  }
  return { found: false, waited: Date.now() - start };
}

export interface WaitForUrlResult {
  matched: boolean;
  url?: string;
  waited: number;
}

export async function waitForUrl(
  pattern: string | RegExp,
  timeout = 10000
): Promise<WaitForUrlResult> {
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
