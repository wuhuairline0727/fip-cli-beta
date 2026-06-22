import { evaluate } from '../browser';
import { cdpClick } from './cdp';
import { verbose } from '../logger';

export interface DismissOptions {
  closeButtonTexts?: string[];
  maxDialogs?: number;
  waitAfterClose?: number;
}

export interface DismissResult {
  closed: number;
  details: string[];
}

export async function dismissDialogs(
  options: DismissOptions = {}
): Promise<DismissResult> {
  const {
    closeButtonTexts = ['确定', '确认', '关闭', '知道了', '取消'],
    maxDialogs = 5,
    waitAfterClose = 1000,
  } = options;

  let closed = 0;
  const details: string[] = [];

  for (let attempt = 0; attempt < maxDialogs; attempt++) {
    const dialogCode = `
      (function() {
        var modalBtns = document.querySelectorAll('.ant-modal-body button, .ant-modal-footer button, [class*="dialog"] button, [class*="modal"] button');
        for (var i = 0; i < modalBtns.length; i++) {
          var text = modalBtns[i].textContent.trim();
          var rect = modalBtns[i].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && ${JSON.stringify(closeButtonTexts)}.includes(text)) {
            return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2, text: text, source: 'modal' };
          }
        }

        var allBtns = document.querySelectorAll('button, [role="button"], .ant-btn');
        for (var j = 0; j < allBtns.length; j++) {
          var text = allBtns[j].textContent.trim();
          var rect = allBtns[j].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 &&
              rect.top > 100 && rect.top < window.innerHeight - 100 &&
              rect.left > 100 && rect.left < window.innerWidth - 100 &&
              ${JSON.stringify(closeButtonTexts)}.includes(text)) {
            return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2, text: text, source: 'center' };
          }
        }

        var notifications = document.querySelectorAll('.ant-message, .ant-notification, .ant-notification-notice');
        for (var k = 0; k < notifications.length; k++) {
          var closeIcon = notifications[k].querySelector('.anticon-close, .ant-notification-notice-close');
          if (closeIcon) {
            var rect = closeIcon.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2, text: '×', source: 'notification' };
            }
          }
        }

        var gwtWindows = document.querySelectorAll('.x-window-draggable, [class*="x-window"]');
        for (var m = 0; m < gwtWindows.length; m++) {
          var winRect = gwtWindows[m].getBoundingClientRect();
          if (winRect.width > 0 && winRect.height > 0 && winRect.top > 0) {
            var closeBtn = gwtWindows[m].querySelector('[class*="x-tool"], .x-tool-close, [class*="x-tool-close"]');
            if (!closeBtn) {
              closeBtn = gwtWindows[m].querySelector('.FD26IYC-jb-a, [class*="jb-a"]');
            }
            if (closeBtn) {
              var rect = closeBtn.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2, text: '×', source: 'gwt-window' };
              }
            }
          }
        }

        return { found: false };
      })()
    `;

    const result = await evaluate(dialogCode);
    if (!result.data?.value?.found) {
      break;
    }

    const { x, y, text, source } = result.data.value;
    verbose(`检测到${source}弹窗，点击"${text}"关闭...`);
    await cdpClick(x, y, waitAfterClose);
    closed++;
    details.push(`${source}:${text}`);
  }

  if (closed > 0) {
    verbose(`共关闭 ${closed} 个弹窗`);
  }

  return { closed, details };
}

export async function waitAndDismissDialogs(
  timeout = 5000,
  options: DismissOptions = {}
): Promise<DismissResult> {
  const startTime = Date.now();
  let totalClosed = 0;
  const allDetails: string[] = [];

  while (Date.now() - startTime < timeout) {
    const result = await dismissDialogs(options);
    if (result.closed === 0) {
      break;
    }
    totalClosed += result.closed;
    allDetails.push(...result.details);
    await new Promise((r) => setTimeout(r, 500));
  }

  return { closed: totalClosed, details: allDetails };
}
