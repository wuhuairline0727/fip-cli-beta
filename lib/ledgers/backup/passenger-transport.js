const CDP = require('chrome-remote-interface');
const {
  sleep, getTableRowCount, openSideMenu, clickDrawerItem,
  clickShowQuery, setDateRange, setTaxPeriod, clickPickerButton,
  pickFromDict, pickTaxSubject, closeBill
} = require('../utils/index');

async function exportPassengerTransportLedger(options = {}) {
  const defaults = {
    startPeriod: '2026-04',
    endPeriod: '2026-04',
    companyCode: '1000200020040011',
    taxCode: '91110000101638302P',
    queryOnly: false
  };
  const opts = { ...defaults, ...options };

  if (opts.queryOnly) {
    console.log('开始旅客运输服务台账查询...');
  } else {
    console.log('开始旅客运输服务台账查询导出...');
  }

  // 1. 导航至旅客运输服务台账
  console.log('1. 打开税务系统菜单...');
  await openSideMenu('税务系统');
  await sleep(1000);

  console.log('2. 点击税务台账...');
  await clickDrawerItem('税务台账');
  await sleep(1000);

  console.log('3. 点击旅客运输服务台账...');
  await clickDrawerItem('旅客运输服务台账');
  await sleep(2000);

  const client = await CDP({ port: 9222 });
  try {
    const { Runtime, Input } = client;

    // 辅助函数：通过文本动态查找元素坐标
    async function findElementByText(text, constraints = {}) {
      const { leftMin = 0, leftMax = 9999, topMin = 0, topMax = 9999 } = constraints;
      const result = await Runtime.evaluate({
        expression: `
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
        `,
        returnByValue: true
      });
      return result?.result?.value;
    }

    // 2. 点击显示查询按钮
    console.log('4. 展开查询条件...');
    const showQueryBtn = await findElementByText('显示查询', { leftMin: 1700 });
    if (showQueryBtn?.found) {
      await Input.dispatchMouseEvent({ type: 'mousePressed', x: showQueryBtn.x, y: showQueryBtn.y, button: 'left', clickCount: 1 });
      await Input.dispatchMouseEvent({ type: 'mouseReleased', x: showQueryBtn.x, y: showQueryBtn.y, button: 'left', clickCount: 1 });
      await sleep(1500);
    }

    // 3. 设置所属税期
    console.log('5. 设置所属税期:', opts.startPeriod, '至', opts.endPeriod);
    await Runtime.evaluate({
      expression: `
        (function() {
          var start = document.getElementById('FormDateFieldYM1-input');
          var end = document.getElementById('FormDateFieldYM2-input');
          if (start) {
            start.value = '${opts.startPeriod}';
            start.setAttribute('value', '${opts.startPeriod}');
            start.dispatchEvent(new Event('input', { bubbles: true }));
            start.dispatchEvent(new Event('change', { bubbles: true }));
          }
          if (end) {
            end.value = '${opts.endPeriod}';
            end.setAttribute('value', '${opts.endPeriod}');
            end.dispatchEvent(new Event('input', { bubbles: true }));
            end.dispatchEvent(new Event('change', { bubbles: true }));
          }
        })()
      `,
      returnByValue: true
    });
    await sleep(500);

    // 4. 选择申请单位
    console.log('6. 选择申请单位:', opts.companyCode);
    const companyBtnResult = await Runtime.evaluate({
      expression: `
        (function() {
          var input = document.getElementById('DataSetFieldComboBox1-input');
          if (!input) return { found: false, reason: 'input_not_found' };
          var parent = input.parentElement;
          var btn = parent.querySelector('.FD26IYC-w-l');
          if (!btn) return { found: false, reason: 'button_not_found' };
          var rect = btn.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
          }
          return { found: false, reason: 'button_not_visible' };
        })()
      `,
      returnByValue: true
    });
    if (companyBtnResult?.result?.value?.found) {
      const { x: cx, y: cy } = companyBtnResult.result.value;
      await Input.dispatchMouseEvent({ type: 'mousePressed', x: cx, y: cy, button: 'left', clickCount: 1 });
      await Input.dispatchMouseEvent({ type: 'mouseReleased', x: cx, y: cy, button: 'left', clickCount: 1 });
      await sleep(2000);
      await pickFromDict(opts.companyCode);
      await sleep(1000);
    }

    // 5. 选择纳税主体
    console.log('7. 选择纳税主体:', opts.taxCode);
    const taxBtnResult = await Runtime.evaluate({
      expression: `
        (function() {
          var input = document.getElementById('DataSetFieldComboBox2-input');
          if (!input) return { found: false, reason: 'input_not_found' };
          var parent = input.parentElement;
          var btn = parent.querySelector('.FD26IYC-w-l');
          if (!btn) return { found: false, reason: 'button_not_found' };
          var rect = btn.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
          }
          return { found: false, reason: 'button_not_visible' };
        })()
      `,
      returnByValue: true
    });
    if (taxBtnResult?.result?.value?.found) {
      const { x: tx, y: ty } = taxBtnResult.result.value;
      await Input.dispatchMouseEvent({ type: 'mousePressed', x: tx, y: ty, button: 'left', clickCount: 1 });
      await Input.dispatchMouseEvent({ type: 'mouseReleased', x: tx, y: ty, button: 'left', clickCount: 1 });
      await sleep(2000);

      // 在弹窗中输入税号
      await Runtime.evaluate({
        expression: `
          (function() {
            var popup = document.querySelector('.FD26IYC-a-g');
            if (!popup) return { found: false };
            var input = popup.querySelector('#FormTextInput1-input');
            if (input) {
              input.value = '${opts.taxCode}';
              input.setAttribute('value', '${opts.taxCode}');
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
              return { found: true };
            }
            return { found: false };
          })()
        `,
        returnByValue: true
      });
      await sleep(500);

      // 点击弹窗查询按钮
      const popupQueryBtn = await Runtime.evaluate({
        expression: `
          (function() {
            var popup = document.querySelector('.FD26IYC-a-g');
            if (!popup) return { found: false };
            var all = popup.querySelectorAll('*');
            for (var i = 0; i < all.length; i++) {
              if (all[i].textContent.trim() === '查询') {
                var rect = all[i].getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                  return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
                }
              }
            }
            return { found: false };
          })()
        `,
        returnByValue: true
      });
      if (popupQueryBtn?.result?.value?.found) {
        const { x: pqx, y: pqy } = popupQueryBtn.result.value;
        await Input.dispatchMouseEvent({ type: 'mousePressed', x: pqx, y: pqy, button: 'left', clickCount: 1 });
        await Input.dispatchMouseEvent({ type: 'mouseReleased', x: pqx, y: pqy, button: 'left', clickCount: 1 });
        await sleep(2000);
      }

      // 选择包含税号的行
      const rowResult = await Runtime.evaluate({
        expression: `
          (function() {
            var popup = document.querySelector('.FD26IYC-a-g');
            if (!popup) return { found: false };
            var rows = popup.querySelectorAll('tr');
            for (var i = 0; i < rows.length; i++) {
              if (rows[i].textContent.indexOf('${opts.taxCode}') >= 0) {
                var rect = rows[i].getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                  return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
                }
              }
            }
            return { found: false };
          })()
        `,
        returnByValue: true
      });
      if (rowResult?.result?.value?.found) {
        const { x: rx, y: ry } = rowResult.result.value;
        await Input.dispatchMouseEvent({ type: 'mousePressed', x: rx, y: ry, button: 'left', clickCount: 1 });
        await Input.dispatchMouseEvent({ type: 'mouseReleased', x: rx, y: ry, button: 'left', clickCount: 1 });
        await sleep(500);
      }

      // 点击确定按钮
      const confirmBtn = await Runtime.evaluate({
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
        returnByValue: true
      });
      if (confirmBtn?.result?.value?.found) {
        const { x: cx, y: cy } = confirmBtn.result.value;
        await Input.dispatchMouseEvent({ type: 'mousePressed', x: cx, y: cy, button: 'left', clickCount: 1 });
        await Input.dispatchMouseEvent({ type: 'mouseReleased', x: cx, y: cy, button: 'left', clickCount: 1 });
        await sleep(1500);
      }
    }

    // 6. 点击查询按钮
    console.log('8. 点击查询按钮...');
    const queryBtn = await findElementByText('查询', { leftMin: 1700, topMin: 700 });
    if (queryBtn?.found) {
      await Input.dispatchMouseEvent({ type: 'mousePressed', x: queryBtn.x, y: queryBtn.y, button: 'left', clickCount: 1 });
      await Input.dispatchMouseEvent({ type: 'mouseReleased', x: queryBtn.x, y: queryBtn.y, button: 'left', clickCount: 1 });
      console.log('查询已执行，等待结果加载...');
      await sleep(3000);
    }

    // 如果仅查询模式，返回结果
    if (opts.queryOnly) {
      const rows = await getTableRowCount();
      console.log('查询完成，表格行数:', rows.visible);
      return { queried: true, rows, options: opts };
    }

    // 7. 点击导出按钮
    console.log('9. 点击导出按钮...');
    const exportBtnResult = await Runtime.evaluate({
      expression: `
        (function() {
          var all = document.querySelectorAll('*');
          for (var i = 0; i < all.length; i++) {
            if (all[i].textContent.trim() === '导出') {
              var rect = all[i].getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0 && rect.left > 0 && rect.left < 500 && rect.top < 200) {
                return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
              }
            }
          }
          return { found: false };
        })()
      `,
      returnByValue: true
    });
    if (!exportBtnResult?.result?.value?.found) {
      throw new Error('未找到导出按钮');
    }
    const { x: ex, y: ey } = exportBtnResult.result.value;
    console.log('  导出按钮坐标:', ex, ey);
    await Input.dispatchMouseEvent({ type: 'mousePressed', x: ex, y: ey, button: 'left', clickCount: 1 });
    await Input.dispatchMouseEvent({ type: 'mouseReleased', x: ex, y: ey, button: 'left', clickCount: 1 });
    await sleep(2000);

    // 8. 点击弹窗中的导出按钮
    console.log('10. 点击弹窗确认导出...');
    const popupExportBtn = await Runtime.evaluate({
      expression: `
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
          if (!visiblePopup) return { found: false };
          var all = visiblePopup.querySelectorAll('*');
          for (var i = 0; i < all.length; i++) {
            if (all[i].textContent.trim() === '导出') {
              var rect = all[i].getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0 && rect.left > 1000) {
                return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
              }
            }
          }
          return { found: false };
        })()
      `,
      returnByValue: true
    });

    if (popupExportBtn?.result?.value?.found) {
      const { x: pex, y: pey } = popupExportBtn.result.value;
      await Input.dispatchMouseEvent({ type: 'mousePressed', x: pex, y: pey, button: 'left', clickCount: 1 });
      await Input.dispatchMouseEvent({ type: 'mouseReleased', x: pex, y: pey, button: 'left', clickCount: 1 });
      await sleep(2000);

      // 检查弹窗是否关闭
      const popupCheck = await Runtime.evaluate({
        expression: `
          (function() {
            var popups = document.querySelectorAll('.FD26IYC-a-g, .gwt-DialogBox, [class*=DialogBox]');
            for (var i = 0; i < popups.length; i++) {
              var rect = popups[i].getBoundingClientRect();
              if (rect.left > 0 && rect.width > 0) return 'exists';
            }
            return 'closed';
          })()
        `,
        returnByValue: true
      });

      if (popupCheck.result.value === 'closed') {
        console.log('导出完成！');
        await closeBill();
        return { exported: true, options: opts };
      }
    } else {
      // 如果没有弹窗，可能是直接下载了
      console.log('导出完成（直接下载）！');
      await closeBill();
      return { exported: true, options: opts };
    }
  } finally {
    await client.close();
  }

  throw new Error('导出流程未完成');
}

module.exports = { exportPassengerTransportLedger };
