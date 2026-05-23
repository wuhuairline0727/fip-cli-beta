const { evaluate } = require('../browser');
const { sleep } = require('./common');

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
      await evaluate(`document.elementFromPoint(${x}, ${y}).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))`);
      await sleep(1500);
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
      await evaluate(`document.elementFromPoint(${x}, ${y}).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))`);
      await sleep(3000);
    }

    // 查找目标单据并点击"打开单据"
    console.log(`查找单据 ${billId}...`);
    const openCode = `
      (function() {
        var rows = document.querySelectorAll('tr.FD26IYC-zb-l, tr.FD26IYC-P-d, tr.FD26IYC-O-l');
        for (var r = 0; r < rows.length; r++) {
          var rowRect = rows[r].getBoundingClientRect();
          if (rowRect.width > 0 && rowRect.height > 0 && rowRect.top > 200) {
            var rowText = rows[r].textContent.trim();
            if (rowText.includes('${billId}')) {
              var links = rows[r].querySelectorAll('a.anchor');
              for (var l = 0; l < links.length; l++) {
                if (links[l].textContent.trim() === '打开单据') {
                  var rect = links[l].getBoundingClientRect();
                  if (rect.width > 0 && rect.height > 0) {
                    var link = links[l];
                    link.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
                    link.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
                    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                    return { found: true, billId: '${billId}' };
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
      console.log(`已点击打开单据 ${billId}，等待页面加载...`);
      await sleep(5000);

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
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        return { closed: true };
      }
      return { closed: false, reason: 'no_close_button' };
    })()
  `;
  const result = await evaluate(closeCode);
  if (!result.data?.value?.closed) {
    throw new Error('未找到关闭按钮');
  }
  await sleep(3000);

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
