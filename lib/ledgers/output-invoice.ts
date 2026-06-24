import * as utils from '../utils/index';
import * as config from '../config';
import { verbose } from '../logger';

interface LedgerOptions {
  startPeriod?: string;
  endPeriod?: string;
  startDate?: string;
  endDate?: string;
  companyCode?: string;
  sellerCode?: string;
  queryOnly?: boolean;
}

interface LedgerResult {
  exported?: boolean;
  queried?: boolean;
  rows?: { total: number; visible: number };
  options?: Record<string, unknown>;
}

export async function exportOutputInvoiceLedger(
  options: LedgerOptions = {}
): Promise<LedgerResult> {
  const cfg = config.get() as Record<string, unknown>;
  const defaults = {
    startDate: (cfg.startDate as string) || '2026-04-01',
    endDate: (cfg.endDate as string) || '2026-04-30',
    companyCode: (cfg.companyCode as string) || '1000200020040011',
    sellerCode: (cfg.sellerCode as string) || 'XXXXXXXXXXXXXXXXXX',
    queryOnly: false,
  };
  const opts: Record<string, unknown> = { ...defaults, ...options };

  if (opts.queryOnly) {
    verbose('开始销项发票明细台账查询...');
  } else {
    verbose('开始销项发票明细台账查询导出...');
  }

  // 1. 导航至销项发票台账
  verbose('1. 打开税务系统菜单...');
  await utils.openSideMenu('税务系统');
  await utils.sleep(1000);

  verbose('2. 点击税务台账...');
  await utils.clickDrawerItem('税务台账');
  await utils.sleep(1000);

  verbose('3. 点击销项发票台账...');
  await utils.clickDrawerItem('销项发票台账');
  await utils.sleep(2000);

  // 2. 检查当前是否已经在销项发票明细台账页面（避免重复选择单选按钮）
  const isDetailLedgerPage = await utils.cdpEvaluate<boolean>(`
    (function() {
      var activeTab = document.querySelector('.ant-tabs-tab-active');
      if (activeTab && activeTab.textContent.includes('销项发票明细台账')) return true;
      return false;
    })()
  `);

  if (!isDetailLedgerPage) {
    // 页面没有查询表单，需要选择单选按钮
    verbose('4. 选择销项发票明细台账...');
    const radioResult = (await utils.cdpEvaluate(`
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
    `)) as {
      success: boolean;
      reason?: string;
      x?: number;
      y?: number;
      tag?: string;
    };

    if (!radioResult?.success) {
      throw new Error(
        'Failed to select 销项发票明细台账: ' +
          (radioResult?.reason || 'unknown')
      );
    }

    await utils.cdpClick(radioResult.x!, radioResult.y!, 1500);
    verbose('已点击销项发票明细台账:', radioResult.tag);

    // 等待弹窗出现并点击查询按钮
    verbose('等待弹窗出现...');
    let popupClicked = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      const result = await utils.cdpEvaluateAndClick(
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
    `,
        { sleepMs: 3000, log: '弹窗查询已执行，等待页面加载...' }
      );

      if (result.clicked) {
        popupClicked = true;
        break;
      }
      await utils.sleep(500);
    }

    if (!popupClicked) {
      verbose('警告: 未找到弹窗查询按钮');
    }
  } else {
    verbose('4. 当前已在销项发票明细台账页面，跳过单选按钮选择');
  }

  // 3. 展开查询条件
  verbose('5. 展开查询条件...');
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

  // 4. 选择"开票日期"单选按钮（先找到文本再找附近的 radio）
  verbose('6. 选择开票日期...');
  const dateRadioResult = (await utils.cdpEvaluate(`
    (function() {
      var all = document.querySelectorAll('*');
      var label = null;
      for (var i = 0; i < all.length; i++) {
        if (all[i].textContent.trim() === '开票日期') {
          var rect = all[i].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && rect.left > 400) {
            label = all[i];
            break;
          }
        }
      }
      if (!label) return { found: false, reason: 'label_not_found' };
      var labelRect = label.getBoundingClientRect();
      var labelCenterX = labelRect.left + labelRect.width/2;
      var labelCenterY = labelRect.top + labelRect.height/2;

      var radios = document.querySelectorAll('input[type="radio"]');
      var closestRadio = null;
      var minDistance = Infinity;
      for (var i = 0; i < radios.length; i++) {
        var rect = radios[i].getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          var radioCenterX = rect.left + rect.width/2;
          var radioCenterY = rect.top + rect.height/2;
          var distance = Math.sqrt(Math.pow(radioCenterX - labelCenterX, 2) + Math.pow(radioCenterY - labelCenterY, 2));
          if (distance < minDistance && distance < 200) {
            minDistance = distance;
            closestRadio = radios[i];
          }
        }
      }
      if (!closestRadio) return { found: false, reason: 'radio_not_found' };
      var rect = closestRadio.getBoundingClientRect();
      return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2, id: closestRadio.id };
    })()
  `)) as {
    found: boolean;
    x?: number;
    y?: number;
    id?: string;
    reason?: string;
  };

  if (dateRadioResult?.found) {
    await utils.cdpClick(dateRadioResult.x!, dateRadioResult.y!, 1000);
    verbose('已点击开票日期单选按钮:', dateRadioResult.id);
  } else {
    verbose('警告: 未找到开票日期单选按钮:', dateRadioResult?.reason);
  }
  await utils.sleep(1000);

  // 5. 设置开票日期范围
  verbose('7. 设置开票日期:', opts.startDate, '至', opts.endDate);
  await utils.cdpEvaluate(`
    (function() {
      var start = document.getElementById('JINX_IPT_START-input');
      var end = document.getElementById('JINX_IPT_END-input');
      if (start) {
        start.removeAttribute('readonly');
        start.value = '${utils.escapeJsString(opts.startDate as string)}';
        start.setAttribute('value', '${utils.escapeJsString(opts.startDate as string)}');
        start.dispatchEvent(new Event('input', { bubbles: true }));
        start.dispatchEvent(new Event('change', { bubbles: true }));
        start.setAttribute('readonly', '');
      }
      if (end) {
        end.removeAttribute('readonly');
        end.value = '${utils.escapeJsString(opts.endDate as string)}';
        end.setAttribute('value', '${utils.escapeJsString(opts.endDate as string)}');
        end.dispatchEvent(new Event('input', { bubbles: true }));
        end.dispatchEvent(new Event('change', { bubbles: true }));
        end.setAttribute('readonly', '');
      }
      return { startFound: !!start, endFound: !!end };
    })()
  `);
  await utils.sleep(500);

  // 6. 选择申请单位（左上角蓝色按钮）
  verbose('8. 选择申请单位:', opts.companyCode);
  const companyBtnResult = (await utils.cdpEvaluate(`
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
  `)) as { found: boolean; x?: number; y?: number };

  if (companyBtnResult?.found) {
    await utils.cdpClick(companyBtnResult.x!, companyBtnResult.y!, 2000);
    await utils.pickFromDict(opts.companyCode as string);
    await utils.sleep(1000);
  }

  // 7. 选择销方（右侧蓝色按钮）
  verbose('9. 选择销方:', opts.sellerCode);
  const sellerBtnResult = (await utils.cdpEvaluate(`
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
  `)) as { found: boolean; x?: number; y?: number };

  if (sellerBtnResult?.found) {
    await utils.cdpClick(sellerBtnResult.x!, sellerBtnResult.y!, 2000);
    await utils.pickFromDict(opts.sellerCode as string);
    await utils.sleep(1000);
  }

  // 8. 点击查询按钮
  verbose('10. 点击查询按钮...');
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
    { sleepMs: 5000, log: '查询已执行，等待结果加载...' }
  );

  if (!queryClickResult.clicked) {
    throw new Error('查询按钮未找到或未点击成功');
  }

  // 如果仅查询模式，返回结果
  if (opts.queryOnly) {
    const rows = await utils.getTableRowCount();
    verbose('查询完成，表格行数:', rows.visible);
    return { queried: true, rows, options: opts };
  }

  // 9. 点击导出按钮
  verbose('11. 点击导出按钮...');
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

  // 10. 点击弹窗中的导出按钮
  verbose('12. 点击弹窗确认导出...');
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

  // 检查弹窗是否关闭
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

  if (popupCheck === 'closed') {
    verbose('导出完成！');
    await utils.closeBill();
    return { exported: true, options: opts };
  }

  throw new Error('导出流程未完成');
}
