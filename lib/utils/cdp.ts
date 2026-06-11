import CDP from 'chrome-remote-interface';

export interface CDPClient {
  Runtime: any;
  Input: any;
  close(): Promise<void>;
}

export async function withCDP<T>(callback: (Runtime: any, Input: any) => Promise<T>): Promise<T> {
  const client = await CDP({ port: 9222 }) as CDPClient;
  try {
    return await callback(client.Runtime, client.Input);
  } finally {
    await client.close();
  }
}

export interface ClickResult {
  clicked: boolean;
  x: number;
  y: number;
}

export async function cdpClick(x: number, y: number, sleepMs = 1000): Promise<ClickResult> {
  return withCDP(async (Runtime, Input) => {
    await Input.dispatchMouseEvent({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await Input.dispatchMouseEvent({ type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    await Runtime.evaluate({
      expression: `
        (function() {
          var el = document.elementFromPoint(${x}, ${y});
          if (el) {
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          }
        })()
      `,
      returnByValue: true,
    });
    if (sleepMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, sleepMs));
    }
    return { clicked: true, x, y };
  });
}

export interface EvaluateAndClickOptions {
  sleepMs?: number;
  returnKey?: string;
  log?: string;
}

export async function cdpEvaluateAndClick(
  expression: string,
  options: EvaluateAndClickOptions = {}
): Promise<ClickResult | { clicked: false; reason: string }> {
  const { sleepMs = 1000, returnKey = 'found', log } = options;

  return withCDP(async (Runtime, Input) => {
    const evalResult = await Runtime.evaluate({ expression, returnByValue: true });
    const value = evalResult?.result?.value;

    if (!value || value[returnKey] !== true) {
      return { clicked: false, reason: 'not_found' };
    }

    if (log) {
      console.log(log);
    }

    const { x, y } = value;
    await Input.dispatchMouseEvent({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await Input.dispatchMouseEvent({ type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });

    if (sleepMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, sleepMs));
    }

    return { clicked: true, x, y };
  });
}

export async function cdpEvaluate(expression: string): Promise<unknown> {
  return withCDP(async (Runtime) => {
    const result = await Runtime.evaluate({ expression, returnByValue: true });
    return result?.result?.value;
  });
}

export interface FindElementResult {
  found: boolean;
  x?: number;
  y?: number;
}

export async function cdpFindElementByText(text: string, constraints: { leftMin?: number; leftMax?: number; topMin?: number; topMax?: number } = {}): Promise<FindElementResult> {
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
  `) as Promise<FindElementResult>;
}

export async function cdpFindPickerButtonByInputId(inputId: string): Promise<FindElementResult & { reason?: string }> {
  return cdpEvaluate(`
    (function() {
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
  `) as Promise<FindElementResult & { reason?: string }>;
}

export async function cdpFindDropdownOption(text: string): Promise<FindElementResult> {
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
  `) as Promise<FindElementResult>;
}

export async function cdpFindPopupElementByText(text: string, constraints: { leftMin?: number; leftMax?: number } = {}): Promise<FindElementResult & { reason?: string }> {
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
  `) as Promise<FindElementResult & { reason?: string }>;
}
