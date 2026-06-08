const { evaluate } = require('../browser');
const { sleep } = require('./common');
const { cdpClick } = require('./cdp');

/**
 * 打开单据详情页
 * 在Dashboard列表中查找指定单据编号，点击"打开单据"链接
 * @param {string} billId - 单据编号，如 FK20042026052200347
 * @param {string} tabName - 标签页名称（待办/已办/已办结/我的单据），默认自动搜索
 */
async function openBill(billId, tabName = null) {
  const tabsToSearch = tabName ? [tabName] : ['我的单据', '待办', '已办', '已办结'];

  for (const tab of tabsToSearch) {
    console.log(`切换到 "${tab}" 标签页...`);
    const tabCode = `
      (function() {
        var all = document.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
          if (all[i].textContent.trim() === '${tab}' && all[i].tagName === 'LABEL') {
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

    // 输入单据编号到查询框
    console.log(`输入单据编号 ${billId}...`);
    const inputCode = `
      (function() {
        var input = document.getElementById('FormTextInputDJBH-input');
        if (input) {
          input.value = '${billId}';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          return { success: true };
        }
        return { success: false, reason: 'input_not_found' };
      })()
    `;
    const inputResult = await evaluate(inputCode);
    if (!inputResult.data?.value?.success) {
      console.log('未找到单据编号输入框，尝试直接查询...');
    }

    // 点击查询按钮
    console.log('点击查询按钮...');
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

    // 查找目标单据并获取"打开单据"链接坐标
    console.log(`查找单据 ${billId}...`);
    const openCode = `
      (function() {
        var rows = document.querySelectorAll('tr');
        for (var r = 0; r < rows.length; r++) {
          var rowRect = rows[r].getBoundingClientRect();
          if (rowRect.width > 0 && rowRect.height > 0 && rowRect.top > 200) {
            var rowText = rows[r].textContent.trim();
            if (rowText.includes('${billId}')) {
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
      console.log(`使用 CDP 真实点击打开单据 ${billId}...`);
      await cdpClick(x, y, 5000);

      // 验证是否打开成功
      const urlCheck = await evaluate('location.href');
      const url = urlCheck.data?.value || '';
      if (url.includes('FLOW_')) {
        console.log(`单据 ${billId} 打开成功！`);
        return { opened: true, billId, url };
      }
    }
  }

  throw new Error(`未找到单据 ${billId}`);
}

/**
 * 关闭当前单据详情页，返回Dashboard首页
 */
async function closeBill() {
  console.log('关闭单据详情页...');
  const closeCode = `
    (function() {
      var btn = document.querySelector('.ant-tabs-tab-remove');
      if (btn) {
        var rect = btn.getBoundingClientRect();
        return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
      }
      return { found: false, reason: 'no_close_button' };
    })()
  `;
  const result = await evaluate(closeCode);
  if (!result.data?.value?.found) {
    throw new Error('未找到关闭按钮');
  }
  const { x, y } = result.data.value;
  await cdpClick(x, y, 3000);

  // 验证是否回到首页
  const urlCheck = await evaluate('location.href');
  const url = urlCheck.data?.value || '';
  if (url.includes('#/dashboard')) {
    console.log('已返回首页');
    return { closed: true, url };
  }
  return { closed: true, url };
}

module.exports = { openBill, closeBill };
