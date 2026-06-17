import CDP from 'chrome-remote-interface';
import { evaluate } from '../browser';
import { sleep } from './common';

function escapeJsString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
}

export async function clickPickerButton(labelText: string): Promise<boolean> {
  const safeLabel = escapeJsString(labelText);
  const code = `
    (function() {
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
      var labelEl = null;
      var node;
      while (node = walker.nextNode()) {
        if (node.textContent.trim() === '${safeLabel}：' || node.textContent.trim() === '${safeLabel}') {
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
    throw new Error(
      `Picker button for "${labelText}" not found: ${result.data?.value?.reason || 'unknown'}`
    );
  }
  await sleep(2000);
  return true;
}

export function findPopupCode(): string {
  return `
    (function() {
      var popup = null;
      var allDivs = Array.from(document.querySelectorAll('div'));
      for (var i = 0; i < allDivs.length; i++) {
        var text = allDivs[i].textContent;
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

export async function pickFromDict(queryCode: string): Promise<boolean> {
  const safeCode = escapeJsString(queryCode);
  const code = `
    (function() {
      var popup = ${findPopupCode()};
      if (!popup) return { found: false, reason: 'popup_not_found' };
      var input = popup.querySelector('input[type="text"]');
      if (!input) return { found: false, reason: 'input_not_found' };
      input.focus();
      input.value = '${safeCode}';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.blur();
      return { found: true, filled: true };
    })()
  `;
  const result = await evaluate(code);
  if (!result.ok || !result.data?.value?.found) {
    throw new Error(
      `Failed to fill query: ${result.data?.value?.reason || 'unknown'}`
    );
  }

  await sleep(500);

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
          if (rows[i].textContent.indexOf('${safeCode}') !== -1) {
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

  const selectCode = `
    (function() {
      var popup = ${findPopupCode()};
      if (!popup) return { found: false, reason: 'popup_not_found' };
      var rows = Array.from(popup.querySelectorAll('tr'));
      var targetRow = null;
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].textContent.indexOf('${safeCode}') !== -1) {
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
    throw new Error(
      `Failed to select row: ${selectResult.data?.value?.reason || 'unknown'}`
    );
  }

  await sleep(500);

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

export async function pickTaxSubject(
  taxCode: string
): Promise<{ tax_code: string; selected: boolean }> {
  await clickPickerButton('纳税主体');
  await sleep(2000);
  const safeTaxCode = escapeJsString(taxCode);

  const fillCode = `
    (function() {
      var popup = document.querySelector('.FD26IYC-a-g');
      if (!popup) return { found: false, reason: 'popup_not_found' };
      var input = popup.querySelector('#FormTextInput1-input');
      if (!input) return { found: false, reason: 'input_not_found' };
      input.value = '${safeTaxCode}';
      input.setAttribute('value', '${safeTaxCode}');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return { found: true, value: input.value };
    })()
  `;
  const fillResult = await evaluate(fillCode);
  if (!fillResult.ok || !fillResult.data?.value?.found) {
    throw new Error(
      `Failed to fill tax code: ${fillResult.data?.value?.reason || 'unknown'}`
    );
  }

  await sleep(500);

  const queryCode = `
    (function() {
      var popup = document.querySelector('.FD26IYC-a-g');
      if (!popup) return { found: false };
      var queryDiv = popup.querySelector('.FD26IYC-D-d.FD26IYC-D-o');
      if (queryDiv) {
        queryDiv.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        queryDiv.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        queryDiv.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return { found: true, text: queryDiv.textContent.trim() };
      }
      return { found: false };
    })()
  `;
  await evaluate(queryCode);
  await sleep(2000);

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
        return { found: true, text: firstDataRow.textContent.trim().substring(0, 50) };
      }
      return { found: false };
    })()
  `;
  await evaluate(selectCode);
  await sleep(1000);

  const client = await CDP({ port: 9222 });
  try {
    const { Runtime, Input } = client;

    const rectResult = await Runtime.evaluate({
      expression: `
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
      returnByValue: true,
    });

    if (
      !(rectResult?.result?.value as { found?: boolean } | undefined)?.found
    ) {
      throw new Error('Confirm button not found');
    }

    const { x, y } = rectResult.result!.value as { x: number; y: number };
    await Input.dispatchMouseEvent({
      type: 'mousePressed',
      x,
      y,
      button: 'left',
      clickCount: 1,
    });
    await Input.dispatchMouseEvent({
      type: 'mouseReleased',
      x,
      y,
      button: 'left',
      clickCount: 1,
    });

    await sleep(2000);

    const popupCheck = await Runtime.evaluate({
      expression: `document.querySelector('.FD26IYC-a-g') ? 'exists' : 'closed'`,
      returnByValue: true,
    });

    if ((popupCheck.result?.value as string | undefined) === 'exists') {
      throw new Error('Popup still open after confirm click');
    }

    return { tax_code: taxCode, selected: true };
  } finally {
    await client.close();
  }
}
