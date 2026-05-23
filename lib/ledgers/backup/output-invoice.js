const CDP = require('chrome-remote-interface');
const {
  sleep, getTableRowCount, openSideMenu, clickDrawerItem,
  clickShowQuery, setDateRange, setTaxPeriod, clickPickerButton,
  pickFromDict, pickTaxSubject, closeBill
} = require('../utils/index');

async function exportOutputInvoiceLedger(options = {}) {
  const defaults = {
    startDate: '2026-04-01',
    endDate: '2026-04-30',
    companyCode: '1000200020040011',
    sellerCode: '91110000101638302P',
    queryOnly: false
  };
  const opts = { ...defaults, ...options };

  if (opts.queryOnly) {
    console.log('开始销项发票明细台账查询...');
  } else {
    console.log('开始销项发票明细台账查询导出...');
  }

  // 1. 导航至销项发票台账
  console.log('1. 打开税务系统菜单...');
  await openSideMenu('税务系统');
  await sleep(1000);

  console.log('2. 点击税务台账...');
  await clickDrawerItem('税务台账');
  await sleep(1000);

  console.log('3. 点击销项发票台账...');
  await clickDrawerItem('销项发票台账');
  await sleep(2000);

  const client = await CDP({ port: 9222 });
  try {
    const { Runtime, Input } = client;

    // 2. 选择"销项发票明细台账"单选按钮（使用 CDP 真实点击 label）
    console.log('4. 选择销项发票明细台账...');
    const radioResult = await Runtime.evaluate({
      expression: `
        (function() {
          var all = document.querySelectorAll('*');
          var target = null;
          for (var i = 0; i < all.length; i++) {
            if (all[i].textContent.trim() === '销项发票明细台账') {
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
          return { success: false, reason: 'element not found' };
        })()
      `,
      returnByValue: true
    });

    if (!radioResult?.result?.value?.success) {
      throw new Error('Failed to select 销项发票明细台账: ' + (radioResult?.result?.value?.reason || 'unknown'));
    }

    // 使用 CDP 真实点击 label
    const { x: rx, y: ry } = radioResult.result.value;
    await Input.dispatchMouseEvent({ type: 'mousePressed', x: rx, y: ry, button: 'left', clickCount: 1 });
    await Input.dispatchMouseEvent({ type: 'mouseReleased', x: rx, y: ry, button: 'left', clickCount: 1 });
    console.log('已点击销项发票明细台账:', radioResult.result.value.tag);
    await sleep(1500);

    // 等待弹窗出现并点击查询按钮
    console.log('等待弹窗出现...');
    let popupQueryResult = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      popupQueryResult = await Runtime.evaluate({
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
            var all = visiblePopup.querySelectorAll('*');
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

      if (popupQueryResult?.result?.value?.found) {
        break;
      }
      await sleep(500);
    }

    if (popupQueryResult?.result?.value?.found) {
      const { x: pqx, y: pqy } = popupQueryResult.result.value;
      await Input.dispatchMouseEvent({ type: 'mousePressed', x: pqx, y: pqy, button: 'left', clickCount: 1 });
      await Input.dispatchMouseEvent({ type: 'mouseReleased', x: pqx, y: pqy, button: 'left', clickCount: 1 });
      console.log('弹窗查询已执行，等待页面加载...');
      await sleep(3000);
    } else {
      console.log('警告: 未找到弹窗查询按钮');
    }

    // 3. 展开查询条件
    console.log('5. 展开查询条件...');
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

    // 4. 选择"开票日期"单选按钮（使用 CDP 真实点击）
    console.log('6. 选择开票日期...');
    const dateRadioResult = await Runtime.evaluate({
      expression: `
        (function() {
          var radios = document.querySelectorAll('input[type="radio"]');
          for (var i = 0; i < radios.length; i++) {
            var rect = radios[i].getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && rect.left > 1800) {
              return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2, id: radios[i].id };
            }
          }
          return { found: false };
        })()
      `,
      returnByValue: true
    });

    if (dateRadioResult?.result?.value?.found) {
      const { x: rx, y: ry } = dateRadioResult.result.value;
      await Input.dispatchMouseEvent({ type: 'mousePressed', x: rx, y: ry, button: 'left', clickCount: 1 });
      await Input.dispatchMouseEvent({ type: 'mouseReleased', x: rx, y: ry, button: 'left', clickCount: 1 });
      console.log('已点击开票日期单选按钮:', dateRadioResult.result.value.id);
    }
    await sleep(1000);

    // 5. 设置开票日期范围
    console.log('7. 设置开票日期:', opts.startDate, '至', opts.endDate);
    await Runtime.evaluate({
      expression: `
        (function() {
          var start = document.getElementById('JINX_IPT_START-input');
          var end = document.getElementById('JINX_IPT_END-input');
          if (start) {
            start.value = '${opts.startDate}';
            start.setAttribute('value', '${opts.startDate}');
            start.dispatchEvent(new Event('input', { bubbles: true }));
            start.dispatchEvent(new Event('change', { bubbles: true }));
          }
          if (end) {
            end.value = '${opts.endDate}';
            end.setAttribute('value', '${opts.endDate}');
            end.dispatchEvent(new Event('input', { bubbles: true }));
            end.dispatchEvent(new Event('change', { bubbles: true }));
          }
        })()
      `
    });
    await sleep(500);

    // 6. 选择申请单位（左上角蓝色按钮）
    console.log('8. 选择申请单位:', opts.companyCode);
    const companyBtnResult = await Runtime.evaluate({
      expression: `
        (function() {
          var btns = document.querySelectorAll('.FD26IYC-w-l');
          for (var i = 0; i < btns.length; i++) {
            var rect = btns[i].getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && rect.left < 1000) {
              return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
            }
          }
          return { found: false };
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

    // 7. 选择销方（右侧蓝色按钮）
    console.log('9. 选择销方:', opts.sellerCode);
    const sellerBtnResult = await Runtime.evaluate({
      expression: `
        (function() {
          var input = document.getElementById('DataSetFieldComboBox6-input');
          if (!input) return { notFound: true };
          var parent = input.parentElement;
          var btn = parent.querySelector('.FD26IYC-w-l');
          if (btn) {
            var rect = btn.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
            }
          }
          return { found: false };
        })()
      `,
      returnByValue: true
    });

    if (sellerBtnResult?.result?.value?.found) {
      const { x: sx, y: sy } = sellerBtnResult.result.value;
      await Input.dispatchMouseEvent({ type: 'mousePressed', x: sx, y: sy, button: 'left', clickCount: 1 });
      await Input.dispatchMouseEvent({ type: 'mouseReleased', x: sx, y: sy, button: 'left', clickCount: 1 });
      await sleep(2000);
      await pickFromDict(opts.sellerCode);
      await sleep(1000);
    }

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
      await sleep(5000);
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

module.exports = { exportOutputInvoiceLedger };
