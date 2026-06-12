import * as utils from '../utils/index';
import * as config from '../config';

interface LedgerOptions {
  startPeriod?: string;
  endPeriod?: string;
  startDate?: string;
  endDate?: string;
  companyCode?: string;
  taxCode?: string;
  docType?: string;
  queryOnly?: boolean;
}

interface LedgerResult {
  exported?: boolean;
  queried?: boolean;
  rows?: { total: number; visible: number };
  options?: Record<string, unknown>;
}

export async function exportVatPrepaymentLedger(
  options: LedgerOptions = {}
): Promise<LedgerResult> {
  const cfg = config.get() as Record<string, unknown>;
  const defaults = {
    startPeriod: (cfg.startPeriod as string) || '2026-04',
    endPeriod: (cfg.endPeriod as string) || '2026-04',
    companyCode: (cfg.companyCode as string) || '1000200020040011',
    taxCode: (cfg.taxCode as string) || '91110000101638302P',
    docType: (cfg.docType as string) || '预缴计算单',
    queryOnly: false,
  };
  const opts: Record<string, unknown> = { ...defaults, ...options };

  if (opts.queryOnly) {
    console.log('开始增值税预缴款台账查询...');
  } else {
    console.log('开始增值税预缴款台账查询导出...');
  }

  // 1. 导航至增值税预缴款台账
  console.log('1. 打开税务系统菜单...');
  await utils.openSideMenu('税务系统');
  await utils.sleep(1000);

  console.log('2. 点击税务台账...');
  await utils.clickDrawerItem('税务台账');
  await utils.sleep(1000);

  console.log('3. 点击增值税预缴款台账...');
  await utils.clickDrawerItem('增值税预缴款台账');
  await utils.sleep(2000);

  // 2. 点击显示查询按钮（如果查询条件被折叠）
  console.log('4. 展开查询条件...');
  const showQueryBtn = await utils.cdpFindElementByText('显示查询');
  if (showQueryBtn?.found) {
    await utils.cdpClick(showQueryBtn.x!, showQueryBtn.y!, 1500);
  }

  // 3. 设置单据类型
  console.log('5. 设置单据类型:', opts.docType);
  const docTypeInputResult = (await utils.cdpEvaluate(`
    (function() {
      var allInputs = document.querySelectorAll('input');
      for (var i = 0; i < allInputs.length; i++) {
        var val = allInputs[i].value || '';
        if (val.indexOf('完税预缴单') >= 0 || val.indexOf('预缴计算单') >= 0 || val.indexOf('全部') >= 0) {
          var rect = allInputs[i].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && rect.left > 0) {
            return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2, value: val };
          }
        }
      }
      return { found: false, reason: 'no_visible_input' };
    })()
  `)) as {
    found: boolean;
    reason?: string;
    x?: number;
    y?: number;
    value?: string;
  };
  if (!docTypeInputResult?.found) {
    throw new Error(
      '未找到单据类型输入框: ' + (docTypeInputResult?.reason || 'unknown')
    );
  }
  console.log('  找到输入框，当前值:', docTypeInputResult.value);
  console.log(
    '  点击输入框，坐标:',
    docTypeInputResult.x,
    docTypeInputResult.y
  );
  await utils.cdpClick(docTypeInputResult.x!, docTypeInputResult.y!, 2000);
  console.log('  已点击输入框，等待下拉菜单打开...');

  // 直接查找下拉选项
  const optionResult = await utils.cdpFindDropdownOption(
    opts.docType as string
  );
  if (!optionResult?.found) {
    throw new Error('未找到下拉选项: ' + opts.docType);
  }
  console.log('  找到选项，坐标:', optionResult.x, optionResult.y);
  await utils.cdpClick(optionResult.x!, optionResult.y!, 1500);
  console.log('  已点击选项，等待下拉菜单关闭...');

  // 4. 设置所属税期
  console.log('6. 设置所属税期:', opts.startPeriod, '至', opts.endPeriod);
  await utils.cdpEvaluate(`
    (function() {
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
  await utils.sleep(500);

  // 5. 选择申请单位
  console.log('7. 选择申请单位:', opts.companyCode);
  const companyBtn = await utils.cdpFindPickerButtonByInputId(
    'DataSetFieldComboBox1-input'
  );
  if (companyBtn?.found) {
    await utils.cdpClick(companyBtn.x!, companyBtn.y!, 2000);
    await utils.pickFromDict(opts.companyCode as string);
    await utils.sleep(1000);
  }

  // 6. 选择纳税主体
  console.log('8. 选择纳税主体:', opts.taxCode);
  const taxBtn = await utils.cdpFindPickerButtonByInputId(
    'DataSetFieldComboBox2-input'
  );
  if (taxBtn?.found) {
    await utils.cdpClick(taxBtn.x!, taxBtn.y!, 2000);

    // 在弹窗中输入税号
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

    // 点击弹窗查询按钮
    const popupQueryBtn = await utils.cdpFindPopupElementByText('查询');
    if (popupQueryBtn?.found) {
      await utils.cdpClick(popupQueryBtn.x!, popupQueryBtn.y!, 2000);
    }

    // 选择包含税号的行
    await utils.cdpEvaluateAndClick(
      `
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
    `,
      { sleepMs: 500 }
    );

    // 点击确定按钮
    const confirmBtn = await utils.cdpFindPopupElementByText('确定');
    if (confirmBtn?.found) {
      await utils.cdpClick(confirmBtn.x!, confirmBtn.y!, 1500);
    }
  }

  // 8. 点击查询按钮
  console.log('8. 点击查询按钮...');
  const queryBtn = (await utils.cdpEvaluate(`
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
  `)) as { found: boolean; x?: number; y?: number };
  if (!queryBtn?.found) {
    throw new Error('查询按钮未找到');
  }
  await utils.cdpClick(queryBtn.x!, queryBtn.y!, 5000);
  console.log('查询已执行，等待结果加载...');

  // 如果仅查询模式，返回结果
  if (opts.queryOnly) {
    const rows = await utils.getTableRowCount();
    console.log('查询完成，表格行数:', rows.visible);
    return { queried: true, rows, options: opts };
  }

  // 8. 点击导出按钮
  console.log('10. 点击导出按钮...');
  const exportBtnResult = (await utils.cdpEvaluate(`
    (function() {
      var all = document.querySelectorAll('*');
      var candidates = [];
      for (var i = 0; i < all.length; i++) {
        var text = all[i].textContent.trim();
        if (text === '导出') {
          var rect = all[i].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && rect.left > 0 && rect.left < 600 && rect.top < 300) {
            candidates.push({ x: rect.left + rect.width/2, y: rect.top + rect.height/2, left: rect.left, top: rect.top });
          }
        }
      }
      if (candidates.length === 0) return { found: false };
      // 选择 left 最小的（最左侧的导出按钮，通常是页面上的而不是弹窗内的）
      candidates.sort(function(a, b) { return a.left - b.left; });
      return { found: true, x: candidates[0].x, y: candidates[0].y };
    })()
  `)) as { found: boolean; x?: number; y?: number };
  if (!exportBtnResult?.found) {
    throw new Error('未找到导出按钮');
  }
  console.log('  导出按钮坐标:', exportBtnResult.x, exportBtnResult.y);
  await utils.cdpClick(exportBtnResult.x!, exportBtnResult.y!, 2000);

  // 8. 点击弹窗中的导出按钮
  console.log('11. 点击弹窗确认导出...');

  // 等待弹窗出现（最多5秒）
  let popupFound = false;
  let popupExportBtn = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    await utils.sleep(500);
    popupExportBtn = await utils.cdpFindPopupElementByText('导出', {
      leftMin: 1000,
    });
    if (popupExportBtn?.found) {
      popupFound = true;
      break;
    }
  }

  if (popupFound) {
    await utils.cdpClick(popupExportBtn!.x!, popupExportBtn!.y!, 2000);

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
      console.log('导出完成！');
      await utils.closeBill();
      return { exported: true, options: opts };
    }
    throw new Error('导出弹窗未关闭，导出可能未完成');
  }

  throw new Error('导出流程未完成');
}
