const {
  sleep, getTableRowCount, openSideMenu, clickDrawerItem,
  clickShowQuery, setDateRange, setTaxPeriod, clickPickerButton,
  pickFromDict, pickTaxSubject, closeBill,
  cdpEvaluateAndClick, cdpEvaluate, cdpClick
} = require('../utils/index');
const config = require('../config');

async function exportInputTransferLedger(options = {}) {
  const cfg = config.get();
  const defaults = {
    startPeriod: cfg.startPeriod || '2026-04',
    endPeriod: cfg.endPeriod || '2026-04',
    companyCode: cfg.companyCode || '1000200020040011',
    taxCode: cfg.taxCode || '91110000101638302P',
    docStatus: cfg.docStatus || '流程结束',
    queryOnly: false
  };
  const opts = { ...defaults, ...options };

  if (opts.queryOnly) {
    console.log('开始进项转出明细台账查询...');
  } else {
    console.log('开始进项转出明细台账查询导出...');
  }

  // 1. 导航至进项转出明细台账
  console.log('1. 打开税务系统菜单...');
  await openSideMenu('税务系统');
  await sleep(1000);

  console.log('2. 点击税务台账...');
  await clickDrawerItem('税务台账');
  await sleep(1000);

  console.log('3. 点击进项转出台账...');
  await clickDrawerItem('进项转出台账');
  await sleep(2000);

  // 2. 检查页面是否已有查询表单（避免重复选择单选按钮）
  const hasQueryForm = await cdpEvaluate(`
    (function() {
      var allInputs = document.querySelectorAll('input');
      for (var i = 0; i < allInputs.length; i++) {
        if (allInputs[i].id === 'FormDateFieldYM2-input') {
          var rect = allInputs[i].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) return true;
        }
      }
      return false;
    })()
  `);
  if (!hasQueryForm) {
    // 页面没有查询表单，需要选择单选按钮
    console.log('4. 选择进项转出明细台账...');
    const radioResult = await cdpEvaluate(`
      (function() {
        var all = document.querySelectorAll('*');
        var target = null;
        for (var i = 0; i < all.length; i++) {
          if (all[i].textContent.trim() === '进项转出明细台账') {
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
        return { success: false, reason: 'label not found' };
      })()
    `);

    if (!radioResult?.success) {
      throw new Error('Failed to select 进项转出明细台账: ' + (radioResult?.reason || 'unknown'));
    }

    await cdpClick(radioResult.x, radioResult.y, 1500);
    console.log('已点击进项转出明细台账:', radioResult.tag);

    // 点击弹窗中的查询按钮
    await sleep(500);
    const popupQueryResult = await cdpEvaluateAndClick(`
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
        if (!visiblePopup) return { found: false, reason: 'popup_not_found' };
        var spans = visiblePopup.querySelectorAll('span');
        for (var i = 0; i < spans.length; i++) {
          if (spans[i].textContent.trim() === '查询') {
            var rect = spans[i].getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
            }
          }
        }
        return { found: false, reason: 'query_button_not_found' };
      })()
    `, { sleepMs: 3000, log: '弹窗查询已执行，等待页面加载...' });
    if (!popupQueryResult.clicked) {
      throw new Error('弹窗查询按钮点击失败: ' + (popupQueryResult.reason || 'unknown'));
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

  // 3. 选择"转出税期"单选按钮（使用 CDP 真实点击）
  console.log('5. 选择转出税期...');
  const taxPeriodResult = await cdpEvaluate(`
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

  if (taxPeriodResult?.found) {
    await cdpClick(taxPeriodResult.x, taxPeriodResult.y, 1000);
    console.log('已点击转出税期单选按钮:', taxPeriodResult.id);
  }

  // 4. 设置税期范围
  console.log('6. 设置转出税期:', opts.startPeriod, '至', opts.endPeriod);
  await cdpEvaluate(`
    (function() {
      var allInputs = document.querySelectorAll('input');
      var start = null, end = null;
      for (var i = 0; i < allInputs.length; i++) {
        var id = allInputs[i].id || '';
        var rect = allInputs[i].getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          if (id === 'FormDateFieldYM2-input') start = allInputs[i];
          if (id === 'FormDateFieldYM3-input') end = allInputs[i];
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

  // 5. 设置单据状态
  console.log('7. 设置单据状态:', opts.docStatus);
  const statusResult = await cdpEvaluate(`
    (function() {
      var input = document.getElementById('FormComboBoxDJZT-input');
      if (!input) return { found: false };
      var rect = input.getBoundingClientRect();
      return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
    })()
  `);

  if (statusResult?.found) {
    await cdpClick(statusResult.x, statusResult.y, 1000);

    // 选择指定状态
    await cdpEvaluateAndClick(`
      (function() {
        var all = document.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
          if (all[i].textContent.trim() === '${opts.docStatus}') {
            var rect = all[i].getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && rect.top > 300 && rect.top < 500 && rect.left > 1700) {
              return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
            }
          }
        }
        return { found: false };
      })()
    `, { sleepMs: 500 });
  }

  // 6. 选择转出单位
  console.log('8. 选择转出单位:', opts.companyCode);
  await clickPickerButton('转出单位');
  await sleep(2000);
  await pickFromDict(opts.companyCode);
  await sleep(1000);

  // 7. 选择纳税主体（自定义逻辑，使用文本查找确定按钮）
  console.log('9. 选择纳税主体:', opts.taxCode);
  await clickPickerButton('纳税主体');
  await sleep(2000);

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

  // 点击弹窗查询按钮（eval 点击）
  await cdpEvaluate(`
    (function() {
      var popup = document.querySelector('.FD26IYC-a-g');
      if (!popup) return { found: false };
      var queryDiv = popup.querySelector('.FD26IYC-D-d.FD26IYC-D-o');
      if (queryDiv) {
        queryDiv.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        queryDiv.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        queryDiv.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return { found: true };
      }
      return { found: false };
    })()
  `);
  await sleep(2000);

  // 点击第一行结果（eval 点击）
  await cdpEvaluate(`
    (function() {
      var popup = document.querySelector('.FD26IYC-a-g');
      if (!popup) return { found: false };
      var rows = popup.querySelectorAll('.FD26IYC-O-d');
      if (rows.length > 1) {
        var firstDataRow = rows[1];
        firstDataRow.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        firstDataRow.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        firstDataRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return { found: true };
      }
      return { found: false };
    })()
  `);
  await sleep(500);

  // 使用 CDP 点击确定按钮（通过文本查找）
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

  if (popupCheck === 'exists') {
    throw new Error('纳税主体弹窗未关闭');
  }
  await sleep(500);

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
      // 选择 top 最大的（最下方的查询按钮，通常是台账页面的）
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
  const exportPopupCheck = await cdpEvaluate(`
    (function() {
      var popups = document.querySelectorAll('.FD26IYC-a-g, .gwt-DialogBox, [class*=DialogBox]');
      for (var i = 0; i < popups.length; i++) {
        var rect = popups[i].getBoundingClientRect();
        if (rect.left > 0 && rect.width > 0) return 'exists';
      }
      return 'closed';
    })()
  `);

  if (exportPopupCheck === 'closed') {
    console.log('导出完成！');
    await closeBill();
    return { exported: true, options: opts };
  }

  throw new Error('导出流程未完成');
}

module.exports = { exportInputTransferLedger };
