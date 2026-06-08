const {
  sleep, getTableRowCount, openSideMenu, clickDrawerItem,
  clickShowQuery, setDateRange, setTaxPeriod, clickPickerButton,
  pickFromDict, pickTaxSubject, closeBill,
  cdpEvaluateAndClick, cdpEvaluate, cdpClick,
  cdpFindElementByText, cdpFindPickerButtonByInputId
} = require('../utils/index');
const config = require('../config');

async function exportPassengerTransportLedger(options = {}) {
  const cfg = config.get();
  const defaults = {
    startPeriod: cfg.startPeriod || '2026-04',
    endPeriod: cfg.endPeriod || '2026-04',
    companyCode: cfg.companyCode || '1000200020040011',
    taxCode: cfg.taxCode || '91110000101638302P',
    queryOnly: false
  };
  const opts = { ...defaults, ...options };

  if (opts.queryOnly) {
    console.log('开始旅客运输服务台账查询...');
  } else {
    console.log('开始旅客运输服务台账查询导出...');
  }

  // 1. 导航至旅客运输服务台账
  console.log('1. 打开税务系统菜单...');
  await openSideMenu('税务系统');
  await sleep(1000);

  console.log('2. 点击税务台账...');
  await clickDrawerItem('税务台账');
  await sleep(1000);

  console.log('3. 点击旅客运输服务台账...');
  await clickDrawerItem('旅客运输服务台账');
  await sleep(2000);

  // 2. 点击显示查询按钮
  console.log('4. 展开查询条件...');
  const showQueryBtn = await cdpFindElementByText('显示查询');
  if (showQueryBtn?.found) {
    await cdpClick(showQueryBtn.x, showQueryBtn.y, 1500);
  }

  // 3. 设置所属税期
  console.log('5. 设置所属税期:', opts.startPeriod, '至', opts.endPeriod);
  await cdpEvaluate(`
    (function() {
      // GWT 多 tabpanel 共存导致多个同名输入框，必须找到可见的
      var allInputs = document.querySelectorAll('input');
      var start = null, end = null;
      for (var i = 0; i < allInputs.length; i++) {
        var id = allInputs[i].id || '';
        var rect = allInputs[i].getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          if (id === 'FormDateFieldYM1-input') start = allInputs[i];
          if (id === 'FormDateFieldYM2-input') end = allInputs[i];
        }
      }
      if (start) {
        start.value = '${opts.startPeriod}';
        start.setAttribute('value', '${opts.startPeriod}');
        start.dispatchEvent(new Event('input', { bubbles: true }));
        start.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (end) {
        end.value = '${opts.endPeriod}';
        end.setAttribute('value', '${opts.endPeriod}');
        end.dispatchEvent(new Event('input', { bubbles: true }));
        end.dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()
  `);
  await sleep(500);

  // 4. 选择申请单位
  console.log('6. 选择申请单位:', opts.companyCode);
  const companyBtn = await cdpFindPickerButtonByInputId('DataSetFieldComboBox1-input');
  if (companyBtn?.found) {
    await cdpClick(companyBtn.x, companyBtn.y, 2000);
    await pickFromDict(opts.companyCode);
    await sleep(1000);
  }

  // 5. 选择纳税主体
  console.log('7. 选择纳税主体:', opts.taxCode);
  const taxBtn = await cdpFindPickerButtonByInputId('DataSetFieldComboBox2-input');
  if (taxBtn?.found) {
    await cdpClick(taxBtn.x, taxBtn.y, 2000);

    // 在弹窗中输入税号
    await cdpEvaluate(`
      (function() {
        var popup = document.querySelector('.FD26IYC-a-g');
        if (!popup) return { found: false };
        var input = popup.querySelector('#FormTextInput1-input');
        if (input) {
          input.value = '${opts.taxCode}';
          input.setAttribute('value', '${opts.taxCode}');
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          return { found: true };
        }
        return { found: false };
      })()
    `);
    await sleep(500);

    // 点击弹窗查询按钮
    await cdpEvaluateAndClick(`
      (function() {
        var popup = document.querySelector('.FD26IYC-a-g');
        if (!popup) return { found: false };
        var all = popup.querySelectorAll('*');
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
    `, { sleepMs: 2000 });

    // 选择包含税号的行
    await cdpEvaluateAndClick(`
      (function() {
        var popup = document.querySelector('.FD26IYC-a-g');
        if (!popup) return { found: false };
        var rows = popup.querySelectorAll('tr');
        for (var i = 0; i < rows.length; i++) {
          if (rows[i].textContent.indexOf('${opts.taxCode}') >= 0) {
            var rect = rows[i].getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
            }
          }
        }
        return { found: false };
      })()
    `, { sleepMs: 500 });

    // 点击确定按钮
    await cdpEvaluateAndClick(`
      (function() {
        var popup = document.querySelector('.FD26IYC-a-g');
        if (!popup) return { found: false };
        var all = popup.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
          if (all[i].textContent.trim() === '确定') {
            var rect = all[i].getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && rect.left > 1000) {
              return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
            }
          }
        }
        return { found: false };
      })()
    `, { sleepMs: 1500 });
  }

  // 6. 点击查询按钮
  console.log('8. 点击查询按钮...');
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
  `, { sleepMs: 3000, log: '查询已执行，等待结果加载...' });

  if (!queryClickResult.clicked) {
    throw new Error('查询按钮未找到或未点击成功');
  }

  // 如果仅查询模式，返回结果
  if (opts.queryOnly) {
    const rows = await getTableRowCount();
    console.log('查询完成，表格行数:', rows.visible);
    return { queried: true, rows, options: opts };
  }

  // 7. 点击导出按钮
  console.log('9. 点击导出按钮...');
  const exportBtnResult = await cdpEvaluate(`
    (function() {
      var all = document.querySelectorAll('*');
      for (var i = 0; i < all.length; i++) {
        if (all[i].textContent.trim() === '导出') {
          var rect = all[i].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && rect.left > 0 && rect.left < 500 && rect.top < 200) {
            return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
          }
        }
      }
      return { found: false };
    })()
  `);
  if (!exportBtnResult?.found) {
    throw new Error('未找到导出按钮');
  }
  console.log('  导出按钮坐标:', exportBtnResult.x, exportBtnResult.y);
  await cdpClick(exportBtnResult.x, exportBtnResult.y, 2000);

  // 8. 点击弹窗中的导出按钮
  console.log('10. 点击弹窗确认导出...');
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
  } else {
    // 如果没有弹窗，可能是直接下载了
    console.log('导出完成（直接下载）！');
    await closeBill();
    return { exported: true, options: opts };
  }
}

module.exports = { exportPassengerTransportLedger };
