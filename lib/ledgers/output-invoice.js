const {
  sleep, getTableRowCount, openSideMenu, clickDrawerItem,
  clickShowQuery, setDateRange, setTaxPeriod, clickPickerButton,
  pickFromDict, pickTaxSubject, closeBill,
  cdpEvaluateAndClick, cdpEvaluate, cdpClick
} = require('../utils/index');
const config = require('../config');

async function exportOutputInvoiceLedger(options = {}) {
  const cfg = config.get();
  const defaults = {
    startDate: cfg.startDate || '2026-04-01',
    endDate: cfg.endDate || '2026-04-30',
    companyCode: cfg.companyCode || '1000200020040011',
    sellerCode: cfg.sellerCode || '91110000101638302P',
    queryOnly: false
  };
  const opts = { ...defaults, ...options };

  if (opts.queryOnly) {
    console.log('开始销项发票明细台账查询...');
  } else {
    console.log('开始销项发票明细台账查询导出...');
  }

  // 1. 导航至销项发票台账
  console.log('1. 打开税务系统菜单...');
  await openSideMenu('税务系统');
  await sleep(1000);

  console.log('2. 点击税务台账...');
  await clickDrawerItem('税务台账');
  await sleep(1000);

  console.log('3. 点击销项发票台账...');
  await clickDrawerItem('销项发票台账');
  await sleep(2000);

  // 2. 检查页面是否已有查询表单（避免重复选择单选按钮）
  const hasQueryForm = await cdpEvaluate(`
    (function() {
      return !!document.getElementById('JINX_IPT_START-input');
    })()
  `);

  if (!hasQueryForm) {
    // 页面没有查询表单，需要选择单选按钮
    console.log('4. 选择销项发票明细台账...');
    const radioResult = await cdpEvaluate(`
      (function() {
        var all = document.querySelectorAll('*');
        var target = null;
        for (var i = 0; i < all.length; i++) {
          if (all[i].textContent.trim() === '销项发票明细台账') {
            var rect = all[i].getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && rect.left > 400) {
              target = all[i];
              break;
            }
          }
        }
        if (target) {
          var rect = target.getBoundingClientRect();
          return { success: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2, tag: target.tagName };
        }
        return { success: false, reason: 'element not found' };
      })()
    `);

    if (!radioResult?.success) {
      throw new Error('Failed to select 销项发票明细台账: ' + (radioResult?.reason || 'unknown'));
    }

    await cdpClick(radioResult.x, radioResult.y, 1500);
    console.log('已点击销项发票明细台账:', radioResult.tag);

    // 等待弹窗出现并点击查询按钮
    console.log('等待弹窗出现...');
    let popupClicked = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      const result = await cdpEvaluateAndClick(`
        (function() {
          var popups = document.querySelectorAll('.FD26IYC-a-g, .gwt-DialogBox, [class*=DialogBox]');
          var visiblePopup = null;
          for (var i = 0; i < popups.length; i++) {
            var rect = popups[i].getBoundingClientRect();
            if (rect.left > 0 && rect.width > 0) {
              visiblePopup = popups[i];
              break;
            }
        }
        if (!visiblePopup) return { popupFound: false };
        var all = visiblePopup.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
          if (all[i].textContent.trim() === '查询') {
            var rect = all[i].getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
            }
          }
        }
        return { found: false };
      })()
    `, { sleepMs: 3000, log: '弹窗查询已执行，等待页面加载...' });

    if (result.clicked) {
      popupClicked = true;
      break;
    }
    await sleep(500);
  }

    if (!popupClicked) {
      console.log('警告: 未找到弹窗查询按钮');
    }
  } else {
    console.log('4. 页面已有查询表单，跳过单选按钮选择');
  }

  // 3. 展开查询条件
  console.log('5. 展开查询条件...');
  await cdpEvaluateAndClick(`
    (function() {
      var all = document.querySelectorAll('*');
      for (var i = 0; i < all.length; i++) {
        if (all[i].textContent.trim() === '显示查询') {
          var rect = all[i].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && rect.left > 0) {
            return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
          }
        }
      }
      return { found: false };
    })()
  `, { sleepMs: 1500 });

  // 4. 选择"开票日期"单选按钮（使用 CDP 真实点击）
  console.log('6. 选择开票日期...');
  const dateRadioResult = await cdpEvaluate(`
    (function() {
      var radios = document.querySelectorAll('input[type="radio"]');
      for (var i = 0; i < radios.length; i++) {
        var rect = radios[i].getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && rect.left > 1800) {
          return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2, id: radios[i].id };
        }
      }
      return { found: false };
    })()
  `);

  if (dateRadioResult?.found) {
    await cdpClick(dateRadioResult.x, dateRadioResult.y, 1000);
    console.log('已点击开票日期单选按钮:', dateRadioResult.id);
  }
  await sleep(1000);

  // 5. 设置开票日期范围
  console.log('7. 设置开票日期:', opts.startDate, '至', opts.endDate);
  await cdpEvaluate(`
    (function() {
      var start = document.getElementById('JINX_IPT_START-input');
      var end = document.getElementById('JINX_IPT_END-input');
      if (start) {
        start.value = '${opts.startDate}';
        start.setAttribute('value', '${opts.startDate}');
        start.dispatchEvent(new Event('input', { bubbles: true }));
        start.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (end) {
        end.value = '${opts.endDate}';
        end.setAttribute('value', '${opts.endDate}');
        end.dispatchEvent(new Event('input', { bubbles: true }));
        end.dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()
  `);
  await sleep(500);

  // 6. 选择申请单位（左上角蓝色按钮）
  console.log('8. 选择申请单位:', opts.companyCode);
  const companyBtnResult = await cdpEvaluate(`
    (function() {
      var btns = document.querySelectorAll('.FD26IYC-w-l');
      for (var i = 0; i < btns.length; i++) {
        var rect = btns[i].getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && rect.left < 1000) {
          return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
        }
      }
      return { found: false };
    })()
  `);

  if (companyBtnResult?.found) {
    await cdpClick(companyBtnResult.x, companyBtnResult.y, 2000);
    await pickFromDict(opts.companyCode);
    await sleep(1000);
  }

  // 7. 选择销方（右侧蓝色按钮）
  console.log('9. 选择销方:', opts.sellerCode);
  const sellerBtnResult = await cdpEvaluate(`
    (function() {
      var input = document.getElementById('DataSetFieldComboBox6-input');
      if (!input) return { notFound: true };
      var parent = input.parentElement;
      var btn = parent.querySelector('.FD26IYC-w-l');
      if (btn) {
        var rect = btn.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
        }
      }
      return { found: false };
    })()
  `);

  if (sellerBtnResult?.found) {
    await cdpClick(sellerBtnResult.x, sellerBtnResult.y, 2000);
    await pickFromDict(opts.sellerCode);
    await sleep(1000);
  }

  // 8. 点击查询按钮
  console.log('10. 点击查询按钮...');
  const queryClickResult = await cdpEvaluateAndClick(`
    (function() {
      var all = document.querySelectorAll('*');
      var candidates = [];
      for (var i = 0; i < all.length; i++) {
        if (all[i].textContent.trim() === '查询') {
          var rect = all[i].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && rect.left > 1700) {
            candidates.push({ x: rect.left + rect.width/2, y: rect.top + rect.height/2, top: rect.top });
          }
        }
      }
      if (candidates.length === 0) return { found: false };
      candidates.sort(function(a, b) { return b.top - a.top; });
      return { found: true, x: candidates[0].x, y: candidates[0].y };
    })()
  `, { sleepMs: 5000, log: '查询已执行，等待结果加载...' });

  if (!queryClickResult.clicked) {
    throw new Error('查询按钮未找到或未点击成功');
  }

  // 如果仅查询模式，返回结果
  if (opts.queryOnly) {
    const rows = await getTableRowCount();
    console.log('查询完成，表格行数:', rows.visible);
    return { queried: true, rows, options: opts };
  }

  // 9. 点击导出按钮
  console.log('11. 点击导出按钮...');
  await cdpEvaluateAndClick(`
    (function() {
      var activePane = document.querySelector('.ant-tabs-tabpane-active');
      if (!activePane) return { found: false };
      var all = activePane.querySelectorAll('*');
      for (var i = 0; i < all.length; i++) {
        if (all[i].textContent.trim() === '导出') {
          var rect = all[i].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && rect.left < 500 && rect.top < 200) {
            return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
          }
        }
      }
      return { found: false };
    })()
  `, { sleepMs: 2000 });

  // 10. 点击弹窗中的导出按钮
  console.log('12. 点击弹窗确认导出...');
  await cdpEvaluateAndClick(`
    (function() {
      var popups = document.querySelectorAll('.FD26IYC-a-g, .gwt-DialogBox, [class*=DialogBox]');
      var visiblePopup = null;
      for (var i = 0; i < popups.length; i++) {
        var rect = popups[i].getBoundingClientRect();
        if (rect.left > 0 && rect.width > 0) {
          visiblePopup = popups[i];
          break;
        }
      }
      if (!visiblePopup) return { found: false };
      var all = visiblePopup.querySelectorAll('*');
      for (var i = 0; i < all.length; i++) {
        if (all[i].textContent.trim() === '导出') {
          var rect = all[i].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && rect.left > 1000) {
            return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
          }
        }
      }
      return { found: false };
    })()
  `, { sleepMs: 2000 });

  // 检查弹窗是否关闭
  const popupCheck = await cdpEvaluate(`
    (function() {
      var popups = document.querySelectorAll('.FD26IYC-a-g, .gwt-DialogBox, [class*=DialogBox]');
      for (var i = 0; i < popups.length; i++) {
        var rect = popups[i].getBoundingClientRect();
        if (rect.left > 0 && rect.width > 0) return 'exists';
      }
      return 'closed';
    })()
  `);

  if (popupCheck === 'closed') {
    console.log('导出完成！');
    await closeBill();
    return { exported: true, options: opts };
  }

  throw new Error('导出流程未完成');
}

module.exports = { exportOutputInvoiceLedger };
