/**
 * 组织机构切换模块
 * 支持打开切换组织机构对话框、读取当前信息、选择组织机构/项目/部门
 * 基于真实浏览器测试的 GWT ComboBox 交互机制
 *
 * 操作流程（经真实浏览器验证）：
 * 1. 点击 img[src*="qhzz"] 打开切换组织机构对话框
 * 2. 点击输入框旁的 div.FD26IYC-w-l 蓝色按钮，弹出选择窗口
 * 3. 在选择窗口查询框中输入查询关键字
 * 4. 点击查询按钮
 * 5. 点击目标行（CDP 真实鼠标点击）
 * 6. 点击选择窗口的"确定"按钮（CDP 真实鼠标点击）
 * 7. 值自动回填到原对话框，选择弹窗自动关闭
 * 8. 重复 2-6 选择项目、部门
 * 9. 点击原对话框的"确定"完成切换
 * 10. 点击系统提示"切换成功"的确定按钮
 */

import { evaluate } from '../browser';
import { debug } from '../logger';
import {
  addOrganizationRecord,
  findOrganization,
  getCacheStats,
  type OrganizationRecord,
  type CacheStats,
} from './organization-cache';
import type {
  ClickResult,
  EvaluateAndClickOptions,
  FindElementResult,
} from './cdp';

// CDP 工具（用于真实鼠标点击）
interface CDPUtils {
  cdpEvaluate(expression: string): Promise<unknown>;
  cdpClick(x: number, y: number, sleepMs?: number): Promise<ClickResult>;
  cdpFindPickerButtonByInputId(inputId: string): Promise<FindElementResult & { reason?: string }>;
  cdpFindPopupElementByText(text: string, constraints?: { leftMin?: number; leftMax?: number }): Promise<FindElementResult & { reason?: string }>;
  cdpEvaluateAndClick(
    expression: string,
    options?: EvaluateAndClickOptions
  ): Promise<ClickResult | { clicked: false; reason: string }>;
}

let cdpUtils: CDPUtils | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  cdpUtils = require('./cdp') as CDPUtils;
} catch (e) {
  cdpUtils = null;
}

const SWITCH_ORG_IMG_SRC = 'qhzz';
const DIALOG_WRAP_SELECTOR =
  '.ant-modal-wrap.CscecFormWindow, .ant-modal-wrap.FormWindow';
const DIALOG_SELECTOR =
  '.ant-modal.CscecFormWindow, .ant-modal.FormWindow, .ant-modal-content';
const DIALOG_TITLE_SELECTOR = '.ant-modal-title';
const CLOSE_BTN_SELECTOR = '.ant-modal-close';

// 选择弹窗相关 class（经真实浏览器验证）
const PICKER_POPUP_SELECTOR = '.FD26IYC-a-g';
const PICKER_BTN_SELECTOR = 'div.FD26IYC-w-l';
const BUTTON_CLASS = 'FD26IYC-D-d FD26IYC-D-o';

interface DialogField {
  id: string;
  value: string;
  placeholder: string;
}

interface DialogValue {
  ok: boolean;
  error?: string;
  title?: string;
  fields?: Record<string, DialogField>;
  buttons?: string[];
}

interface EvaluateResult {
  data?: {
    value?: DialogValue & Record<string, unknown>;
  };
}

interface PopupItemsResult {
  ok: boolean;
  error?: string;
  title?: string;
  itemCount?: number;
  items?: Array<{ code: string; name: string; level: string }>;
  buttons?: string[];
}

interface SwitchOrganizationOptions {
  organization?: string;
  project?: string;
  department?: string;
  fromCache?: boolean;
  autoSelect?: boolean;
}

interface SwitchOrganizationResult {
  success: boolean;
  mode: string;
  current?: OrganizationRecord;
  selection?: AutoSelectResult | { error: string; partial: AutoSelectResult } | null;
  cache?: {
    isNewRecord: boolean;
    totalRecords: number;
    uniqueOrganizations: string[];
  };
  matches?: OrganizationRecord[];
  matchCount?: number;
}

interface AutoSelectResult {
  organization: { selected: boolean; name: string } | null;
  project: { selected: boolean; name: string } | null;
  department: { selected: boolean; name: string } | null;
}

interface CloseResult {
  data?: {
    value?: {
      closed?: boolean;
    };
  };
}

interface PopupCloseResult {
  data?: {
    value?: {
      closed?: number;
    };
  };
}

interface QueryFillResult {
  data?: {
    value?: {
      found?: boolean;
      reason?: string;
      filled?: boolean;
    };
  };
}

interface CheckResult {
  data?: {
    value?: {
      found?: boolean;
      reason?: string;
    };
  };
}

interface PopupInfoResult {
  data?: {
    value?: {
      found?: boolean;
      reason?: string;
      departments?: string[];
      rowCount?: number;
    };
  };
}

interface HeaderResult {
  data?: {
    value?: {
      found?: boolean;
      source?: string;
      organization?: string;
    };
  };
}

interface CDPBtnResult {
  found?: boolean;
  reason?: string;
  x?: number;
  y?: number;
  candidate?: Record<string, unknown>;
}

/**
 * 获取可见的选择弹窗
 */
function getVisiblePopupCode(): string {
  return `
    (function() {
      var popups = document.querySelectorAll('${PICKER_POPUP_SELECTOR}');
      for (var i = 0; i < popups.length; i++) {
        var rect = popups[i].getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && rect.left > 0 && rect.top > 0 && rect.top < window.innerHeight) {
          return popups[i];
        }
      }
      return null;
    })()
  `;
}

/**
 * 关闭所有切换组织机构对话框和弹窗
 */
async function closeAllOrgDialogs(): Promise<boolean> {
  debug('closeAllOrgDialogs');

  // 1. 关闭切换组织机构主对话框
  let result: CloseResult;
  try {
    result = await evaluate(`
      (function() {
        var closed = false;
        
        // 查找所有切换组织机构对话框并关闭
        var modals = document.querySelectorAll('.ant-modal-wrap');
        for (var i = 0; i < modals.length; i++) {
          if (modals[i].textContent.includes('切换组织机构')) {
            // 点击关闭按钮
            var closeBtn = modals[i].querySelector('.ant-modal-close');
            if (closeBtn) {
              closeBtn.click();
              closed = true;
            }
          }
        }
        
        return { closed: closed };
      })()
    `);
  } catch (e) {
    debug('closeAllOrgDialogs: error closing dialogs:', (e as Error).message);
    result = { data: { value: { closed: false } } };
  }

  // 2. 关闭所有选择弹窗
  let popupResult: PopupCloseResult;
  try {
    popupResult = await evaluate(`
      (function() {
        var popups = document.querySelectorAll('${PICKER_POPUP_SELECTOR}');
        var closed = 0;
        for (var i = 0; i < popups.length; i++) {
          var rect = popups[i].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && rect.left > 0) {
            // 点击取消按钮
            var walker = document.createTreeWalker(popups[i], NodeFilter.SHOW_TEXT, null, false);
            var node;
            while (node = walker.nextNode()) {
              if (node.textContent.trim() === '取消') {
                var el = node.parentElement;
                while (el && el.tagName !== 'BUTTON' && el.tagName !== 'A' && el.tagName !== 'DIV') {
                  el = el.parentElement;
                }
                if (el) {
                  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                  closed++;
                  break;
                }
              }
            }
          }
        }
        return { closed: closed };
      })()
    `);
  } catch (e) {
    debug('closeAllOrgDialogs: error closing popups:', (e as Error).message);
    popupResult = { data: { value: { closed: 0 } } };
  }

  await new Promise((r) => setTimeout(r, 1000));
  return result?.data?.value?.closed || (popupResult?.data?.value?.closed ?? 0) > 0;
}

/**
 * 打开切换组织机构对话框
 */
async function openSwitchOrgDialog(): Promise<DialogValue> {
  debug('openSwitchOrgDialog: clicking switch org button');

  // 先关闭所有已打开的对话框和弹窗
  await closeAllOrgDialogs();

  const clickResult = await evaluate(`
    (function() {
      var img = document.querySelector('img[src*="${SWITCH_ORG_IMG_SRC}"]');
      if (!img) {
        return { ok: false, error: '切换组织机构按钮未找到' };
      }
      var clickable = img.closest('a, button, [onclick], .ant-dropdown-trigger, .ant-menu-item');
      if (!clickable) clickable = img.parentElement;
      if (!clickable) clickable = img;
      clickable.click();
      return { ok: true };
    })()
  `);

  const clickValue = (clickResult as EvaluateResult).data?.value;
  if (!clickValue?.ok) {
    throw new Error(
      clickValue?.error || '点击切换组织机构按钮失败'
    );
  }

  await new Promise((r) => setTimeout(r, 1500));
  return readDialogFields();
}

/**
 * 读取对话框字段
 */
async function readDialogFields(): Promise<DialogValue> {
  const dialogInfo = await evaluate(`
    (function() {
      var modal = document.querySelector('${DIALOG_SELECTOR}');
      if (!modal) {
        return { ok: false, error: '切换组织机构对话框未弹出' };
      }

      var titleEl = modal.querySelector('${DIALOG_TITLE_SELECTOR}');
      var title = titleEl ? titleEl.textContent.trim() : '';

      var fields = {};
      var labels = modal.querySelectorAll('label, .ant-form-item-label');
      var inputs = modal.querySelectorAll('input, select, textarea');

      for (var i = 0; i < inputs.length; i++) {
        var inp = inputs[i];
        var id = inp.id || '';
        var value = inp.value || '';
        var placeholder = inp.placeholder || '';

        var fieldName = '';
        
        // 优先使用ID映射（更可靠）
        if (id) {
          if (id.includes('ComboBox1')) fieldName = '组织机构';
          else if (id.includes('ComboBox3')) fieldName = '项目名称';
          else if (id.includes('ComboBox2')) fieldName = '部门名称';
          else if (id.includes('TextInput2')) fieldName = '板块编号';
          else if (id.includes('TextInput3')) fieldName = '板块名称';
          else if (id.includes('TextInput1')) fieldName = '利润中心';
        }
        
        // ID映射失败时，使用标签位置匹配作为兜底
        if (!fieldName) {
          for (var j = 0; j < labels.length; j++) {
            var labelText = (labels[j].textContent || '').replace(/[：:]/g, '').trim();
            var labelRect = labels[j].getBoundingClientRect();
            var inputRect = inp.getBoundingClientRect();
            if (Math.abs(labelRect.top - inputRect.top) < 50 && labelRect.left < inputRect.left) {
              fieldName = labelText;
              break;
            }
          }
        }

        if (fieldName) {
          fields[fieldName] = {
            id: id,
            value: value,
            placeholder: placeholder,
          };
        }
      }

      var buttons = [];
      var allElements = modal.querySelectorAll('*');
      for (var k = 0; k < allElements.length; k++) {
        var txt = (allElements[k].textContent || '').trim();
        if (txt && (txt === '刷新' || txt === '确定' || txt === '取消')) {
          buttons.push(txt);
        }
      }

      return {
        ok: true,
        title: title,
        fields: fields,
        buttons: [...new Set(buttons)],
      };
    })()
  `);

  const dialogValue = (dialogInfo as EvaluateResult).data?.value || (dialogInfo as DialogValue);
  if (!dialogValue.ok) {
    throw new Error(dialogValue.error || '读取对话框失败');
  }
  return dialogValue;
}

/**
 * 关闭切换组织机构对话框
 * @param action - 'cancel' 取消, 'confirm' 确定
 */
async function closeSwitchOrgDialog(action: 'cancel' | 'confirm' = 'cancel'): Promise<boolean> {
  debug('closeSwitchOrgDialog: action=', action);

  if (!cdpUtils) {
    throw new Error('CDP 工具不可用，无法关闭对话框');
  }

  const targetText = action === 'cancel' ? '取消' : '确定';

  // 使用 CDP 查找对话框中的按钮并真实点击
  // 策略：在对话框区域内查找包含目标文本的元素，选择 y 坐标最大的（最下面的）
  const btnResult = (await cdpUtils.cdpEvaluate(`
    (function() {
      var modal = document.querySelector('${DIALOG_WRAP_SELECTOR}');
      if (!modal) return { found: false, reason: 'dialog_not_found' };
      
      var all = modal.querySelectorAll('*');
      var candidates = [];
      for (var i = 0; i < all.length; i++) {
        var text = all[i].textContent.trim();
        if (text === '${targetText}') {
          var rect = all[i].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            candidates.push({ x: rect.left + rect.width/2, y: rect.top + rect.height/2, top: rect.top, tag: all[i].tagName, class: all[i].className });
          }
        }
      }
      
      if (candidates.length === 0) return { found: false, reason: 'button_not_found' };
      // 选择 y 坐标最大的（最下面的按钮）
      candidates.sort(function(a, b) { return b.top - a.top; });
      return { found: true, x: candidates[0].x, y: candidates[0].y, candidate: candidates[0] };
    })()
  `)) as CDPBtnResult;

  debug('closeSwitchOrgDialog: btnResult=', JSON.stringify(btnResult));

  if (btnResult?.found && btnResult.x !== undefined && btnResult.y !== undefined) {
    await cdpUtils.cdpClick(btnResult.x, btnResult.y, 3000);
    debug(
      'closeSwitchOrgDialog: clicked',
      targetText,
      'at',
      btnResult.x,
      btnResult.y
    );
    return true;
  }

  // 兜底：使用 dispatchEvent
  debug('closeSwitchOrgDialog: fallback to dispatchEvent');
  const result = await evaluate(`
    (function() {
      var modal = document.querySelector('${DIALOG_WRAP_SELECTOR}');
      if (!modal) {
        return { ok: true, closed: true, reason: '对话框已关闭' };
      }

      var walker = document.createTreeWalker(modal, NodeFilter.SHOW_TEXT, null, false);
      var node;
      while (node = walker.nextNode()) {
        if (node.textContent.trim() === '${targetText}') {
          var el = node.parentElement;
          while (el && el.tagName !== 'BUTTON' && el.tagName !== 'A' && el.tagName !== 'DIV') {
            el = el.parentElement;
          }
          if (el) {
            el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
            el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
            return { ok: true, closed: true, clicked: '${targetText}' };
          }
        }
      }

      var closeBtn = document.querySelector('${CLOSE_BTN_SELECTOR}');
      if (closeBtn) {
        closeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        return { ok: true, closed: true, method: 'close_x' };
      }

      return { ok: false, error: '未找到${targetText}按钮' };
    })()
  `);

  await new Promise((r) => setTimeout(r, 1500));
  return (result as EvaluateResult).data?.value?.closed || false;
}

/**
 * 在弹窗中查询并选择项目
 * 参考台账查询的 pickFromDict 模式
 * @param fieldLabel - 字段标签，如 '组织机构'、'项目名称'、'部门名称'
 * @param queryText - 查询文本
 * @param inputId - 输入框ID（可选，用于精确定位按钮）
 */
async function queryAndSelectInPopup(
  fieldLabel: string,
  queryText: string,
  inputId?: string
): Promise<{ selected: boolean; field: string; value: string }> {
  debug(`queryAndSelectInPopup: field=${fieldLabel}, query=${queryText}`);

  if (!cdpUtils) {
    throw new Error('CDP 工具不可用，无法自动选择');
  }

  // 1. 点击字段旁边的蓝色按钮打开弹窗
  let btnResult: CDPBtnResult;
  if (inputId) {
    btnResult = await cdpUtils.cdpFindPickerButtonByInputId(inputId);
  } else {
    // 通过标签文本查找按钮
    btnResult = (await cdpUtils.cdpEvaluate(`
      (function() {
        var modal = document.querySelector('${DIALOG_WRAP_SELECTOR}');
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

  await cdpUtils.cdpClick(btnResult.x, btnResult.y, 2000);
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
      input.value = '${queryText.replace(/'/g, "\\'")}';
      input.setAttribute('value', '${queryText.replace(/'/g, "\\'")}');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.blur();
      
      return { found: true, filled: true };
    })()
  `);

  const fillValue = (fillResult as QueryFillResult).data?.value;
  if (!fillValue?.found) {
    throw new Error(
      `弹窗查询框填充失败: ${fillValue?.reason || 'unknown'}`
    );
  }

  await new Promise((r) => setTimeout(r, 500));

  // 3. 点击弹窗中的查询按钮
  const queryBtn = await cdpUtils.cdpFindPopupElementByText('查询');
  if (queryBtn?.found && queryBtn.x !== undefined && queryBtn.y !== undefined) {
    await cdpUtils.cdpClick(queryBtn.x, queryBtn.y, 2000);
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
          if (rows[i].textContent.indexOf('${queryText.replace(/'/g, "\\'")}') >= 0) {
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
  const selectResult = await cdpUtils.cdpEvaluateAndClick(
    `
    (function() {
      var popup = ${getVisiblePopupCode()};
      if (!popup) return { found: false, reason: 'popup_not_found' };
      
      var rows = popup.querySelectorAll('tr');
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].textContent.indexOf('${queryText.replace(/'/g, "\\'")}') >= 0) {
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
  const confirmBtn = await cdpUtils.cdpFindPopupElementByText('确定');
  if (confirmBtn?.found && confirmBtn.x !== undefined && confirmBtn.y !== undefined) {
    await cdpUtils.cdpClick(confirmBtn.x, confirmBtn.y, 1500);
    debug('已点击弹窗确定按钮');
  }

  await new Promise((r) => setTimeout(r, 1000));
  return { selected: true, field: fieldLabel, value: queryText };
}

/**
 * 点击刷新按钮（在项目选择后刷新部门列表）
 */
async function clickRefreshButton(): Promise<boolean> {
  debug('clickRefreshButton');

  if (!cdpUtils) {
    throw new Error('CDP 工具不可用');
  }

  const btnResult = (await cdpUtils.cdpEvaluate(`
    (function() {
      var modal = document.querySelector('${DIALOG_WRAP_SELECTOR}');
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

  if (btnResult?.found && btnResult.x !== undefined && btnResult.y !== undefined) {
    await cdpUtils.cdpClick(btnResult.x, btnResult.y, 2000);
    debug('已点击刷新按钮');
    return true;
  }

  return false;
}

/**
 * 点击系统提示弹窗的确定按钮
 */
async function clickSystemConfirm(): Promise<boolean> {
  debug('clickSystemConfirm');

  if (!cdpUtils) {
    throw new Error('CDP 工具不可用');
  }

  // 等待系统提示弹窗出现
  let attempts = 0;
  let confirmBtn: CDPBtnResult | null = null;
  while (attempts < 10 && !confirmBtn) {
    await new Promise((r) => setTimeout(r, 500));

    // 查找所有包含"确定"文本的可见元素，选择 y 坐标最小的（最上面的，通常是系统提示的）
    const result = (await cdpUtils.cdpEvaluate(`
      (function() {
        var all = document.querySelectorAll('*');
        var candidates = [];
        for (var i = 0; i < all.length; i++) {
          var text = all[i].textContent.trim();
          var rect = all[i].getBoundingClientRect();
          if (text === '确定' && rect.width > 0 && rect.height > 0 && rect.top > 0 && rect.top < window.innerHeight) {
            candidates.push({ x: rect.left + rect.width/2, y: rect.top + rect.height/2, top: rect.top, tag: all[i].tagName, class: all[i].className });
          }
        }
        if (candidates.length === 0) return { found: false, reason: 'no_candidates' };
        // 选择 y 坐标最小的（最上面的确定按钮，通常是系统提示的）
        candidates.sort(function(a, b) { return a.top - b.top; });
        return { found: true, x: candidates[0].x, y: candidates[0].y, candidate: candidates[0] };
      })()
    `)) as CDPBtnResult;

    debug(
      'clickSystemConfirm: attempt',
      attempts,
      'result=',
      JSON.stringify(result)
    );

    if (result?.found) {
      confirmBtn = result;
      break;
    }
    attempts++;
  }

  if (confirmBtn && confirmBtn.x !== undefined && confirmBtn.y !== undefined) {
    await cdpUtils.cdpClick(confirmBtn.x, confirmBtn.y, 2000);
    debug('clickSystemConfirm: clicked at', confirmBtn.x, confirmBtn.y);
    return true;
  }

  return false;
}

/**
 * 获取当前组织机构信息
 */
async function getCurrentOrganization(): Promise<{ organization: string; fromDialog?: boolean }> {
  debug('getCurrentOrganization');

  const fromHeader = await evaluate(`
    (function() {
      var orgEls = document.querySelectorAll('[class*="org"], [class*="company"], [class*="dept"]');
      for (var i = 0; i < orgEls.length; i++) {
        var text = (orgEls[i].textContent || '').trim();
        if (text && text.length > 5 && text.length < 100) {
          return { found: true, source: 'header', organization: text };
        }
      }
      return { found: false };
    })()
  `);

  const headerValue = (fromHeader as HeaderResult).data?.value;
  if (headerValue?.found) {
    return { organization: headerValue.organization || '' };
  }

  let dialog: DialogValue;
  try {
    dialog = await openSwitchOrgDialog();
  } catch (e) {
    throw new Error('无法获取当前组织机构信息：' + (e as Error).message, { cause: e });
  }
  if (dialog.ok && dialog.fields && dialog.fields['组织机构']) {
    const org = dialog.fields['组织机构'].value;
    await closeSwitchOrgDialog('cancel');
    return { organization: org, fromDialog: true };
  }

  throw new Error('无法获取当前组织机构信息');
}

/**
 * 切换组织机构（完整流程）
 * @param options - 配置选项
 * @param options.organization - 目标组织机构名称
 * @param options.project - 目标项目名称
 * @param options.department - 目标部门名称
 * @param options.fromCache - 是否仅从缓存查找
 * @param options.autoSelect - 是否尝试自动选择（需要 CDP）
 */
async function switchOrganization(options: SwitchOrganizationOptions = {}): Promise<SwitchOrganizationResult> {
  debug('switchOrganization: options=', JSON.stringify(options));

  if (options.fromCache) {
    const matches = findOrganization({
      organization: options.organization,
      project: options.project,
      department: options.department,
    });
    return {
      success: true,
      mode: 'cache_query',
      matches: matches,
      matchCount: matches.length,
    };
  }

  // 打开对话框
  const dialog = await openSwitchOrgDialog();
  if (!dialog.ok) {
    throw new Error(dialog.error || '打开切换组织机构对话框失败');
  }

  try {
    // 读取当前信息
    const currentInfo: OrganizationRecord = {
      organization: dialog.fields?.['组织机构']?.value || '',
      project: dialog.fields?.['项目名称']?.value || '',
      department: dialog.fields?.['部门名称']?.value || '',
      plateCode: dialog.fields?.['板块编号']?.value,
      plateName: dialog.fields?.['板块名称']?.value,
      profitCenter: dialog.fields?.['利润中心']?.value,
    };

    // 自动记录到缓存
    const isNewRecord = addOrganizationRecord(currentInfo);
    debug('switchOrganization: cache record added, isNew=', isNewRecord);

    // 如果提供了目标值且启用了自动选择，尝试使用 CDP 选择
    let selectionResult: AutoSelectResult | { error: string; partial: AutoSelectResult } | null = null;
    if (options.autoSelect && cdpUtils) {
      selectionResult = await tryAutoSelect(dialog.fields || {}, options);

      // 自动选择完成后，点击对话框"确定"完成切换
      if (selectionResult && !('error' in selectionResult)) {
        await closeSwitchOrgDialog('confirm');

        // 点击系统提示"切换成功"的确定按钮
        await clickSystemConfirm();
      } else {
        await closeSwitchOrgDialog('cancel');
      }
    } else {
      // 查询模式，点击"取消"
      await closeSwitchOrgDialog('cancel');
    }

    const cacheStats = getCacheStats();

    return {
      success: true,
      mode: selectionResult ? 'auto_select' : 'query',
      current: currentInfo,
      selection: selectionResult,
      cache: {
        isNewRecord: isNewRecord,
        totalRecords: cacheStats.totalRecords,
        uniqueOrganizations: cacheStats.uniqueOrganizations,
      },
    };
  } catch (e) {
    // 出错时取消对话框和弹窗
    await closeSwitchOrgDialog('cancel');
    throw e;
  }
}

/**
 * 选择部门弹窗中的第一个可用部门
 * @returns 选中的部门名称
 */
async function selectFirstDepartment(): Promise<string | null> {
  debug('selectFirstDepartment');

  if (!cdpUtils) {
    throw new Error('CDP 工具不可用');
  }

  // 1. 打开部门弹窗
  const btnResult = await cdpUtils.cdpFindPickerButtonByInputId(
    'DataSetFieldComboBox2-input'
  );
  if (!btnResult?.found) {
    throw new Error('未找到部门按钮');
  }

  if (btnResult.x === undefined || btnResult.y === undefined) {
    throw new Error('未找到部门按钮坐标');
  }

  await cdpUtils.cdpClick(btnResult.x, btnResult.y, 2000);
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

  const depts = (popupInfo as PopupInfoResult).data?.value || (popupInfo as { found?: boolean; reason?: string; departments?: string[]; rowCount?: number });
  debug('部门列表:', JSON.stringify(depts));

  const popupData = (popupInfo as PopupInfoResult).data?.value;
  if (!popupData?.found || !popupData.departments || popupData.departments.length === 0) {
    // 关闭弹窗
    await closePickerPopup();
    throw new Error('部门列表为空');
  }

  // 3. 选择第一个部门（使用 CDP 点击第一行）
  const firstDeptName = popupData.departments[0];
  debug('选择第一个部门:', firstDeptName);

  const selectResult = await cdpUtils.cdpEvaluateAndClick(
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
  const confirmBtn = await cdpUtils.cdpFindPopupElementByText('确定');
  if (confirmBtn?.found && confirmBtn.x !== undefined && confirmBtn.y !== undefined) {
    await cdpUtils.cdpClick(confirmBtn.x, confirmBtn.y, 1500);
    debug('已点击部门弹窗确定');
  }

  await new Promise((r) => setTimeout(r, 1000));
  return firstDeptName;
}

/**
 * 尝试自动选择组织机构/项目/部门
 * @param fields - 当前对话框字段
 * @param options - 目标值
 */
async function tryAutoSelect(
  fields: Record<string, DialogField> | undefined,
  options: SwitchOrganizationOptions
): Promise<AutoSelectResult | { error: string; partial: AutoSelectResult }> {
  debug('tryAutoSelect');

  const result: AutoSelectResult = {
    organization: null,
    project: null,
    department: null,
  };

  try {
    // 1. 选择组织机构
    if (options.organization) {
      await queryAndSelectInPopup(
        '组织机构',
        options.organization,
        'DataSetFieldComboBox1-input'
      );
      result.organization = { selected: true, name: options.organization };
    }

    // 2. 选择项目
    if (options.project) {
      await queryAndSelectInPopup(
        '项目名称',
        options.project,
        'DataSetFieldComboBox3-input'
      );
      result.project = { selected: true, name: options.project };
    }

    // 3. 点击刷新按钮（刷新部门列表）
    await clickRefreshButton();

    // 4. 选择部门（必填字段）
    if (options.department) {
      await queryAndSelectInPopup(
        '部门名称',
        options.department,
        'DataSetFieldComboBox2-input'
      );
      result.department = { selected: true, name: options.department };
    } else {
      // 如果没有指定部门，尝试选择第一个可用部门
      debug(
        'tryAutoSelect: no department specified, attempting to select first available'
      );
      try {
        const firstDept = await selectFirstDepartment();
        if (firstDept) {
          result.department = { selected: true, name: firstDept };
        }
      } catch (e) {
        debug('tryAutoSelect: failed to auto-select department:', (e as Error).message);
      }
    }

    return result;
  } catch (e) {
    debug('tryAutoSelect failed:', (e as Error).message);
    return { error: (e as Error).message, partial: result };
  }
}

/**
 * 读取选择弹窗中的列表项
 */
async function readPickerPopupItems(): Promise<PopupItemsResult> {
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
async function closePickerPopup(): Promise<boolean> {
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
  return (result as EvaluateResult).data?.value?.closed || false;
}

export {
  openSwitchOrgDialog,
  closeSwitchOrgDialog,
  getCurrentOrganization,
  switchOrganization,
  queryAndSelectInPopup,
  clickRefreshButton,
  clickSystemConfirm,
  selectFirstDepartment,
  readPickerPopupItems,
  readDialogFields,
  closePickerPopup,
};
