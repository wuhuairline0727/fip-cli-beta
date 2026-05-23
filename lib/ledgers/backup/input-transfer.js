const CDP = require('chrome-remote-interface');
const {
  sleep, getTableRowCount, openSideMenu, clickDrawerItem,
  clickShowQuery, setDateRange, setTaxPeriod, clickPickerButton,
  pickFromDict, pickTaxSubject, closeBill
} = require('../utils/index');

async function exportInputTransferLedger(options = {}) {
  const defaults = {
    startPeriod: '2026-04',
    endPeriod: '2026-04',
    companyCode: '1000200020040011',
    taxCode: '91110000101638302P',
    docStatus: '流程结束',
    queryOnly: false
  };
  const opts = { ...defaults, ...options };

  if (opts.queryOnly) {
    console.log('开始进项转出明细台账查询...');
  } else {
    console.log('开始进项转出明细台账查询导出...');
  }

  // 1. 导航至进项转出明细台账
  console.log('1. 打开税务系统菜单...');
  await openSideMenu('税务系统');
  await sleep(1000);

  console.log('2. 点击税务台账...');
  await clickDrawerItem('税务台账');
  await sleep(1000);

  console.log('3. 点击进项转出台账...');
  await clickDrawerItem('进项转出台账');
  await sleep(2000);

  // 2. 选择"进项转出明细台账"单选按钮
  console.log('4. 选择进项转出明细台账...');
  const client = await CDP({ port: 9222 });
  try {
    const { Runtime, Input } = client;

    // 查找并点击"进项转出明细台账"单选按钮
    const radioResult = await Runtime.evaluate({
      expression: `
        (function() {
          var all = document.querySelectorAll('*');
          var target = null;
          for (var i = 0; i < all.length; i++) {
            if (all[i].textContent.trim() === '进项转出明细台账') {
              var rect = all[i].getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0 && rect.left > 0) {
                target = all[i];
                break;
              }
            }
          }
          if (target) {
            var rect = target.getBoundingClientRect();
            return { success: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2, tag: target.tagName };
          }
          return { success: false, reason: 'label not found' };
        })()
      `,
      returnByValue: true
    });

    if (!radioResult?.result?.value?.success) {
      throw new Error('Failed to select 进项转出明细台账: ' + (radioResult?.result?.value?.reason || 'unknown'));
    }

    // 使用 CDP 真实点击 label
    const { x: rx, y: ry } = radioResult.result.value;
    await Input.dispatchMouseEvent({ type: 'mousePressed', x: rx, y: ry, button: 'left', clickCount: 1 });
    await Input.dispatchMouseEvent({ type: 'mouseReleased', x: rx, y: ry, button: 'left', clickCount: 1 });
    console.log('已点击进项转出明细台账:', radioResult.result.value.tag);
    await sleep(1500);

    // 点击弹窗中的查询按钮
    await sleep(500);
    const popupQueryResult = await Runtime.evaluate({
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
          if (!visiblePopup) return { popupFound: false };
          var spans = visiblePopup.querySelectorAll('span');
          for (var i = 0; i < spans.length; i++) {
            if (spans[i].textContent.trim() === '查询') {
              var rect = spans[i].getBoundingClientRect();
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

    if (popupQueryResult?.result?.value?.found) {
      const { x: pqx, y: pqy } = popupQueryResult.result.value;
      await Input.dispatchMouseEvent({ type: 'mousePressed', x: pqx, y: pqy, button: 'left', clickCount: 1 });
      await Input.dispatchMouseEvent({ type: 'mouseReleased', x: pqx, y: pqy, button: 'left', clickCount: 1 });
      console.log('弹窗查询已执行，等待页面加载...');
      await sleep(3000);
    }

    // 3. 展开查询条件
    console.log('5. 展开查询条件...');

    // 点击显示查询按钮
    const showQueryResult = await Runtime.evaluate({
      expression: `
        (function() {
          var all = document.querySelectorAll('*');
          for (var i = 0; i < all.length; i++) {
            if (all[i].textContent.trim() === '显示查询') {
              var rect = all[i].getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0 && rect.left > 1700) {
                return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
              }
            }
          }
          return { found: false };
        })()
      `,
      returnByValue: true
    });

    if (showQueryResult?.result?.value?.found) {
      const { x, y } = showQueryResult.result.value;
      await Input.dispatchMouseEvent({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await Input.dispatchMouseEvent({ type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
      await sleep(1500);
    }

    // 3. 选择"转出税期"单选按钮（使用 CDP 真实点击）
    console.log('5. 选择转出税期...');
    const taxPeriodRadioResult = await Runtime.evaluate({
      expression: `
        (function() {
          var radios = document.querySelectorAll('input[type="radio"]');
          for (var i = 0; i < radios.length; i++) {
            var rect = radios[i].getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && rect.left > 1800) {
              // 右侧的单选按钮是"转出税期"
              return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2, id: radios[i].id };
            }
          }
          return { found: false };
        })()
      `,
      returnByValue: true
    });

    if (taxPeriodRadioResult?.result?.value?.found) {
      const { x: rx, y: ry } = taxPeriodRadioResult.result.value;
      await Input.dispatchMouseEvent({ type: 'mousePressed', x: rx, y: ry, button: 'left', clickCount: 1 });
      await Input.dispatchMouseEvent({ type: 'mouseReleased', x: rx, y: ry, button: 'left', clickCount: 1 });
      console.log('已点击转出税期单选按钮:', taxPeriodRadioResult.result.value.id);
    }
    await sleep(1000);

    // 4. 设置税期范围
    console.log('6. 设置转出税期:', opts.startPeriod, '至', opts.endPeriod);
    await Runtime.evaluate({
      expression: `
        (function() {
          var start = document.getElementById('FormDateFieldYM2-input');
          var end = document.getElementById('FormDateFieldYM3-input');
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
      `
    });
    await sleep(500);

    // 5. 设置单据状态
    console.log('7. 设置单据状态:', opts.docStatus);
    const statusResult = await Runtime.evaluate({
      expression: `
        (function() {
          var input = document.getElementById('FormComboBoxDJZT-input');
          if (!input) return { found: false };
          var rect = input.getBoundingClientRect();
          return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
        })()
      `,
      returnByValue: true
    });

    if (statusResult?.result?.value?.found) {
      const { x: sx, y: sy } = statusResult.result.value;
      await Input.dispatchMouseEvent({ type: 'mousePressed', x: sx, y: sy, button: 'left', clickCount: 1 });
      await Input.dispatchMouseEvent({ type: 'mouseReleased', x: sx, y: sy, button: 'left', clickCount: 1 });
      await sleep(1000);

      // 选择指定状态
      const optionResult = await Runtime.evaluate({
        expression: `
          (function() {
            var all = document.querySelectorAll('*');
            for (var i = 0; i < all.length; i++) {
              if (all[i].textContent.trim() === '${opts.docStatus}') {
                var rect = all[i].getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0 && rect.top > 300 && rect.top < 500 && rect.left > 1700) {
                  return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
                }
              }
            }
            return { found: false };
          })()
        `,
        returnByValue: true
      });

      if (optionResult?.result?.value?.found) {
        const { x: ox, y: oy } = optionResult.result.value;
        await Input.dispatchMouseEvent({ type: 'mousePressed', x: ox, y: oy, button: 'left', clickCount: 1 });
        await Input.dispatchMouseEvent({ type: 'mouseReleased', x: ox, y: oy, button: 'left', clickCount: 1 });
        await sleep(500);
      }
    }

    // 6. 选择转出单位
    console.log('8. 选择转出单位:', opts.companyCode);
    await clickPickerButton('转出单位');
    await sleep(2000);
    await pickFromDict(opts.companyCode);
    await sleep(1000);

    // 7. 选择纳税主体（自定义逻辑，使用文本查找确定按钮）
    console.log('9. 选择纳税主体:', opts.taxCode);
    await clickPickerButton('纳税主体');
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

    // 点击查询按钮
    const taxQueryResult = await Runtime.evaluate({
      expression: `
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
      `,
      returnByValue: true
    });
    await sleep(2000);

    // 点击第一行结果
    const taxSelectResult = await Runtime.evaluate({
      expression: `
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
      `,
      returnByValue: true
    });
    await sleep(500);

    // 使用 CDP 点击确定按钮（通过文本查找）
    const taxConfirmResult = await Runtime.evaluate({
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

    if (taxConfirmResult?.result?.value?.found) {
      const { x: tcx, y: tcy } = taxConfirmResult.result.value;
      await Input.dispatchMouseEvent({ type: 'mousePressed', x: tcx, y: tcy, button: 'left', clickCount: 1 });
      await Input.dispatchMouseEvent({ type: 'mouseReleased', x: tcx, y: tcy, button: 'left', clickCount: 1 });
      await sleep(1500);

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

      if (popupCheck.result.value === 'exists') {
        throw new Error('纳税主体弹窗未关闭');
      }
    }
    await sleep(500);

    // 8. 点击查询按钮
    console.log('10. 点击查询按钮...');
    const queryResult = await Runtime.evaluate({
      expression: `
        (function() {
          var all = document.querySelectorAll('*');
          for (var i = 0; i < all.length; i++) {
            if (all[i].textContent.trim() === '查询') {
              var rect = all[i].getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0 && rect.left > 1700 && rect.top > 600) {
                return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
              }
            }
          }
          return { found: false };
        })()
      `,
      returnByValue: true
    });

    if (queryResult?.result?.value?.found) {
      const { x: qx, y: qy } = queryResult.result.value;
      await Input.dispatchMouseEvent({ type: 'mousePressed', x: qx, y: qy, button: 'left', clickCount: 1 });
      await Input.dispatchMouseEvent({ type: 'mouseReleased', x: qx, y: qy, button: 'left', clickCount: 1 });
      console.log('查询已执行，等待结果加载...');
      await sleep(3000);
    }

    // 如果仅查询模式，返回结果
    if (opts.queryOnly) {
      const rows = await getTableRowCount();
      console.log('查询完成，表格行数:', rows.visible);
      return { queried: true, rows, options: opts };
    }

    // 9. 点击导出按钮
    console.log('11. 点击导出按钮...');
    const exportResult = await Runtime.evaluate({
      expression: `
        (function() {
          var activePane = document.querySelector('.ant-tabs-tabpane-active');
          if (!activePane) return { found: false };
          var all = activePane.querySelectorAll('*');
          for (var i = 0; i < all.length; i++) {
            if (all[i].textContent.trim() === '导出') {
              var rect = all[i].getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0 && rect.left < 500 && rect.top < 200) {
                return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
              }
            }
          }
          return { found: false };
        })()
      `,
      returnByValue: true
    });

    if (exportResult?.result?.value?.found) {
      const { x: ex, y: ey } = exportResult.result.value;
      await Input.dispatchMouseEvent({ type: 'mousePressed', x: ex, y: ey, button: 'left', clickCount: 1 });
      await Input.dispatchMouseEvent({ type: 'mouseReleased', x: ex, y: ey, button: 'left', clickCount: 1 });
      await sleep(2000);

      // 10. 点击弹窗中的导出按钮
      console.log('12. 点击弹窗确认导出...');
      const popupExportResult = await Runtime.evaluate({
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

      if (popupExportResult?.result?.value?.found) {
        const { x: pex, y: pey } = popupExportResult.result.value;
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
      }
    }
  } finally {
    await client.close();
  }

  throw new Error('导出流程未完成');
}

module.exports = { exportInputTransferLedger };
