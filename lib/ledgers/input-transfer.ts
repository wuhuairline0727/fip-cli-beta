import * as utils from '../utils/index';
import * as config from '../config';
import { GWT } from '../selectors';

export interface InputTransferOptions {
  startPeriod?: string;
  endPeriod?: string;
  companyCode?: string;
  taxCode?: string;
  docStatus?: string;
  queryOnly?: boolean;
  [key: string]: unknown;
}

export interface InputTransferResult {
  exported?: boolean;
  queried?: boolean;
  rows?: { total: number; visible: number };
  options?: Record<string, unknown>;
}

export async function exportInputTransferLedger(
  options: InputTransferOptions = {}
): Promise<InputTransferResult> {
  const cfg = config.get() as Record<string, unknown>;
  const defaults = {
    startPeriod: cfg.startPeriod || '2026-04',
    endPeriod: cfg.endPeriod || '2026-04',
    companyCode: cfg.companyCode || '1000200020040011',
    taxCode: cfg.taxCode || '91110000101638302P',
    docStatus: cfg.docStatus || '流程结束',
    queryOnly: false,
  };
  const opts = { ...defaults, ...options };

  if (opts.queryOnly) {
    console.log('开始进项转出明细台账查询...');
  } else {
    console.log('开始进项转出明细台账查询导出...');
  }

  console.log('1. 打开税务系统菜单...');
  await utils.openSideMenu('税务系统');
  await utils.sleep(1000);

  console.log('2. 点击税务台账...');
  await utils.clickDrawerItem('税务台账');
  await utils.sleep(1000);

  console.log('3. 点击进项转出台账...');
  await utils.clickDrawerItem('进项转出台账');
  await utils.sleep(2000);

  // 检查当前是否已经在进项转出明细台账页面（避免重复选择单选按钮）
  const isDetailLedgerPage = await utils.cdpEvaluate<boolean>(`
    (function() {
      var activeTab = document.querySelector('.ant-tabs-tab-active');
      if (activeTab && activeTab.textContent.includes('进项转出明细台账')) return true;
      return false;
    })()
  `);

  if (!isDetailLedgerPage) {
    console.log('4. 选择进项转出明细台账...');
    const radioResult = await utils.cdpEvaluate<{
      success: boolean;
      x: number;
      y: number;
      tag: string;
      reason?: string;
    }>(`
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
      throw new Error(
        'Failed to select 进项转出明细台账: ' +
          (radioResult?.reason || 'unknown')
      );
    }

    await utils.cdpClick(radioResult.x, radioResult.y, 1500);
    console.log('已点击进项转出明细台账:', radioResult.tag);

    await utils.sleep(500);
    const popupQueryResult = await utils.cdpEvaluateAndClick(
      `
      (function() {
        var popups = document.querySelectorAll('${GWT.POPUP}, ${GWT.DIALOG_BOX}, ${GWT.DIALOG_BOX_FUZZY}');
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
    `,
      { sleepMs: 3000, log: '弹窗查询已执行，等待页面加载...' }
    );
    if (!popupQueryResult.clicked) {
      throw new Error(
        '弹窗查询按钮点击失败: ' + (popupQueryResult.reason || 'unknown')
      );
    }
  } else {
    console.log('4. 当前已在进项转出明细台账页面，跳过单选按钮选择');
  }

  console.log('5. 展开查询条件...');
  await utils.cdpEvaluateAndClick(
    `
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
  `,
    { sleepMs: 1500 }
  );

  console.log('5. 选择转出税期...');
  const taxPeriodResult = await utils.cdpEvaluate<{
    found: boolean;
    x?: number;
    y?: number;
    id?: string;
  }>(`
    (function() {
      var radios = document.querySelectorAll('input[type="radio"]');
      for (var i = 0; i < radios.length; i++) {
        var rect = radios[i].getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && rect.left > 1600) {
          return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2, id: radios[i].id };
        }
      }
      return { found: false };
    })()
  `);

  if (taxPeriodResult?.found) {
    await utils.cdpClick(taxPeriodResult.x!, taxPeriodResult.y!, 1000);
    console.log('已点击转出税期单选按钮:', taxPeriodResult.id);
  }

  console.log('6. 设置转出税期:', opts.startPeriod, '至', opts.endPeriod);
  await utils.cdpEvaluate(`
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
  await utils.sleep(500);

  console.log('7. 设置单据状态:', opts.docStatus);
  const statusResult = await utils.cdpEvaluate<{
    found: boolean;
    x?: number;
    y?: number;
  }>(`
    (function() {
      var input = document.getElementById('FormComboBoxDJZT-input');
      if (!input) return { found: false };
      var rect = input.getBoundingClientRect();
      return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
    })()
  `);

  if (statusResult?.found) {
    await utils.cdpClick(statusResult.x!, statusResult.y!, 1000);

    await utils.cdpEvaluateAndClick(
      `
      (function() {
        var all = document.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
          if (all[i].textContent.trim() === '${opts.docStatus}') {
            var rect = all[i].getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && rect.top > 300 && rect.top < 500 && rect.left > 1500) {
              return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
            }
          }
        }
        return { found: false };
      })()
    `,
      { sleepMs: 500 }
    );
  }

  console.log('8. 选择转出单位:', opts.companyCode);
  await utils.clickPickerButton('转出单位');
  await utils.sleep(2000);
  await utils.pickFromDict(opts.companyCode as string);
  await utils.sleep(1000);

  console.log('9. 选择纳税主体:', opts.taxCode);
  await utils.clickPickerButton('纳税主体');
  await utils.sleep(2000);

  await utils.cdpEvaluate(`
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
  await utils.sleep(500);

  await utils.cdpEvaluate(`
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
  await utils.sleep(2000);

  await utils.cdpEvaluate(`
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
  await utils.sleep(500);

  await utils.cdpEvaluateAndClick(
    `
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
  `,
    { sleepMs: 1500 }
  );

  const popupCheck = await utils.cdpEvaluate(`
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
  await utils.sleep(500);

  console.log('10. 点击查询按钮...');
  const queryClickResult = await utils.cdpEvaluateAndClick(
    `
    (function() {
      var all = document.querySelectorAll('*');
      var candidates = [];
      for (var i = 0; i < all.length; i++) {
        if (all[i].textContent.trim() === '查询') {
          var rect = all[i].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && rect.left > 1500) {
            candidates.push({ x: rect.left + rect.width/2, y: rect.top + rect.height/2, top: rect.top });
          }
        }
      }
      if (candidates.length === 0) return { found: false };
      candidates.sort(function(a, b) { return b.top - a.top; });
      return { found: true, x: candidates[0].x, y: candidates[0].y };
    })()
  `,
    { sleepMs: 3000, log: '查询已执行，等待结果加载...' }
  );

  if (!queryClickResult.clicked) {
    throw new Error('查询按钮未找到或未点击成功');
  }

  if (opts.queryOnly) {
    const rows = await utils.getTableRowCount();
    console.log('查询完成，表格行数:', rows.visible);
    return { queried: true, rows, options: opts };
  }

  console.log('11. 点击导出按钮...');
  await utils.cdpEvaluateAndClick(
    `
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
  `,
    { sleepMs: 2000 }
  );

  console.log('12. 点击弹窗确认导出...');
  await utils.cdpEvaluateAndClick(
    `
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
  `,
    { sleepMs: 2000 }
  );

  const exportPopupCheck = await utils.cdpEvaluate(`
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
    await utils.closeBill();
    return { exported: true, options: opts };
  }

  throw new Error('导出流程未完成');
}
