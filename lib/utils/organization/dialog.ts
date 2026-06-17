/**
 * 对话框生命周期管理模块
 * 职责：打开、关闭、读取切换组织机构对话框的字段
 */

import { evaluate } from '../../browser';
import { debug } from '../../logger';
import { GWT, ANT } from '../../selectors';
import { cdpEvaluate, cdpClick } from '../cdp';
import type {
  DialogValue,
  EvaluateResult,
  CloseResult,
  PopupCloseResult,
  CDPBtnResult,
} from './types';

const SWITCH_ORG_IMG_SRC = 'qhzz';
const DIALOG_WRAP_SELECTOR = `${ANT.MODAL_WRAP}.CscecFormWindow, ${ANT.MODAL_WRAP}.FormWindow`;
const DIALOG_SELECTOR = `${ANT.MODAL}.CscecFormWindow, ${ANT.MODAL}.FormWindow, ${ANT.MODAL_CONTENT}`;
const DIALOG_TITLE_SELECTOR = ANT.MODAL_TITLE;
const CLOSE_BTN_SELECTOR = ANT.MODAL_CLOSE;
const PICKER_POPUP_SELECTOR = GWT.POPUP;

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
export async function closeAllOrgDialogs(): Promise<boolean> {
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
  return (
    result?.data?.value?.closed || (popupResult?.data?.value?.closed ?? 0) > 0
  );
}

/**
 * 打开切换组织机构对话框
 */
export async function openSwitchOrgDialog(): Promise<DialogValue> {
  debug('openSwitchOrgDialog: clicking switch org button');

  // 先关闭所有已打开的对话框和弹窗
  await closeAllOrgDialogs();

  const clickResult = await evaluate(`
    (function() {
      var img = document.querySelector('img[src*="${SWITCH_ORG_IMG_SRC}"]');
      if (!img) {
        return { ok: false, error: '切换组织机构按钮未找到' };
      }
      var clickable = img.closest('a, button, [onclick], .ant-dropdown-trigger, .ant-menu-item, .Menu_Item');
      if (!clickable) clickable = img.parentElement;
      if (!clickable) clickable = img;
      clickable.click();
      return { ok: true };
    })()
  `);

  const clickValue = (clickResult as EvaluateResult).data?.value;
  if (!clickValue?.ok) {
    throw new Error(clickValue?.error || '点击切换组织机构按钮失败');
  }

  await new Promise((r) => setTimeout(r, 1500));
  return readDialogFields();
}

/**
 * 读取对话框字段
 */
export async function readDialogFields(): Promise<DialogValue> {
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

  const dialogValue =
    (dialogInfo as EvaluateResult).data?.value || (dialogInfo as DialogValue);
  if (!dialogValue.ok) {
    throw new Error(dialogValue.error || '读取对话框失败');
  }
  return dialogValue;
}

/**
 * 关闭切换组织机构对话框
 * @param action - 'cancel' 取消, 'confirm' 确定
 */
export async function closeSwitchOrgDialog(
  action: 'cancel' | 'confirm' = 'cancel'
): Promise<boolean> {
  debug('closeSwitchOrgDialog: action=', action);

  const targetText = action === 'cancel' ? '取消' : '确定';

  // 使用 CDP 查找对话框中的按钮并真实点击
  // 策略：在对话框区域内查找包含目标文本的元素，选择 y 坐标最大的（最下面的）
  const btnResult = (await cdpEvaluate(`
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

  if (
    btnResult?.found &&
    btnResult.x !== undefined &&
    btnResult.y !== undefined
  ) {
    await cdpClick(btnResult.x, btnResult.y, 3000);
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
  return (
    ((result as EvaluateResult).data?.value as { closed?: boolean } | undefined)
      ?.closed || false
  );
}

// 导出 getVisiblePopupCode 供其他模块使用
export { getVisiblePopupCode };
