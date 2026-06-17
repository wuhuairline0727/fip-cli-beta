import { evaluate } from '../browser';
import { sleep } from './common';
import { escapeJsString } from './common';

export async function openSideMenu(menuName: string): Promise<boolean> {
  const safeMenuName = escapeJsString(menuName);
  const preCheck = await evaluate(
    "document.querySelector('.ant-drawer-open') ? 'exists' : 'not_found'"
  );
  if (preCheck.data?.value === 'exists') {
    return true;
  }

  const code = `
    (function() {
      var items = Array.from(document.querySelectorAll('.ant-menu-item'));
      var target = items.find(function(item) {
        return item.textContent.trim() === '${safeMenuName}';
      });
      if (target) {
        target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        return { found: true };
      }
      return { found: false };
    })()
  `;
  const result = await evaluate(code);
  if (!result.ok || !result.data?.value?.found) {
    throw new Error(`Menu "${menuName}" not found`);
  }
  const start = Date.now();
  const timeout = 5000;
  let interval = 200;
  while (Date.now() - start < timeout) {
    await sleep(interval);
    const drawerCheck = await evaluate(
      "document.querySelector('.ant-drawer-open') ? 'exists' : 'not_found'"
    );
    if (drawerCheck.data?.value === 'exists') {
      return true;
    }
    interval = Math.min(interval * 2, 800);
  }
  throw new Error(`Menu "${menuName}" drawer did not open after ${timeout}ms`);
}

export async function clickDrawerItem(itemName: string): Promise<boolean> {
  const safeItemName = escapeJsString(itemName);
  const code = `
    (function() {
      var drawer = document.querySelector('.ant-drawer-open');
      if (!drawer) return { found: false, reason: 'no_drawer' };
      var txts = Array.from(drawer.querySelectorAll('.txt'));
      var target = txts.find(function(t) {
        return t.innerText && t.innerText.trim() === '${safeItemName}';
      });
      if (!target) {
        var all = Array.from(drawer.querySelectorAll('*'));
        target = all.find(function(el) {
          return el.innerText && el.innerText.trim() === '${safeItemName}';
        });
      }
      if (target) {
        target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        return { found: true };
      }
      return { found: false, reason: 'not_found' };
    })()
  `;
  const result = await evaluate(code);
  if (!result.ok || !result.data?.value?.found) {
    throw new Error(`Drawer item "${itemName}" not found`);
  }
  await sleep(1500);
  return true;
}
