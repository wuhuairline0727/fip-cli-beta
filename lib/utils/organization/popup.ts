/**
 * 选择弹窗操作模块
 * 职责：在弹窗中查询、选择、读取列表、关闭
 */

import { evaluate } from '../../browser';
import { debug } from '../../logger';
import { GWT } from '../../selectors';
import {
  cdpEvaluate,
  cdpClick,
  cdpFindPickerButtonByInputId,
  cdpFindPopupElementByText,
  cdpEvaluateAndClick,
} from '../cdp';
import { getVisiblePopupCode } from './dialog';
import type {
  CDPBtnResult,
  EvaluateResult,
  QueryFillResult,
  CheckResult,
  PopupItemsResult,
  PopupInfoResult,
} from './types';

const PICKER_BTN_SELECTOR = GWT.PICKER_BTN;

/**
 * 在弹窗中查询并选择项目
 * 参考台账查询的 pickFromDict 模式
 * @param fieldLabel - 字段标签，如 '组织机构'、'项目名称'、'部门名称'
 * @param queryText - 查询文本
 * @param inputId - 输入框ID（可选，用于精确定位按钮）
 */
export async function queryAndSelectInPopup(
  fieldLabel: string,
  queryText: string,
  inputId?: string
): Promise<{ selected: boolean; field: string; value: string }> {
  debug(`queryAndSelectInPopup: field=${fieldLabel}, query=${queryText}`);

  // 1. 点击字段旁边的蓝色按钮打开弹窗
  let btnResult: CDPBtnResult;
  if (inputId) {
    btnResult = await cdpFindPickerButtonByInputId(inputId);
  } else {
    // 通过标签文本查找按钮
    btnResult = (await cdpEvaluate(`
      (function() {
        var modal = document.querySelector('.ant-modal-wrap');
        if (!modal) modal = document.body;

        var walker = document.createTreeWalker(modal, NodeFilter.SHOW_TEXT, null, false);
        var labelEl = null;
        var node;
        while (node = walker.nextNode()) {
          if (node.textContent.trim() === '${fieldLabel}：' || node.textContent.trim() === '${fieldLabel}') {
            var rect = node.parentElement.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              labelEl = node.parentElement;
              break;
            }
          }
        }

        if (!labelEl) return { found: false, reason: 'label_not_found' };

        var row = labelEl.parentElement;
        while (row && row.parentElement) {
          var rect = row.getBoundingClientRect();
          if (rect.width > 200) break;
          row = row.parentElement;
        }

        var buttons = Array.from(row.querySelectorAll('${PICKER_BTN_SELECTOR}'));
        var target = buttons.find(function(btn) {
          var rect = btn.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });

        if (!target) return { found: false, reason: 'button_not_found' };

        var rect = target.getBoundingClientRect();
        return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
      })()
    `)) as CDPBtnResult;
  }

  if (!btnResult?.found) {
    throw new Error(
      `未找到 ${fieldLabel} 的按钮: ${btnResult?.reason || 'unknown'}`
    );
  }

  if (btnResult.x === undefined || btnResult.y === undefined) {
    throw new Error(`未找到 ${fieldLabel} 的按钮坐标`);
  }

  await cdpClick(btnResult.x, btnResult.y, 2000);
  debug(`已点击 ${fieldLabel} 按钮，等待弹窗打开...`);

  // 2. 在弹窗查询框中输入查询关键字
  const fillResult = await evaluate(`
    (function() {
      var popup = ${getVisiblePopupCode()};
      if (!popup) return { found: false, reason: 'popup_not_found' };

      var input = popup.querySelector('input[type="text"]');
      if (!input) {
        // 尝试查找任何输入框
        var allInputs = popup.querySelectorAll('input');
        for (var i = 0; i < allInputs.length; i++) {
          if (allInputs[i].type === 'text' || allInputs[i].type === '') {
            input = allInputs[i];
            break;
          }
        }
      }
      if (!input) return { found: false, reason: 'input_not_found' };

      input.focus();
      input.value = ${JSON.stringify(queryText)};
      input.setAttribute('value', ${JSON.stringify(queryText)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.blur();

      return { found: true, filled: true };
    })()
  `);

  const fillValue = (fillResult as QueryFillResult).data?.value;
  if (!fillValue?.found) {
    throw new Error(`弹窗查询框填充失败: ${fillValue?.reason || 'unknown'}`);
  }

  await new Promise((r) => setTimeout(r, 500));

  // 3. 点击弹窗中的查询按钮
  const queryBtn = await cdpFindPopupElementByText('查询');
  if (queryBtn?.found && queryBtn.x !== undefined && queryBtn.y !== undefined) {
    await cdpClick(queryBtn.x, queryBtn.y, 2000);
    debug('已点击弹窗查询按钮');
  }

  // 4. 等待查询结果加载，最多等待 5 秒
  let attempts = 0;
  let rowFound = false;
  while (attempts < 10 && !rowFound) {
    await new Promise((r) => setTimeout(r, 500));
    const checkResult = await evaluate(`
      (function() {
        var popup = ${getVisiblePopupCode()};
        if (!popup) return { found: false, reason: 'popup_closed' };
        var rows = popup.querySelectorAll('tr');
        for (var i = 0; i < rows.length; i++) {
          if (rows[i].textContent.indexOf(${JSON.stringify(queryText)}) >= 0) {
            return { found: true };
          }
        }
        return { found: false };
      })()
    `);
    if ((checkResult as CheckResult).data?.value?.found) {
      rowFound = true;
    }
    attempts++;
  }

  if (!rowFound) {
    throw new Error(`查询结果未找到: ${queryText}`);
  }

  // 5. 使用 CDP 真实鼠标点击目标行
  const selectResult = await cdpEvaluateAndClick(
    `
    (function() {
      var popup = ${getVisiblePopupCode()};
      if (!popup) return { found: false, reason: 'popup_not_found' };

      var rows = popup.querySelectorAll('tr');
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].textContent.indexOf(${JSON.stringify(queryText)}) >= 0) {
          var rect = rows[i].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
          }
        }
      }
      return { found: false, reason: 'row_not_found' };
    })()
  `,
    { sleepMs: 500 }
  );

  if (!selectResult || !('clicked' in selectResult) || !selectResult.clicked) {
    throw new Error(`点击目标行失败: ${queryText}`);
  }

  debug(`已选择 ${fieldLabel}: ${queryText}`);

  // 6. 点击确定按钮关闭弹窗
  const confirmBtn = await cdpFindPopupElementByText('确定');
  if (
    confirmBtn?.found &&
    confirmBtn.x !== undefined &&
    confirmBtn.y !== undefined
  ) {
    await cdpClick(confirmBtn.x, confirmBtn.y, 1500);
    debug('已点击弹窗确定按钮');
  }

  await new Promise((r) => setTimeout(r, 1000));
  return { selected: true, field: fieldLabel, value: queryText };
}

/**
 * 选择部门弹窗中的第一个可用部门
 * @returns 选中的部门名称
 */
export async function selectFirstDepartment(): Promise<string | null> {
  debug('selectFirstDepartment');

  // 1. 打开部门弹窗
  const btnResult = await cdpFindPickerButtonByInputId(
    'DataSetFieldComboBox2-input'
  );
  if (!btnResult?.found) {
    throw new Error('未找到部门按钮');
  }

  if (btnResult.x === undefined || btnResult.y === undefined) {
    throw new Error('未找到部门按钮坐标');
  }

  await cdpClick(btnResult.x, btnResult.y, 2000);
  debug('已打开部门弹窗');

  // 2. 等待弹窗加载，读取部门列表
  await new Promise((r) => setTimeout(r, 1500));

  const popupInfo = await evaluate(`
    (function() {
      var popup = ${getVisiblePopupCode()};
      if (!popup) return { found: false, reason: 'popup_not_found' };

      var rows = popup.querySelectorAll('tr');
      var departments = [];
      for (var i = 0; i < rows.length; i++) {
        var text = rows[i].textContent.trim();
        if (text && text.length > 2 && !text.includes('序号') && !text.includes('部门编号')) {
          departments.push(text);
        }
      }

      return { found: true, departments: departments, rowCount: rows.length };
    })()
  `);

  const popupData = (popupInfo as PopupInfoResult).data?.value;
  if (
    !popupData?.found ||
    !popupData.departments ||
    popupData.departments.length === 0
  ) {
    // 关闭弹窗
    await closePickerPopup();
    throw new Error('部门列表为空');
  }

  // 3. 选择第一个部门（使用 CDP 点击第一行）
  const firstDeptName = popupData.departments[0];
  debug('选择第一个部门:', firstDeptName);

  const selectResult = await cdpEvaluateAndClick(
    `
    (function() {
      var popup = ${getVisiblePopupCode()};
      if (!popup) return { found: false, reason: 'popup_not_found' };

      var rows = popup.querySelectorAll('tr');
      for (var i = 0; i < rows.length; i++) {
        var text = rows[i].textContent.trim();
        if (text && text.length > 2 && !text.includes('序号')) {
          var rect = rows[i].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
          }
        }
      }
      return { found: false, reason: 'row_not_found' };
    })()
  `,
    { sleepMs: 500 }
  );

  if (!selectResult || !('clicked' in selectResult) || !selectResult.clicked) {
    await closePickerPopup();
    throw new Error('点击部门行失败');
  }

  // 4. 点击确定按钮
  const confirmBtn = await cdpFindPopupElementByText('确定');
  if (
    confirmBtn?.found &&
    confirmBtn.x !== undefined &&
    confirmBtn.y !== undefined
  ) {
    await cdpClick(confirmBtn.x, confirmBtn.y, 1500);
    debug('已点击部门弹窗确定');
  }

  await new Promise((r) => setTimeout(r, 1000));
  return firstDeptName;
}

/**
 * 读取选择弹窗中的列表项
 */
export async function readPickerPopupItems(): Promise<PopupItemsResult> {
  debug('readPickerPopupItems');

  const result = await evaluate(`
    (function() {
      var popup = ${getVisiblePopupCode()};
      if (!popup) {
        return { ok: false, error: '选择弹窗未找到' };
      }

      var text = popup.textContent;

      // 判断弹窗类型
      var title = '';
      if (text.includes('组织机构')) title = '组织机构';
      else if (text.includes('项目名称')) title = '项目名称';
      else if (text.includes('部门名称')) title = '部门名称';

      // 提取数据行（通用提取逻辑）
      var startIdx = text.indexOf('明细');
      if (startIdx >= 0) startIdx += 2;
      var endIdx = text.indexOf('确定取消');
      if (endIdx < 0) endIdx = text.length;
      var dataText = text.substring(startIdx, endIdx);

      var items = [];

      // 模式：20位代码 + 名称 + 1位级数（经真实浏览器验证）
      var regex = /(\d{20})([\u4e00-\u9fa5][\u4e00-\u9fa5a-zA-Z0-9（）]*?)(\d)(?=\d{20}|$)/g;
      var match;
      while ((match = regex.exec(dataText)) !== null) {
        items.push({ code: match[1], name: match[2], level: match[3] });
      }

      // 查找按钮
      var allDivs = popup.querySelectorAll('div');
      var buttons = [];
      for (var b = 0; b < allDivs.length; b++) {
        var btnText = allDivs[b].textContent.trim();
        if (btnText && (btnText === '查询' || btnText === '刷新' || btnText === '确定' || btnText === '取消' || btnText === '清空')) {
          buttons.push(btnText);
        }
      }

      return {
        ok: true,
        title: title,
        itemCount: items.length,
        items: items,
        buttons: [...new Set(buttons)],
      };
    })()
  `);

  return (result as EvaluateResult).data?.value || (result as PopupItemsResult);
}

/**
 * 关闭选择弹窗（点击取消按钮）
 */
export async function closePickerPopup(): Promise<boolean> {
  debug('closePickerPopup');

  const result = await evaluate(`
    (function() {
      var popup = ${getVisiblePopupCode()};
      if (!popup) {
        return { closed: true, reason: 'already_closed' };
      }

      var walker = document.createTreeWalker(popup, NodeFilter.SHOW_TEXT, null, false);
      var node;
      while (node = walker.nextNode()) {
        if (node.textContent.trim() === '取消') {
          var el = node.parentElement;
          while (el && el.tagName !== 'BUTTON' && el.tagName !== 'A' && el.tagName !== 'DIV') {
            el = el.parentElement;
          }
          if (el) {
            el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
            el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
            return { closed: true, reason: 'clicked_cancel' };
          }
        }
      }

      return { closed: false, reason: 'cancel_not_found' };
    })()
  `);

  await new Promise((r) => setTimeout(r, 1000));
  return (
    ((result as EvaluateResult).data?.value as { closed?: boolean } | undefined)
      ?.closed || false
  );
}

/**
 * 点击刷新按钮（在项目选择后刷新部门列表）
 */
export async function clickRefreshButton(): Promise<boolean> {
  debug('clickRefreshButton');

  const btnResult = (await cdpEvaluate(`
    (function() {
      var modal = document.querySelector('.ant-modal-wrap');
      if (!modal) return { found: false, reason: 'dialog_not_found' };

      var all = modal.querySelectorAll('*');
      var candidates = [];
      for (var i = 0; i < all.length; i++) {
        var text = all[i].textContent.trim();
        if (text === '刷新') {
          var rect = all[i].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            candidates.push({ x: rect.left + rect.width/2, y: rect.top + rect.height/2, top: rect.top });
          }
        }
      }

      if (candidates.length === 0) return { found: false, reason: 'button_not_found' };
      // 选择 y 坐标最大的（最下面的刷新按钮）
      candidates.sort(function(a, b) { return b.top - a.top; });
      return { found: true, x: candidates[0].x, y: candidates[0].y };
    })()
  `)) as CDPBtnResult;

  if (
    btnResult?.found &&
    btnResult.x !== undefined &&
    btnResult.y !== undefined
  ) {
    await cdpClick(btnResult.x, btnResult.y, 2000);
    debug('已点击刷新按钮');
    return true;
  }

  return false;
}
