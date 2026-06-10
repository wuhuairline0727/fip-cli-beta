/**
 * 弹窗检测与关闭模块
 * 用于在操作前自动检测并关闭页面上的弹窗/对话框
 */

const { evaluate } = require('../browser');
const { cdpClick } = require('./cdp');

/**
 * 检测并关闭页面上的弹窗
 * 支持多种弹窗类型：确认对话框、提示弹窗、通知等
 * @param {Object} options - 配置选项
 * @param {string[]} options.closeButtonTexts - 关闭按钮的文本列表，默认 ['确定', '确认', '关闭', '知道了', '取消']
 * @param {number} options.maxDialogs - 最大处理弹窗数量，防止死循环，默认 5
 * @param {number} options.waitAfterClose - 关闭后等待时间(ms)，默认 1000
 * @returns {Promise<{closed: number, details: string[]}>}
 */
async function dismissDialogs(options = {}) {
  const {
    closeButtonTexts = ['确定', '确认', '关闭', '知道了', '取消'],
    maxDialogs = 5,
    waitAfterClose = 1000,
  } = options;

  let closed = 0;
  const details = [];

  for (let attempt = 0; attempt < maxDialogs; attempt++) {
    const dialogCode = `
      (function() {
        // 策略1: 查找模态对话框中的按钮
        var modalBtns = document.querySelectorAll('.ant-modal-body button, .ant-modal-footer button, [class*="dialog"] button, [class*="modal"] button');
        for (var i = 0; i < modalBtns.length; i++) {
          var text = modalBtns[i].textContent.trim();
          var rect = modalBtns[i].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && ${JSON.stringify(closeButtonTexts)}.includes(text)) {
            return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2, text: text, source: 'modal' };
          }
        }

        // 策略2: 查找页面中央的弹窗按钮（非模态）
        var allBtns = document.querySelectorAll('button, [role="button"], .ant-btn');
        for (var j = 0; j < allBtns.length; j++) {
          var text = allBtns[j].textContent.trim();
          var rect = allBtns[j].getBoundingClientRect();
          // 按钮必须在视口中央区域且可见
          if (rect.width > 0 && rect.height > 0 &&
              rect.top > 100 && rect.top < window.innerHeight - 100 &&
              rect.left > 100 && rect.left < window.innerWidth - 100 &&
              ${JSON.stringify(closeButtonTexts)}.includes(text)) {
            return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2, text: text, source: 'center' };
          }
        }

        // 策略3: 查找 ant-message / ant-notification 的关闭按钮
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

        // 策略4: 查找 GWT 弹窗 (x-window-draggable) 的关闭按钮
        var gwtWindows = document.querySelectorAll('.x-window-draggable, [class*="x-window"]');
        for (var m = 0; m < gwtWindows.length; m++) {
          var winRect = gwtWindows[m].getBoundingClientRect();
          if (winRect.width > 0 && winRect.height > 0 && winRect.top > 0) {
            // 在弹窗标题栏中查找关闭按钮
            // 使用通用选择器：包含 x-tool 类名的元素（兼容 GWT 不同版本）
            var closeBtn = gwtWindows[m].querySelector('[class*="x-tool"], .x-tool-close, [class*="x-tool-close"]');
            // 备选：查找 FD26IYC-jb-a 类的关闭按钮（GWT审批提醒弹窗）
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
    console.log(`检测到${source}弹窗，点击"${text}"关闭...`);
    await cdpClick(x, y, waitAfterClose);
    closed++;
    details.push(`${source}:${text}`);
  }

  if (closed > 0) {
    console.log(`共关闭 ${closed} 个弹窗`);
  }

  return { closed, details };
}

/**
 * 等待弹窗出现并关闭（用于已知会有弹窗的场景）
 * @param {number} timeout - 最大等待时间(ms)，默认 5000
 * @param {Object} options - dismissDialogs 的选项
 * @returns {Promise<{closed: number, details: string[]}>}
 */
async function waitAndDismissDialogs(timeout = 5000, options = {}) {
  const startTime = Date.now();
  let totalClosed = 0;
  const allDetails = [];

  while (Date.now() - startTime < timeout) {
    const result = await dismissDialogs(options);
    if (result.closed === 0) {
      // 没有弹窗了，提前结束
      break;
    }
    totalClosed += result.closed;
    allDetails.push(...result.details);
    // 等待一小段时间，让可能的连锁弹窗出现
    await new Promise((r) => setTimeout(r, 500));
  }

  return { closed: totalClosed, details: allDetails };
}

module.exports = {
  dismissDialogs,
  waitAndDismissDialogs,
};
