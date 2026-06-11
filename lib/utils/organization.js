/**
 * 组织机构切换模块
 * 支持打开切换组织机构对话框、读取当前信息
 * 注：GWT ComboBox 下拉选择需要特殊交互，切换功能需进一步研究
 */

const { evaluate } = require('../browser');
const { debug } = require('../logger');
const {
  addOrganizationRecord,
  findOrganization,
  getCacheStats,
} = require('./organization-cache');

const SWITCH_ORG_IMG_SRC = 'qhzz';
const DIALOG_SELECTOR =
  '.ant-modal.CscecFormWindow, .ant-modal.FormWindow, .ant-modal-content';
const DIALOG_TITLE_SELECTOR = '.ant-modal-title';
const CLOSE_BTN_SELECTOR = '.ant-modal-close';

/**
 * 打开切换组织机构对话框
 * @returns {Promise<Object>} 对话框信息
 */
async function openSwitchOrgDialog() {
  debug('openSwitchOrgDialog: clicking switch org button');

  // 点击切换组织机构按钮
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

  // 等待对话框弹出
  await new Promise((r) => setTimeout(r, 1500));

  // 读取对话框内容
  const dialogInfo = await evaluate(`
    (function() {
      var modal = document.querySelector('${DIALOG_SELECTOR}');
      if (!modal) {
        return { ok: false, error: '切换组织机构对话框未弹出' };
      }

      var titleEl = modal.querySelector('${DIALOG_TITLE_SELECTOR}');
      var title = titleEl ? titleEl.textContent.trim() : '';

      // 读取所有字段
      var fields = {};
      var labels = modal.querySelectorAll('label, .ant-form-item-label');
      var inputs = modal.querySelectorAll('input, select, textarea');

      for (var i = 0; i < inputs.length; i++) {
        var inp = inputs[i];
        var id = inp.id || '';
        var value = inp.value || '';
        var placeholder = inp.placeholder || '';

        // 通过 label 关联字段名
        var fieldName = '';
        for (var j = 0; j < labels.length; j++) {
          var labelText = (labels[j].textContent || '').replace(/[：:]/g, '').trim();
          var labelRect = labels[j].getBoundingClientRect();
          var inputRect = inp.getBoundingClientRect();
          // 简单的垂直位置匹配
          if (Math.abs(labelRect.top - inputRect.top) < 50 && labelRect.left < inputRect.left) {
            fieldName = labelText;
            break;
          }
        }

        if (!fieldName && id) {
          // 通过 ID 推断字段名
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

      // 查找按钮
      var buttons = [];
      var allButtons = modal.querySelectorAll('button, .ant-btn');
      for (var k = 0; k < allButtons.length; k++) {
        var btnText = (allButtons[k].textContent || '').trim();
        if (btnText) {
          buttons.push(btnText);
        }
      }

      return {
        ok: true,
        title: title,
        fields: fields,
        buttons: buttons,
      };
    })()
  `);

  const dialogValue = dialogInfo.data?.value || dialogInfo;
  if (!dialogValue.ok) {
    throw new Error(dialogValue.error || '打开切换组织机构对话框失败');
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

  const result = await evaluate(`
    (function() {
      var modal = document.querySelector('${DIALOG_SELECTOR}');
      if (!modal) {
        return { ok: true, closed: true, reason: '对话框已关闭' };
      }

      var buttons = modal.querySelectorAll('button, .ant-btn');
      for (var i = 0; i < buttons.length; i++) {
        var text = (buttons[i].textContent || '').trim();
        if (
          ('${action}' === 'cancel' && (text.includes('取消') || text.includes('关闭'))) ||
          ('${action}' === 'confirm' && text.includes('确定'))
        ) {
          buttons[i].click();
          return { ok: true, closed: true, clicked: text };
        }
      }

      // 兜底：点击关闭 X
      var closeBtn = document.querySelector('${CLOSE_BTN_SELECTOR}');
      if (closeBtn) {
        closeBtn.click();
        return { ok: true, closed: true, method: 'close_x' };
      }

      return { ok: false, error: '未找到关闭按钮' };
    })()
  `);

  // 等待关闭动画
  await new Promise((r) => setTimeout(r, 1000));

  return result.data?.value?.closed || false;
}

/**
 * 获取当前组织机构信息（从页面头部或对话框）
 * @returns {Promise<Object>}
 */
async function getCurrentOrganization() {
  debug('getCurrentOrganization');

  // 先尝试从页面头部获取
  const fromHeader = await evaluate(`
    (function() {
      // 尝试多种选择器找到当前组织机构显示
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

  // 如果头部没有，打开对话框获取
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
 * 切换组织机构（支持缓存查询和自动记录）
 * 注：GWT ComboBox 下拉选择机制复杂，实际切换需手动操作或进一步研究
 * @param {Object} options
 * @param {string} [options.organization] - 组织机构名称
 * @param {string} [options.project] - 项目名称
 * @param {string} [options.department] - 部门名称
 * @param {boolean} [options.fromCache=false] - 是否仅从缓存查找（不打开浏览器）
 * @returns {Promise<Object>}
 */
async function switchOrganization(options = {}) {
  debug('switchOrganization: options=', JSON.stringify(options));

  // 如果仅从缓存查找，不打开浏览器
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

    // 如果提供了目标值，从缓存查找匹配项
    let cacheMatches = [];
    if (options.organization || options.project || options.department) {
      cacheMatches = findOrganization({
        organization: options.organization,
        project: options.project,
        department: options.department,
      });
    }

    // 关闭对话框（取消模式，不实际切换）
    await closeSwitchOrgDialog('cancel');

    const cacheStats = getCacheStats();

    return {
      success: true,
      mode: 'query',
      note: 'GWT ComboBox 下拉选择需特殊交互，自动切换功能待完善',
      current: currentInfo,
      cache: {
        isNewRecord: isNewRecord,
        totalRecords: cacheStats.totalRecords,
        matches: cacheMatches,
        matchCount: cacheMatches.length,
      },
    };
  } catch (e) {
    // 出错时取消对话框
    await closeSwitchOrgDialog('cancel');
    throw e;
  }
}

module.exports = {
  openSwitchOrgDialog,
  closeSwitchOrgDialog,
  getCurrentOrganization,
  switchOrganization,
};
