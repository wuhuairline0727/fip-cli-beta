const CDP = require('chrome-remote-interface');
const { evaluate } = require('../browser');
const { sleep } = require('./common');

/**
 * 点击 Picker 按钮（如申请单位旁边的蓝色按钮）
 * @param {string} labelText - 标签文本，如 '申请单位' 或 '纳税主体'
 */
async function clickPickerButton(labelText) {
  const code = `
    (function() {
      // 找到标签元素
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
      var labelEl = null;
      var node;
      while (node = walker.nextNode()) {
        if (node.textContent.trim() === '${labelText}：' || node.textContent.trim() === '${labelText}') {
          var rect = node.parentElement.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            labelEl = node.parentElement;
            break;
          }
        }
      }

      if (!labelEl) return { found: false, reason: 'label_not_found' };

      // 向上找到行容器
      var row = labelEl.parentElement;
      while (row && row.parentElement) {
        var rect = row.getBoundingClientRect();
        if (rect.width > 200) break;
        row = row.parentElement;
      }

      // 在行内查找按钮（FD26IYC-w-l 类的小图标）
      var buttons = Array.from(row.querySelectorAll('.FD26IYC-w-l'));
      var target = buttons.find(function(btn) {
        var rect = btn.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });

      if (!target) return { found: false, reason: 'button_not_found' };

      target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));

      return { found: true, clicked: true };
    })()
  `;
  const result = await evaluate(code);
  if (!result.ok || !result.data?.value?.found) {
    throw new Error(`Picker button for "${labelText}" not found: ${result.data?.value?.reason || 'unknown'}`);
  }
  await sleep(2000);
  return true;
}

/**
 * 查找 Picker 弹窗（帮助字典/纳税主体帮助等）
 */
function findPopupCode() {
  return `
    (function() {
      var popup = null;
      var allDivs = Array.from(document.querySelectorAll('div'));
      for (var i = 0; i < allDivs.length; i++) {
        var text = allDivs[i].textContent;
        // 必须同时包含弹窗标题和查询按钮文本
        if ((text.indexOf('帮助字典') !== -1 || text.indexOf('纳税主体帮助') !== -1) &&
            text.indexOf('查询') !== -1 && text.indexOf('确定') !== -1 &&
            text.indexOf('数据选择') !== -1) {
          var rect = allDivs[i].getBoundingClientRect();
          if (rect.width > 600 && rect.height > 400 && rect.left > 0) {
            popup = allDivs[i];
            break;
          }
        }
      }
      return popup;
    })()
  `;
}

/**
 * 在帮助字典/纳税主体帮助弹窗中查询并选择
 * @param {string} queryCode - 查询编码，如 '1000200020040011'
 */
async function pickFromDict(queryCode) {
  const code = `
    (function() {
      var popup = ${findPopupCode()};

      if (!popup) return { found: false, reason: 'popup_not_found' };

      // 在输入框中填入查询关键字
      var input = popup.querySelector('input[type="text"]');
      if (!input) return { found: false, reason: 'input_not_found' };

      input.focus();
      input.value = '${queryCode}';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.blur();

      return { found: true, filled: true };
    })()
  `;
  const result = await evaluate(code);
  if (!result.ok || !result.data?.value?.found) {
    throw new Error(`Failed to fill query: ${result.data?.value?.reason || 'unknown'}`);
  }

  await sleep(500);

  // 点击查询按钮
  const queryBtnCode = `
    (function() {
      var popup = ${findPopupCode()};
      if (!popup) return { found: false };

      var walker = document.createTreeWalker(popup, NodeFilter.SHOW_TEXT, null, false);
      var node;
      while (node = walker.nextNode()) {
        if (node.textContent.trim() === '查询') {
          var el = node.parentElement;
          while (el && el.tagName !== 'BUTTON' && el.tagName !== 'A' && el.tagName !== 'DIV') {
            el = el.parentElement;
          }
          if (el) {
            el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
            el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
            return { found: true };
          }
        }
      }
      return { found: false };
    })()
  `;
  await evaluate(queryBtnCode);

  // 等待查询结果加载，最多等待 5 秒
  let attempts = 0;
  let rowFound = false;
  while (attempts < 10 && !rowFound) {
    await sleep(500);
    const checkResult = await evaluate(`
      (function() {
        var popup = ${findPopupCode()};
        if (!popup) return { found: false };
        var rows = Array.from(popup.querySelectorAll('tr'));
        for (var i = 0; i < rows.length; i++) {
          if (rows[i].textContent.indexOf('${queryCode}') !== -1) {
            return { found: true };
          }
        }
        return { found: false };
      })()
    `);
    if (checkResult.ok && checkResult.data?.value?.found) {
      rowFound = true;
    }
    attempts++;
  }

  if (!rowFound) {
    throw new Error(`Query result for "${queryCode}" not found after 5s`);
  }

  // 点击第一行结果
  const selectCode = `
    (function() {
      var popup = ${findPopupCode()};
      if (!popup) return { found: false, reason: 'popup_not_found' };

      // 找到包含查询编码的行
      var rows = Array.from(popup.querySelectorAll('tr'));
      var targetRow = null;
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].textContent.indexOf('${queryCode}') !== -1) {
          targetRow = rows[i];
          break;
        }
      }

      if (!targetRow) return { found: false, reason: 'row_not_found' };

      targetRow.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      targetRow.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      targetRow.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));

      return { found: true, selected: true };
    })()
  `;
  const selectResult = await evaluate(selectCode);
  if (!selectResult.ok || !selectResult.data?.value?.found) {
    throw new Error(`Failed to select row: ${selectResult.data?.value?.reason || 'unknown'}`);
  }

  await sleep(500);

  // 点击确认按钮
  const confirmCode = `
    (function() {
      var popup = ${findPopupCode()};
      if (!popup) return { found: false };

      var walker = document.createTreeWalker(popup, NodeFilter.SHOW_TEXT, null, false);
      var node;
      while (node = walker.nextNode()) {
        if (node.textContent.trim() === '确定') {
          var el = node.parentElement;
          while (el && el.tagName !== 'BUTTON' && el.tagName !== 'A' && el.tagName !== 'DIV') {
            el = el.parentElement;
          }
          if (el) {
            el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
            el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
            return { found: true };
          }
        }
      }
      return { found: false };
    })()
  `;
  await evaluate(confirmCode);

  await sleep(1500);
  return true;
}

/**
 * 选择纳税主体（使用 CDP 真实鼠标点击）
 * @param {string} taxCode - 税号，如 '91110000101638302P'
 */
async function pickTaxSubject(taxCode) {

  // 1. 点击纳税主体旁边的蓝色按钮
  await clickPickerButton('纳税主体');
  await sleep(2000);

  // 2. 在弹窗输入框输入税号（同时设置 value 和 setAttribute）
  const fillCode = `
    (function() {
      var popup = document.querySelector('.FD26IYC-a-g');
      if (!popup) return { found: false, reason: 'popup_not_found' };
      var input = popup.querySelector('#FormTextInput1-input');
      if (!input) return { found: false, reason: 'input_not_found' };
      input.value = '${taxCode}';
      input.setAttribute('value', '${taxCode}');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return { found: true, value: input.value, attr: input.getAttribute('value') };
    })()
  `;
  const fillResult = await evaluate(fillCode);
  if (!fillResult.ok || !fillResult.data?.value?.found) {
    throw new Error(`Failed to fill tax code: ${fillResult.data?.value?.reason || 'unknown'}`);
  }

  await sleep(500);

  // 3. 点击查询按钮（内层 div）
  const queryCode = `
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
  `;
  await evaluate(queryCode);
  await sleep(2000);

  // 4. 点击第一行结果
  const selectCode = `
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
  `;
  await evaluate(selectCode);
  await sleep(500);

  // 5. 使用 CDP 真实鼠标点击确定按钮
  const client = await CDP({ port: 9222 });
  try {
    const { Runtime, Input } = client;

    // 获取确定按钮位置
    const rectResult = await Runtime.evaluate({
      expression: `
        (function() {
          var popup = document.querySelector('.FD26IYC-a-g');
          if (!popup) return { found: false };
          var allBtns = popup.querySelectorAll('.FD26IYC-H-d.FD26IYC-H-q.FD26IYC-H-n');
          var confirmBtn = allBtns[3];
          if (!confirmBtn) return { found: false };
          var rect = confirmBtn.getBoundingClientRect();
          return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
        })()
      `,
      returnByValue: true
    });

    if (!rectResult?.result?.value?.found) {
      throw new Error('Confirm button not found');
    }

    const { x, y } = rectResult.result.value;

    // 真实鼠标点击
    await Input.dispatchMouseEvent({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await Input.dispatchMouseEvent({ type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });

    await sleep(1500);

    // 检查弹窗是否关闭
    const popupCheck = await Runtime.evaluate({
      expression: `document.querySelector('.FD26IYC-a-g') ? 'exists' : 'closed'`,
      returnByValue: true
    });

    if (popupCheck.result.value === 'exists') {
      throw new Error('Popup still open after confirm click');
    }

    return { tax_code: taxCode, selected: true };
  } finally {
    await client.close();
  }
}

module.exports = { clickPickerButton, findPopupCode, pickFromDict, pickTaxSubject };
