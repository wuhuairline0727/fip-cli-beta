const CDP = require('chrome-remote-interface');

/**
 * CDP 会话管理：自动创建和关闭客户端
 * @param {Function} callback - 接收 (Runtime, Input) 的异步函数
 */
async function withCDP(callback) {
  const client = await CDP({ port: 9222 });
  try {
    return await callback(client.Runtime, client.Input);
  } finally {
    await client.close();
  }
}

/**
 * CDP 真实鼠标点击（已封装 mousePressed + mouseReleased）
 * @param {number} x - 屏幕 X 坐标
 * @param {number} y - 屏幕 Y 坐标
 * @param {number} sleepMs - 点击后等待毫秒数
 */
async function cdpClick(x, y, sleepMs = 1000) {
  return withCDP(async (Runtime, Input) => {
    await Input.dispatchMouseEvent({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await Input.dispatchMouseEvent({ type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    if (sleepMs > 0) {
      await new Promise(resolve => setTimeout(resolve, sleepMs));
    }
    return { clicked: true, x, y };
  });
}

/**
 * CDP evaluate 后点击：先执行 JS 查找坐标，再点击
 * @param {string} expression - 返回 {found, x, y} 的 JS 表达式
 * @param {Object} options - { sleepMs, returnKey, log }
 */
async function cdpEvaluateAndClick(expression, options = {}) {
  const { sleepMs = 1000, returnKey = 'found', log } = options;

  return withCDP(async (Runtime, Input) => {
    const evalResult = await Runtime.evaluate({ expression, returnByValue: true });
    const value = evalResult?.result?.value;

    if (!value || !value[returnKey]) {
      return { clicked: false, reason: 'not_found' };
    }

    if (log) {
      console.log(log);
    }

    const { x, y } = value;
    await Input.dispatchMouseEvent({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await Input.dispatchMouseEvent({ type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });

    if (sleepMs > 0) {
      await new Promise(resolve => setTimeout(resolve, sleepMs));
    }

    return { clicked: true, x, y };
  });
}

/**
 * 纯 CDP evaluate，不点击
 * @param {string} expression - JS 表达式
 * @returns {Promise<any>} - result.value
 */
async function cdpEvaluate(expression) {
  return withCDP(async (Runtime) => {
    const result = await Runtime.evaluate({ expression, returnByValue: true });
    return result?.result?.value;
  });
}

/**
 * 通用辅助：通过文本动态查找元素坐标
 * @param {string} text - 目标文本
 * @param {Object} constraints - { leftMin, leftMax, topMin, topMax }
 */
async function cdpFindElementByText(text, constraints = {}) {
  const { leftMin = 0, leftMax = 9999, topMin = 0, topMax = 9999 } = constraints;
  return cdpEvaluate(`
    (function() {
      var all = document.querySelectorAll('*');
      for (var i = 0; i < all.length; i++) {
        if (all[i].textContent.trim() === '${text}') {
          var rect = all[i].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && rect.left > 0 &&
              rect.left >= ${leftMin} && rect.left <= ${leftMax} &&
              rect.top >= ${topMin} && rect.top <= ${topMax}) {
            return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
          }
        }
      }
      return { found: false };
    })()
  `);
}

/**
 * 通用辅助：通过输入框ID查找旁边Picker按钮坐标
 * @param {string} inputId - 输入框ID
 */
async function cdpFindPickerButtonByInputId(inputId) {
  return cdpEvaluate(`
    (function() {
      // GWT 多 tabpanel 共存导致多个同名输入框，必须找到可见的
      var allInputs = document.querySelectorAll('input');
      var input = null;
      for (var i = 0; i < allInputs.length; i++) {
        if (allInputs[i].id === '${inputId}') {
          var rect = allInputs[i].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            input = allInputs[i];
            break;
          }
        }
      }
      if (!input) return { found: false, reason: 'input_not_found' };
      var parent = input.parentElement;
      var btns = parent.querySelectorAll('.FD26IYC-w-l');
      for (var i = 0; i < btns.length; i++) {
        var rect = btns[i].getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
        }
      }
      return { found: false, reason: 'button_not_found' };
    })()
  `);
}

/**
 * 通用辅助：查找下拉选项坐标
 * @param {string} text - 选项文本
 */
async function cdpFindDropdownOption(text) {
  return cdpEvaluate(`
    (function() {
      var items = document.querySelectorAll('.FD26IYC-S-a');
      for (var i = 0; i < items.length; i++) {
        if (items[i].textContent.trim() === '${text}') {
          var rect = items[i].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && rect.left > 0) {
            return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
          }
        }
      }
      var all = document.querySelectorAll('*');
      for (var i = 0; i < all.length; i++) {
        if (all[i].tagName === 'INPUT') continue;
        if (all[i].textContent.trim() === '${text}') {
          var rect = all[i].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && rect.left > 0) {
            return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
          }
        }
      }
      return { found: false };
    })()
  `);
}

/**
 * 通用辅助：查找弹窗中的元素坐标
 * @param {string} text - 目标文本
 * @param {Object} constraints - { leftMin, leftMax }
 */
async function cdpFindPopupElementByText(text, constraints = {}) {
  const { leftMin = 0, leftMax = 9999 } = constraints;
  return cdpEvaluate(`
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
      var all = visiblePopup.querySelectorAll('*');
      for (var i = 0; i < all.length; i++) {
        if (all[i].textContent.trim() === '${text}') {
          var rect = all[i].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && rect.left >= ${leftMin} && rect.left <= ${leftMax}) {
            return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
          }
        }
      }
      return { found: false, reason: 'element_not_found' };
    })()
  `);
}

module.exports = {
  withCDP, cdpClick, cdpEvaluateAndClick, cdpEvaluate,
  cdpFindElementByText, cdpFindPickerButtonByInputId,
  cdpFindDropdownOption, cdpFindPopupElementByText
};
