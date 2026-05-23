const CDP = require('chrome-remote-interface');
const {
  sleep, getTableRowCount, openSideMenu, clickDrawerItem,
  clickShowQuery, setDateRange, setTaxPeriod, clickPickerButton,
  pickFromDict, pickTaxSubject, closeBill
} = require('../utils/index');

async function exportVatPrepaymentLedger(options = {}) {
  const defaults = {
    startPeriod: '2026-04',
    endPeriod: '2026-04',
    companyCode: '1000200020040011',
    taxCode: '91110000101638302P',
    docType: '预缴计算单',
    queryOnly: false
  };
  const opts = { ...defaults, ...options };

  if (opts.queryOnly) {
    console.log('开始增值税预缴款台账查询...');
  } else {
    console.log('开始增值税预缴款台账查询导出...');
  }

  // 1. 导航至增值税预缴款台账
  console.log('1. 打开税务系统菜单...');
  await openSideMenu('税务系统');
  await sleep(1000);

  console.log('2. 点击税务台账...');
  await clickDrawerItem('税务台账');
  await sleep(1000);

  console.log('3. 点击增值税预缴款台账...');
  await clickDrawerItem('增值税预缴款台账');
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

    // 辅助函数：通过输入框ID查找旁边Picker按钮坐标
    async function findPickerButtonByInputId(inputId) {
      const result = await Runtime.evaluate({
        expression: `
          (function() {
            var input = document.getElementById('${inputId}');
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
        `,
        returnByValue: true
      });
      return result?.result?.value;
    }

    // 辅助函数：通过标签文本查找下拉箭头坐标（如"单据类型"右边的箭头）
    async function findDropdownArrowByLabelText(labelText) {
      const result = await Runtime.evaluate({
        expression: `
          (function() {
            // 1. 找到标签文本元素（如"单据类型："）
            var all = document.querySelectorAll('*');
            var labelEl = null;
            for (var i = 0; i < all.length; i++) {
              var text = all[i].textContent.trim();
              if (text === labelText + '：' || text === labelText) {
                var rect = all[i].getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0 && rect.left > 0) {
                  labelEl = all[i];
                  break;
                }
              }
            }
            if (!labelEl) return { found: false, reason: 'label_not_found' };
            var labelRect = labelEl.getBoundingClientRect();

            // 2. 找到同一行内的输入框（在标签右边）
            var inputs = document.querySelectorAll('input[type="text"]');
            var targetInput = null;
            for (var i = 0; i < inputs.length; i++) {
              var rect = inputs[i].getBoundingClientRect();
              // 输入框在标签右边，且垂直位置接近
              if (rect.left > labelRect.left && rect.left < labelRect.left + 400 &&
                  Math.abs(rect.top - labelRect.top) < 50 && rect.width > 0) {
                targetInput = inputs[i];
                break;
              }
            }
            if (!targetInput) return { found: false, reason: 'input_not_found' };
            var inputRect = targetInput.getBoundingClientRect();

            // 3. 在输入框的父元素内查找下拉箭头
            var parent = targetInput.parentElement;
            while (parent && parent.tagName !== 'BODY') {
              var arrows = parent.querySelectorAll('.FD26IYC-x-l');
              for (var j = 0; j < arrows.length; j++) {
                var rect = arrows[j].getBoundingClientRect();
                // 箭头在输入框右边，且垂直位置接近
                if (rect.left >= inputRect.left && rect.left < inputRect.left + 200 &&
                    Math.abs(rect.top - inputRect.top) < 50 && rect.width > 0 && rect.height > 0) {
                  return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
                }
              }
              parent = parent.parentElement;
            }
            return { found: false, reason: 'arrow_not_found' };
          })()
        `,
        returnByValue: true
      });
      return result?.result?.value;
    }

    // 辅助函数：查找下拉选项坐标
    async function findDropdownOption(text) {
      const result = await Runtime.evaluate({
        expression: `
          (function() {
            // 先尝试查找下拉选项专用类
            var items = document.querySelectorAll('.FD26IYC-S-a');
            for (var i = 0; i < items.length; i++) {
              if (items[i].textContent.trim() === '${text}') {
                var rect = items[i].getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0 && rect.left > 0) {
                  return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
                }
              }
            }
            //  fallback：遍历所有可见元素，但排除 input
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
        `,
        returnByValue: true
      });
      return result?.result?.value;
    }

    // 辅助函数：查找弹窗中的元素坐标
    async function findPopupElementByText(text, constraints = {}) {
      const { leftMin = 0, leftMax = 9999 } = constraints;
      const result = await Runtime.evaluate({
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
        `,
        returnByValue: true
      });
      return result?.result?.value;
    }

    // 2. 点击显示查询按钮（如果查询条件被折叠）
    console.log('4. 展开查询条件...');
    const showQueryBtn = await findElementByText('显示查询', { leftMin: 1700 });
    if (showQueryBtn?.found) {
      await Input.dispatchMouseEvent({ type: 'mousePressed', x: showQueryBtn.x, y: showQueryBtn.y, button: 'left', clickCount: 1 });
      await Input.dispatchMouseEvent({ type: 'mouseReleased', x: showQueryBtn.x, y: showQueryBtn.y, button: 'left', clickCount: 1 });
      await sleep(1500);
    }

    // 3. 设置单据类型
    console.log('5. 设置单据类型:', opts.docType);
    // 找到可见的输入框（value 包含"完税预缴单"或"预缴计算单"）
    const docTypeInputResult = await Runtime.evaluate({
      expression: `
        (function() {
          var allInputs = document.querySelectorAll('input');
          for (var i = 0; i < allInputs.length; i++) {
            var val = allInputs[i].value || '';
            if (val.indexOf('完税预缴单') >= 0 || val.indexOf('预缴计算单') >= 0 || val.indexOf('全部') >= 0) {
              var rect = allInputs[i].getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0 && rect.left > 0) {
                return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2, value: val };
              }
            }
          }
          return { found: false, reason: 'no_visible_input' };
        })()
      `,
      returnByValue: true
    });
    if (!docTypeInputResult?.result?.value?.found) {
      throw new Error('未找到单据类型输入框: ' + (docTypeInputResult?.result?.value?.reason || 'unknown'));
    }
    console.log('  找到输入框，当前值:', docTypeInputResult.result.value.value);
    const { x: ix, y: iy } = docTypeInputResult.result.value;
    console.log('  点击输入框，坐标:', ix, iy);
    await Input.dispatchMouseEvent({ type: 'mousePressed', x: ix, y: iy, button: 'left', clickCount: 1 });
    await Input.dispatchMouseEvent({ type: 'mouseReleased', x: ix, y: iy, button: 'left', clickCount: 1 });
    console.log('  已点击输入框，等待下拉菜单打开...');
    await sleep(2000);

    // 直接查找下拉选项"预缴计算单"
    const optionResult = await Runtime.evaluate({
      expression: `
        (function() {
          var all = document.querySelectorAll('.FD26IYC-S-a');
          for (var i = 0; i < all.length; i++) {
            if (all[i].textContent.trim() === '${opts.docType}') {
              var rect = all[i].getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0 && rect.left > 0) {
                return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
              }
            }
          }
          return { found: false };
        })()
      `,
      returnByValue: true
    });

    if (!optionResult?.result?.value?.found) {
      throw new Error('未找到下拉选项: ' + opts.docType);
    }
    const { x: ox, y: oy } = optionResult.result.value;
    console.log('  找到选项，坐标:', ox, oy);
    await Input.dispatchMouseEvent({ type: 'mousePressed', x: ox, y: oy, button: 'left', clickCount: 1 });
    await Input.dispatchMouseEvent({ type: 'mouseReleased', x: ox, y: oy, button: 'left', clickCount: 1 });
    console.log('  已点击选项，等待下拉菜单关闭...');
    await sleep(1500);

    // 4. 设置所属税期
    console.log('6. 设置所属税期:', opts.startPeriod, '至', opts.endPeriod);
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

    // 5. 选择申请单位
    console.log('7. 选择申请单位:', opts.companyCode);
    const companyBtn = await findPickerButtonByInputId('DataSetFieldComboBox1-input');
    if (companyBtn?.found) {
      await Input.dispatchMouseEvent({ type: 'mousePressed', x: companyBtn.x, y: companyBtn.y, button: 'left', clickCount: 1 });
      await Input.dispatchMouseEvent({ type: 'mouseReleased', x: companyBtn.x, y: companyBtn.y, button: 'left', clickCount: 1 });
      await sleep(2000);
      await pickFromDict(opts.companyCode);
      await sleep(1000);
    }

    // 6. 选择纳税主体
    console.log('8. 选择纳税主体:', opts.taxCode);
    const taxBtn = await findPickerButtonByInputId('DataSetFieldComboBox2-input');
    if (taxBtn?.found) {
      await Input.dispatchMouseEvent({ type: 'mousePressed', x: taxBtn.x, y: taxBtn.y, button: 'left', clickCount: 1 });
      await Input.dispatchMouseEvent({ type: 'mouseReleased', x: taxBtn.x, y: taxBtn.y, button: 'left', clickCount: 1 });
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
      const popupQueryBtn = await findPopupElementByText('查询');
      if (popupQueryBtn?.found) {
        await Input.dispatchMouseEvent({ type: 'mousePressed', x: popupQueryBtn.x, y: popupQueryBtn.y, button: 'left', clickCount: 1 });
        await Input.dispatchMouseEvent({ type: 'mouseReleased', x: popupQueryBtn.x, y: popupQueryBtn.y, button: 'left', clickCount: 1 });
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
      const confirmBtn = await findPopupElementByText('确定', { leftMin: 1000 });
      if (confirmBtn?.found) {
        await Input.dispatchMouseEvent({ type: 'mousePressed', x: confirmBtn.x, y: confirmBtn.y, button: 'left', clickCount: 1 });
        await Input.dispatchMouseEvent({ type: 'mouseReleased', x: confirmBtn.x, y: confirmBtn.y, button: 'left', clickCount: 1 });
        await sleep(1500);
      }
    }

    // 6. 点击查询按钮
    console.log('8. 点击查询按钮...');
    const queryBtn = await findElementByText('查询', { leftMin: 1700, topMin: 600 });
    if (queryBtn?.found) {
      await Input.dispatchMouseEvent({ type: 'mousePressed', x: queryBtn.x, y: queryBtn.y, button: 'left', clickCount: 1 });
      await Input.dispatchMouseEvent({ type: 'mouseReleased', x: queryBtn.x, y: queryBtn.y, button: 'left', clickCount: 1 });
      console.log('查询已执行，等待结果加载...');
      await sleep(5000);
    }

    // 如果仅查询模式，返回结果
    if (opts.queryOnly) {
      const rows = await getTableRowCount();
      console.log('查询完成，表格行数:', rows.visible);
      return { queried: true, rows, options: opts };
    }

    // 8. 点击导出按钮
    console.log('10. 点击导出按钮...');
    const exportBtnResult = await Runtime.evaluate({
      expression: `
        (function() {
          var all = document.querySelectorAll('*');
          for (var i = 0; i < all.length; i++) {
            var text = all[i].textContent.trim();
            if (text === '导出') {
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
    console.log('11. 点击弹窗确认导出...');
    const popupExportBtn = await findPopupElementByText('导出', { leftMin: 1000 });
    if (popupExportBtn?.found) {
      await Input.dispatchMouseEvent({ type: 'mousePressed', x: popupExportBtn.x, y: popupExportBtn.y, button: 'left', clickCount: 1 });
      await Input.dispatchMouseEvent({ type: 'mouseReleased', x: popupExportBtn.x, y: popupExportBtn.y, button: 'left', clickCount: 1 });
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

module.exports = { exportVatPrepaymentLedger };
