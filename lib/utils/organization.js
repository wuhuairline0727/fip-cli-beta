/**
 * 组织机构切换模块
 * 支持打开切换组织机构对话框、读取当前信息、选择组织机构/项目/部门
 * 基于真实浏览器测试的 GWT ComboBox 交互机制
 *
 * 操作流程（经真实浏览器验证）：
 * 1. 点击 img[src*="qhzz"] 打开切换组织机构对话框
 * 2. 点击输入框旁的 div.FD26IYC-w-l 蓝色按钮，弹出选择窗口
 * 3. 在选择窗口中点击目标行（CDP 真实鼠标点击）
 * 4. 点击选择窗口的"确定"按钮（CDP 真实鼠标点击）
 * 5. 值自动回填到原对话框，选择弹窗自动关闭
 * 6. 重复 2-5 选择项目、部门
 * 7. 点击原对话框的"确定"完成切换
 */

const { evaluate } = require('../browser');
const { debug } = require('../logger');
const {
  addOrganizationRecord,
  findOrganization,
  getCacheStats,
} = require('./organization-cache');

// CDP 工具（用于真实鼠标点击）
let cdpUtils;
try {
  cdpUtils = require('./cdp');
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
const PICKER_OVERLAY_SELECTOR = '.FD26IYC-Ob-a';
const PICKER_BTN_SELECTOR = 'div.FD26IYC-w-l';

/**
 * 打开切换组织机构对话框
 * @returns {Promise<Object>} 对话框信息
 */
async function openSwitchOrgDialog() {
  debug('openSwitchOrgDialog: clicking switch org button');

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

  if (!clickResult.data?.value?.ok) {
    throw new Error(
      clickResult.data?.value?.error || '点击切换组织机构按钮失败'
    );
  }

  await new Promise((r) => setTimeout(r, 1500));
  return readDialogFields();
}

/**
 * 读取对话框字段
 * @returns {Promise<Object>}
 */
async function readDialogFields() {
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
        for (var j = 0; j < labels.length; j++) {
          var labelText = (labels[j].textContent || '').replace(/[：:]/g, '').trim();
          var labelRect = labels[j].getBoundingClientRect();
          var inputRect = inp.getBoundingClientRect();
          if (Math.abs(labelRect.top - inputRect.top) < 50 && labelRect.left < inputRect.left) {
            fieldName = labelText;
            break;
          }
        }

        if (!fieldName && id) {
          if (id.includes('ComboBox1')) fieldName = '组织机构';
          else if (id.includes('ComboBox3')) fieldName = '项目名称';
          else if (id.includes('ComboBox2')) fieldName = '部门名称';
          else if (id.includes('TextInput2')) fieldName = '板块编号';
          else if (id.includes('TextInput3')) fieldName = '板块名称';
          else if (id.includes('TextInput1')) fieldName = '利润中心';
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

  const dialogValue = dialogInfo.data?.value || dialogInfo;
  if (!dialogValue.ok) {
    throw new Error(dialogValue.error || '读取对话框失败');
  }
  return dialogValue;
}

/**
 * 关闭切换组织机构对话框
 * @param {string} [action='cancel'] - 'cancel' 取消, 'confirm' 确定
 * @returns {Promise<boolean>}
 */
async function closeSwitchOrgDialog(action = 'cancel') {
  debug('closeSwitchOrgDialog: action=', action);

  if (cdpUtils) {
    // 使用 CDP 点击 GWT 按钮（更可靠）
    try {
      const targetText = action === 'cancel' ? '取消' : '确定';
      const findResult = await cdpFindDialogButton(targetText);
      if (findResult && findResult.found) {
        await cdpUtils.cdpClick(findResult.x, findResult.y, 1500);
        return true;
      }
    } catch (e) {
      debug('CDP click failed, fallback to JS:', e.message);
    }
  }

  // JS 兜底
  const result = await evaluate(`
    (function() {
      var modal = document.querySelector('${DIALOG_WRAP_SELECTOR}');
      if (!modal) {
        return { ok: true, closed: true, reason: '对话框已关闭' };
      }

      var allDivs = modal.querySelectorAll('div');
      for (var i = 0; i < allDivs.length; i++) {
        var text = allDivs[i].textContent.trim();
        if (
          ('${action}' === 'cancel' && text === '取消') ||
          ('${action}' === 'confirm' && text === '确定')
        ) {
          var rect = allDivs[i].getBoundingClientRect();
          var x = rect.left + rect.width / 2;
          var y = rect.top + rect.height / 2;
          ['mousedown', 'mouseup', 'click'].forEach(function(type) {
            var event = new MouseEvent(type, {
              bubbles: true,
              cancelable: true,
              view: window,
              clientX: x,
              clientY: y
            });
            allDivs[i].dispatchEvent(event);
          });
          return { ok: true, closed: true, clicked: text };
        }
      }

      var closeBtn = document.querySelector('${CLOSE_BTN_SELECTOR}');
      if (closeBtn) {
        closeBtn.click();
        return { ok: true, closed: true, method: 'close_x' };
      }

      modal.remove();
      return { ok: true, closed: true, method: 'remove' };
    })()
  `);

  await new Promise((r) => setTimeout(r, 1000));
  return result.data?.value?.closed || false;
}

/**
 * 打开选择弹窗（点击蓝色按钮）
 * @param {string} fieldId - 输入框ID
 * @returns {Promise<Object>}
 */
async function openPickerPopup(fieldId) {
  debug('openPickerPopup: fieldId=', fieldId);

  const result = await evaluate(`
    (function() {
      var input = document.getElementById('${fieldId}');
      if (!input) {
        return { ok: false, error: '输入框未找到: ${fieldId}' };
      }
      var parent = input.parentElement;
      var btn = parent.querySelector('${PICKER_BTN_SELECTOR}');
      if (!btn) {
        return { ok: false, error: '蓝色按钮未找到' };
      }
      btn.click();
      return { ok: true, beforeValue: input.value };
    })()
  `);

  if (!result.data?.value?.ok) {
    throw new Error(result.data?.value?.error || '打开选择弹窗失败');
  }

  await new Promise((r) => setTimeout(r, 2000));
  return result.data.value;
}

/**
 * 读取选择弹窗中的列表项
 * @returns {Promise<Object>}
 */
async function readPickerPopupItems() {
  debug('readPickerPopupItems');

  const result = await evaluate(`
    (function() {
      var popup = document.querySelector('${PICKER_POPUP_SELECTOR}');
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

      // 尝试模式1：编码+名称+级数（组织机构/项目）
      var parts = dataText.split('1000');
      for (var i = 1; i < parts.length; i++) {
        var part = '1000' + parts[i];
        var j = 0;
        while (j < part.length && part[j] >= '0' && part[j] <= '9') j++;
        var code = part.substring(0, j);
        var rest = part.substring(j);
        var k = rest.length - 1;
        while (k >= 0 && rest[k] >= '0' && rest[k] <= '9') k--;
        var name = rest.substring(0, k + 1);
        var level = rest.substring(k + 1);
        if (code.length >= 10 && name.length > 3) {
          items.push({ code: code, name: name, level: level });
        }
      }

      // 尝试模式2：序号+编号+名称（项目/部门）
      if (items.length === 0) {
        var regex = /(\d+)([A-Z]{2}\d+|[\d]+)([\u4e00-\u9fa5（）-]+)/g;
        var match;
        while ((match = regex.exec(dataText)) !== null) {
          items.push({ index: match[1], code: match[2], name: match[3] });
        }
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

  return result.data?.value || result;
}

/**
 * 使用 CDP 在选择弹窗中选择某一项
 * @param {string} itemName - 要选择的项名称
 * @returns {Promise<Object>}
 */
async function selectPickerItem(itemName) {
  debug('selectPickerItem: itemName=', itemName);

  if (!cdpUtils) {
    throw new Error('CDP 工具不可用，无法执行真实鼠标点击');
  }

  // 1. CDP 点击目标行
  const findResult = await cdpUtils.cdpFindPopupElementByText(itemName);
  if (!findResult || !findResult.found) {
    throw new Error('未找到目标项: ' + itemName);
  }

  await cdpUtils.cdpClick(findResult.x, findResult.y, 500);
  debug('selectPickerItem: clicked item at', findResult.x, findResult.y);

  // 2. CDP 点击确定按钮
  const confirmResult = await cdpUtils.cdpFindPopupElementByText('确定');
  if (!confirmResult || !confirmResult.found) {
    throw new Error('未找到确定按钮');
  }

  await cdpUtils.cdpClick(confirmResult.x, confirmResult.y, 1500);
  debug(
    'selectPickerItem: clicked confirm at',
    confirmResult.x,
    confirmResult.y
  );

  return { selected: true, item: itemName };
}

/**
 * 关闭选择弹窗（兜底：手动移除）
 * @returns {Promise<boolean>}
 */
async function closePickerPopup() {
  debug('closePickerPopup');

  const result = await evaluate(`
    (function() {
      var selectors = '${PICKER_POPUP_SELECTOR}, ${PICKER_OVERLAY_SELECTOR}, .FD26IYC-fb-i, .FD26IYC-fb-e, .FD26IYC-fb-f';
      var elements = document.querySelectorAll(selectors);
      for (var i = 0; i < elements.length; i++) {
        elements[i].remove();
      }
      return { removed: elements.length };
    })()
  `);

  await new Promise((r) => setTimeout(r, 500));
  return result.data?.value?.removed > 0;
}

/**
 * 查找原对话框中的 GWT 按钮坐标
 * @param {string} text - 按钮文本
 * @returns {Promise<Object>}
 */
async function cdpFindDialogButton(text) {
  if (!cdpUtils) return { found: false };

  return cdpUtils.cdpEvaluate(`
    (function() {
      var modal = document.querySelector('${DIALOG_WRAP_SELECTOR}');
      if (!modal) return { found: false, reason: 'dialog_not_found' };
      var allDivs = modal.querySelectorAll('div');
      for (var i = 0; i < allDivs.length; i++) {
        if (allDivs[i].textContent.trim() === '${text}' && allDivs[i].children.length === 0) {
          var rect = allDivs[i].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
          }
        }
      }
      return { found: false, reason: 'button_not_found' };
    })()
  `);
}

/**
 * 获取当前组织机构信息
 * @returns {Promise<Object>}
 */
async function getCurrentOrganization() {
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

  if (fromHeader.data?.value?.found) {
    return { organization: fromHeader.data.value.organization };
  }

  let dialog;
  try {
    dialog = await openSwitchOrgDialog();
  } catch (e) {
    throw new Error('无法获取当前组织机构信息：' + e.message, { cause: e });
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
 * @param {Object} options
 * @param {string} [options.organization] - 目标组织机构名称
 * @param {string} [options.project] - 目标项目名称
 * @param {string} [options.department] - 目标部门名称
 * @param {boolean} [options.fromCache=false] - 是否仅从缓存查找
 * @param {boolean} [options.autoSelect=false] - 是否尝试自动选择（需要 CDP）
 * @returns {Promise<Object>}
 */
async function switchOrganization(options = {}) {
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
    const currentInfo = {
      organization: dialog.fields['组织机构']?.value,
      project: dialog.fields['项目名称']?.value,
      department: dialog.fields['部门名称']?.value,
      plateCode: dialog.fields['板块编号']?.value,
      plateName: dialog.fields['板块名称']?.value,
      profitCenter: dialog.fields['利润中心']?.value,
    };

    // 自动记录到缓存
    const isNewRecord = addOrganizationRecord(currentInfo);
    debug('switchOrganization: cache record added, isNew=', isNewRecord);

    // 如果提供了目标值且启用了自动选择，尝试使用 CDP 选择
    let selectionResult = null;
    if (options.autoSelect && cdpUtils) {
      selectionResult = await tryAutoSelect(dialog.fields, options);
      // 自动选择完成后，点击"确定"完成切换
      if (selectionResult && !selectionResult.error) {
        await closeSwitchOrgDialog('confirm');
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
    await closePickerPopup();
    throw e;
  }
}

/**
 * 尝试自动选择组织机构/项目/部门
 * @param {Object} fields - 当前对话框字段
 * @param {Object} options - 目标值
 * @returns {Promise<Object|null>}
 */
async function tryAutoSelect(fields, options) {
  debug('tryAutoSelect');

  const result = {
    organization: null,
    project: null,
    department: null,
  };

  try {
    // 1. 选择组织机构
    if (options.organization && fields['组织机构']?.id) {
      await openPickerPopup(fields['组织机构'].id);
      await selectPickerItem(options.organization);
      result.organization = { selected: true, name: options.organization };
    }

    // 2. 选择项目
    if (options.project && fields['项目名称']?.id) {
      await openPickerPopup(fields['项目名称'].id);
      await selectPickerItem(options.project);
      result.project = { selected: true, name: options.project };
    }

    // 3. 选择部门
    if (options.department && fields['部门名称']?.id) {
      await openPickerPopup(fields['部门名称'].id);
      await selectPickerItem(options.department);
      result.department = { selected: true, name: options.department };
    }

    return result;
  } catch (e) {
    debug('tryAutoSelect failed:', e.message);
    await closePickerPopup();
    return { error: e.message, partial: result };
  }
}

module.exports = {
  openSwitchOrgDialog,
  closeSwitchOrgDialog,
  getCurrentOrganization,
  switchOrganization,
  openPickerPopup,
  readPickerPopupItems,
  selectPickerItem,
  closePickerPopup,
  readDialogFields,
};
