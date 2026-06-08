const {
  sleep, getTableRowCount, openSideMenu, clickDrawerItem,
  clickShowQuery, setDateRange, setTaxPeriod, clickPickerButton,
  pickFromDict, pickTaxSubject, closeBill,
  cdpEvaluateAndClick, cdpEvaluate
} = require('../utils/index');
const config = require('../config');

function periodToDateRange(period) {
  // period format: YYYY-MM
  const [year, month] = period.split('-');
  if (!year || !month || year.length !== 4 || month.length !== 2) return null;
  const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
  return {
    startDate: `${year}-${month}-01`,
    endDate: `${year}-${month}-${String(lastDay).padStart(2, '0')}`
  };
}

async function exportUnbilledIncomeLedger(options = {}) {
  const cfg = config.get();
  const defaults = {
    startDate: cfg.startDate || '2026-01-01',
    endDate: cfg.endDate || '2026-12-31',
    startPeriod: cfg.startPeriod || '2026-01',
    endPeriod: cfg.endPeriod || '2026-12',
    companyCode: cfg.companyCode || '1000200020040011',
    taxCode: cfg.taxCode || '91110000101638302P',
    voidStatus: cfg.voidStatus || '未作废',
    queryOnly: false
  };
  let opts = { ...defaults, ...options };

  // 如果未提供日期但提供了税期，从税期自动推导日期
  const hasStartDate = 'startDate' in options;
  const hasEndDate = 'endDate' in options;

  if (!hasStartDate && opts.startPeriod) {
    const derived = periodToDateRange(opts.startPeriod);
    if (derived) opts.startDate = derived.startDate;
  }
  if (!hasEndDate && opts.endPeriod) {
    const derived = periodToDateRange(opts.endPeriod);
    if (derived) opts.endDate = derived.endDate;
  }

  if (opts.queryOnly) {
    console.log('开始未开票收入台账查询...');
  } else {
    console.log('开始未开票收入台账查询导出...');
  }

  // 1. 导航
  console.log('1. 打开税务系统菜单...');
  await openSideMenu('税务系统');
  await sleep(1000);

  console.log('2. 点击税务台账...');
  await clickDrawerItem('税务台账');
  await sleep(1000);

  console.log('3. 点击未开票收入台账...');
  await clickDrawerItem('未开票收入台账');
  await sleep(2000);

  // 2. 展开查询
  console.log('4. 展开查询表单...');
  await clickShowQuery();
  await sleep(1000);

  // 3. 设置单据日期
  console.log('5. 设置单据日期:', opts.startDate, '至', opts.endDate);
  await setDateRange(opts.startDate, opts.endDate);
  await sleep(500);

  // 4. 设置所属税期
  console.log('6. 设置所属税期:', opts.startPeriod, '至', opts.endPeriod);
  await setTaxPeriod(opts.startPeriod, opts.endPeriod);
  await sleep(500);

  // 5. 选择申请单位
  console.log('7. 选择申请单位:', opts.companyCode);
  await clickPickerButton('申请单位');
  await sleep(2000);
  await pickFromDict(opts.companyCode);
  await sleep(1000);

  // 6. 选择纳税主体
  console.log('8. 选择纳税主体:', opts.taxCode);
  await pickTaxSubject(opts.taxCode);
  await sleep(1000);

  // 7. 设置作废状态 + 查询/导出（CDP 区域）
  console.log('9. 设置作废状态:', opts.voidStatus);

  // 点击作废状态下拉箭头
  await cdpEvaluateAndClick(`
    (function() {
      var all = document.querySelectorAll('*');
      var labelEl = null;
      for (var i = 0; i < all.length; i++) {
        var text = all[i].textContent.trim();
        if (text === '作废状态' || text === '作废状态：') {
          var rect = all[i].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && rect.left > 0) {
            labelEl = all[i];
            break;
          }
        }
      }
      if (!labelEl) return { found: false };
      var row = labelEl.parentElement;
      while (row && row.parentElement) {
        var rect = row.getBoundingClientRect();
        if (rect.width > 200) break;
        row = row.parentElement;
      }
      var arrows = row.querySelectorAll('.FD26IYC-x-l');
      for (var i = 0; i < arrows.length; i++) {
        var rect = arrows[i].getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
        }
      }
      return { found: false };
    })()
  `, { sleepMs: 1000 });

  // 选择指定状态
  await cdpEvaluateAndClick(`
    (function() {
      var allDivs = document.querySelectorAll('div');
      var options = Array.from(allDivs).filter(function(el) {
        return el.textContent.trim() === '${opts.voidStatus}';
      });
      var target = options.find(function(el) {
        var left = el.getBoundingClientRect().left;
        return left > 1000 && left < 2000;
      });
      if (!target) return { found: false };
      var rect = target.getBoundingClientRect();
      return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
    })()
  `, { sleepMs: 500 });

  // 8. 点击查询按钮
  console.log('10. 点击查询按钮...');
  await cdpEvaluateAndClick(`
    (function() {
      var allDivs = document.querySelectorAll('div');
      var target = null;
      for (var i = 0; i < allDivs.length; i++) {
        var el = allDivs[i];
        if (el.className && el.className.indexOf('FD26IYC-H-q') !== -1) {
          var text = el.textContent.trim();
          if (text === '查询') {
            var rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && rect.top > 300) {
              target = el;
              break;
            }
          }
        }
      }
      if (!target) return { found: false };
      var rect = target.getBoundingClientRect();
      return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
    })()
  `, { sleepMs: 3000, log: '查询已执行，等待结果加载...' });

  // 如果仅查询模式，返回结果
  if (opts.queryOnly) {
    const rows = await getTableRowCount();
    console.log('查询完成，表格行数:', rows.visible);
    return { queried: true, rows, options: opts };
  }

  // 9. 点击导出按钮
  console.log('11. 点击导出按钮...');
  await cdpEvaluateAndClick(`
    (function() {
      var allDivs = document.querySelectorAll('div');
      var target = null;
      for (var i = 0; i < allDivs.length; i++) {
        var el = allDivs[i];
        if (el.className && el.className.indexOf('FD26IYC-H-q') !== -1) {
          var text = el.textContent.trim();
          if (text === '导出') {
            var rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && rect.top < 200) {
              target = el;
              break;
            }
          }
        }
      }
      if (!target) return { found: false };
      var rect = target.getBoundingClientRect();
      return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
    })()
  `, { sleepMs: 2000 });

  // 10. 点击弹窗中的导出按钮
  console.log('12. 点击弹窗确认导出...');
  await cdpEvaluateAndClick(`
    (function() {
      var popup = document.querySelector('.FD26IYC-a-g');
      if (!popup) return { found: false };
      var allDivs = popup.querySelectorAll('div');
      var target = null;
      for (var i = 0; i < allDivs.length; i++) {
        var el = allDivs[i];
        if (el.className && el.className.indexOf('FD26IYC-D-d') !== -1 && el.className.indexOf('FD26IYC-D-o') !== -1) {
          if (el.textContent.trim() === '导出') {
            var rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              target = el;
              break;
            }
          }
        }
      }
      if (!target) return { found: false };
      var rect = target.getBoundingClientRect();
      return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
    })()
  `, { sleepMs: 2000 });

  // 检查弹窗是否关闭（纯 evaluate，不点击）
  const popupCheck = await cdpEvaluate(`document.querySelector('.FD26IYC-a-g') ? 'exists' : 'closed'`);

  if (popupCheck === 'closed') {
    console.log('导出完成！');
    await closeBill();
    return { exported: true, options: opts };
  }

  throw new Error('导出流程未完成');
}

module.exports = { exportUnbilledIncomeLedger };
