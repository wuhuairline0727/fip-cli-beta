import { evaluate } from '../browser';
import { sleep, escapeJsString } from './common';
import CDP from 'chrome-remote-interface';

export async function clickShowQuery(): Promise<boolean> {
  const code = `
    (function() {
      var all = document.querySelectorAll('*');
      var showCandidates = [];
      var hideCandidates = [];
      for (var i = 0; i < all.length; i++) {
        var text = all[i].textContent.trim();
        if (text === '显示查询') {
          var rect = all[i].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && rect.left > 0) {
            showCandidates.push({ x: rect.left + rect.width/2, y: rect.top + rect.height/2, top: rect.top });
          }
        } else if (text === '隐藏查询') {
          var rect = all[i].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && rect.left > 0) {
            hideCandidates.push({ x: rect.left + rect.width/2, y: rect.top + rect.height/2, top: rect.top });
          }
        }
      }
      if (hideCandidates.length > 0) {
        hideCandidates.sort(function(a, b) { return b.top - a.top; });
        return { found: true, x: hideCandidates[0].x, y: hideCandidates[0].y, alreadyOpen: true };
      }
      if (showCandidates.length === 0) {
        var inputs = document.querySelectorAll('input[id*="FormDateField"]');
        var visibleInputs = Array.from(inputs).filter(function(inp) {
          var rect = inp.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
        if (visibleInputs.length > 0) {
          return { found: true, alreadyOpen: true, reason: 'query_form_visible' };
        }
        return { found: false };
      }
      showCandidates.sort(function(a, b) { return b.top - a.top; });
      return { found: true, x: showCandidates[0].x, y: showCandidates[0].y, alreadyOpen: false };
    })()
  `;
  const result = await evaluate(code);
  if (!result.ok || !result.data?.value?.found) {
    throw new Error('显示查询按钮未找到');
  }
  if (result.data.value.alreadyOpen) {
    return true;
  }

  await sleep(2000);
  const client = await CDP({ port: 9222 });
  try {
    const { Input } = client;
    const { x, y } = result.data.value;
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
  } finally {
    await client.close();
  }

  await sleep(2000);
  return true;
}

export async function setDateInput(
  inputId: string,
  dateStr: string
): Promise<{ found: boolean; value?: string; reason?: string }> {
  const code = `
    (function() {
      var allInputs = document.querySelectorAll('input');
      var input = null;
      for (var i = 0; i < allInputs.length; i++) {
        if (allInputs[i].id === '${escapeJsString(inputId)}') {
          var rect = allInputs[i].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            input = allInputs[i];
            break;
          }
        }
      }
      if (!input) return { found: false, reason: 'visible_input_not_found' };
      input.removeAttribute('readonly');
      input.value = '${escapeJsString(dateStr)}';
      input.setAttribute('value', '${escapeJsString(dateStr)}');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.setAttribute('readonly', '');
      return { found: true, value: input.value };
    })()
  `;
  const result = await evaluate(code);
  if (!result.ok || !result.data?.value?.found) {
    throw new Error(`Failed to set date for ${inputId}`);
  }
  await sleep(500);
  return result.data.value;
}

export interface DateRangeResult {
  startDate: string;
  endDate: string;
}

export async function setDateRange(
  startDate: string,
  endDate: string
): Promise<DateRangeResult> {
  await setDateInput('FormDateField1-input', startDate);
  await setDateInput('FormDateField2-input', endDate);
  return { startDate, endDate };
}

export async function setTaxPeriod(
  startPeriod: string,
  endPeriod: string
): Promise<Record<string, unknown>> {
  const code = `
    (function() {
      var allInputs = document.querySelectorAll('input');
      var results = {};
      for (var i = 0; i < allInputs.length; i++) {
        var inp = allInputs[i];
        if (inp.id === 'FormDateFieldYM1-input' || inp.id === 'FormDateFieldYM2-input') {
          var rect = inp.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            var value = inp.id === 'FormDateFieldYM1-input' ? '${escapeJsString(startPeriod)}' : '${escapeJsString(endPeriod)}';
            inp.value = value;
            inp.setAttribute('value', value);
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            inp.dispatchEvent(new Event('change', { bubbles: true }));
            results[inp.id] = { value: inp.value };
          }
        }
      }
      return results;
    })()
  `;
  const result = await evaluate(code);
  await sleep(500);
  return result.data?.value || {};
}
