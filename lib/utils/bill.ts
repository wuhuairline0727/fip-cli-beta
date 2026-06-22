import { evaluate } from '../browser';
import { sleep, escapeJsString } from './common';
import { cdpClick } from './cdp';
import { verbose } from '../logger';
import { waitAndDismissDialogs } from './dialog';

export interface OpenBillResult {
  opened: boolean;
  billId: string;
  url: string;
}

export async function openBill(
  billId: string,
  tabName: string | null = null
): Promise<OpenBillResult> {
  const tabsToSearch = tabName
    ? [tabName]
    : ['我的单据', '待办', '已办', '已办结'];

  for (const tab of tabsToSearch) {
    const safeTab = escapeJsString(tab);
    verbose(`切换到 "${tab}" 标签页...`);
    const tabCode = `
      (function() {
        var all = document.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
          if (all[i].textContent.trim() === '${safeTab}' && all[i].tagName === 'LABEL') {
            var rect = all[i].getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && rect.top < 150) {
              return { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
            }
          }
        }
        return null;
      })()
    `;
    const tabResult = await evaluate(tabCode);
    if (tabResult.data?.value) {
      const { x, y } = tabResult.data.value;
      await cdpClick(x, y, 1500);
    }

    const safeBillId = escapeJsString(billId);
    verbose(`输入单据编号 ${billId}...`);
    const inputCode = `
      (function() {
        var input = document.getElementById('FormTextInputDJBH-input');
        if (input) {
          input.value = '${safeBillId}';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          return { success: true };
        }
        return { success: false, reason: 'input_not_found' };
      })()
    `;
    const inputResult = await evaluate(inputCode);
    if (!inputResult.data?.value?.success) {
      verbose('未找到单据编号输入框，尝试直接查询...');
    }

    verbose('点击查询按钮...');
    const queryCode = `
      (function() {
        var all = document.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
          if (all[i].textContent.trim() === '查询') {
            var rect = all[i].getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && rect.top > 150) {
              return { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
            }
          }
        }
        return null;
      })()
    `;
    const queryResult = await evaluate(queryCode);
    if (queryResult.data?.value) {
      const { x, y } = queryResult.data.value;
      await cdpClick(x, y, 3000);
    }

    verbose(`查找单据 ${billId}...`);
    const openCode = `
      (function() {
        var rows = document.querySelectorAll('tr');
        for (var r = 0; r < rows.length; r++) {
          var rowRect = rows[r].getBoundingClientRect();
          if (rowRect.width > 0 && rowRect.height > 0 && rowRect.top > 200) {
            var rowText = rows[r].textContent.trim();
            if (rowText.includes('${safeBillId}')) {
              var links = rows[r].querySelectorAll('a, span, button');
              for (var l = 0; l < links.length; l++) {
                if (links[l].textContent.trim() === '打开单据') {
                  var rect = links[l].getBoundingClientRect();
                  if (rect.width > 0 && rect.height > 0) {
                    return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
                  }
                }
              }
            }
          }
        }
        return { found: false };
      })()
    `;
    const openResult = await evaluate(openCode);
    if (openResult.data?.value?.found) {
      const { x, y } = openResult.data.value;
      verbose(`使用 CDP 真实点击打开单据 ${billId}...`);
      await cdpClick(x, y, 5000);

      const urlCheck = await evaluate('location.href');
      const url = urlCheck.data?.value || '';
      if (url.includes('FLOW_')) {
        verbose(`单据 ${billId} 打开成功！`);
        return { opened: true, billId, url };
      }
    }
  }

  throw new Error(`未找到单据 ${billId}`);
}

export interface CloseBillResult {
  closed: boolean;
  url: string;
}

export async function closeBill(): Promise<CloseBillResult> {
  verbose('关闭单据详情页...');

  const closeCode = `
    (function() {
      var tabs = document.querySelectorAll('.ant-tabs-tab');
      for (var i = 0; i < tabs.length; i++) {
        var tabText = tabs[i].textContent.trim();
        if (tabText !== '首页' && tabText.length > 0) {
          var removeBtn = tabs[i].querySelector('.ant-tabs-tab-remove');
          if (removeBtn) {
            var rect = removeBtn.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2, tabName: tabText };
            }
          }
        }
      }
      var allRemove = document.querySelectorAll('.ant-tabs-tab-remove');
      for (var j = 0; j < allRemove.length; j++) {
        var r = allRemove[j].getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          return { found: true, x: r.left + r.width/2, y: r.top + r.height/2, tabName: 'unknown' };
        }
      }
      return { found: false, reason: 'no_close_button' };
    })()
  `;
  const result = await evaluate(closeCode);
  if (!result.data?.value?.found) {
    throw new Error('未找到关闭按钮');
  }
  const { x, y, tabName } = result.data.value;
  verbose(`点击 "${tabName}" 标签页的关闭按钮...`);
  await cdpClick(x, y, 3000);

  await waitAndDismissDialogs(5000, { waitAfterClose: 1500 });

  await sleep(2000);
  const urlCheck = await evaluate('location.href');
  const url = urlCheck.data?.value || '';
  const isHomePage =
    (url.includes('#/dashboard') || url.includes('CSCPortal.jsp')) &&
    !url.includes('FLOW_');
  if (isHomePage) {
    verbose('已返回首页');
    return { closed: true, url };
  }

  verbose('尝试浏览器返回...');
  await evaluate('history.back()');
  await sleep(3000);
  await waitAndDismissDialogs(5000, { waitAfterClose: 1500 });

  const urlCheck2 = await evaluate('location.href');
  const url2 = urlCheck2.data?.value || '';
  const isHomePage2 =
    (url2.includes('#/dashboard') || url2.includes('CSCPortal.jsp')) &&
    !url2.includes('FLOW_');
  if (isHomePage2) {
    verbose('已返回首页');
    return { closed: true, url: url2 };
  }

  throw new Error('关闭单据后未返回首页，当前URL: ' + url2);
}
