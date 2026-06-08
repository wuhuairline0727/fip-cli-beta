# FIP CLI Phase 3: 新增税务台账导出命令

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于税务系统操作手册中明确记载的台账模块，新增 5 个可复用现有自动化模式的导出命令：发票收票登记单台账、完税确认台账、税金计提台账、增值税清算底稿、企业所得税分配台账。

**Architecture:** 完全复用现有 ledger 架构：每个模块一个 `lib/ledgers/<name>.js` 文件，暴露 `exportXxxLedger(options)` 函数；`lib/fip.js` 聚合导出；`bin/fip-cli.js` 注册 CLI 命令。所有模块遵循同一流程：导航 → 展开查询 → 设置条件 → 点击查询 → （可选）导出 Excel → 关闭页面。

**Tech Stack:** Node.js, Commander.js, Chrome Remote Interface (CDP), Kimi WebBridge

---

## 当前状态

Phase 2 已完成（表格数据读取、Dashboard 探索、单据搜索、附件下载、批量导出）。

现有 5 个 ledger 命令：
- `export-unbilled` — 未开票收入台账
- `export-input-transfer` — 进项转出明细台账
- `export-output-invoice` — 销项发票明细台账
- `export-vat-prepayment` — 增值税预缴款台账
- `export-passenger-transport` — 旅客运输服务台账

基础设施已就绪：CDP 抽象层、配置系统、Picker 弹窗处理、条件轮询、自动截图。

---

## 文件结构变更

```
lib/
├── ledgers/
│   ├── ... (existing 5 ledgers)
│   ├── invoice-receipt.js      # NEW: 发票收票登记单台账
│   ├── tax-paid.js             # NEW: 完税确认台账
│   ├── tax-accrual.js          # NEW: 税金计提台账
│   ├── vat-clearance.js        # NEW: 增值税清算底稿
│   └── income-tax-allocation.js # NEW: 企业所得税分配台账
├── utils/
│   └── ... (existing, no changes)
├── fip.js                      # MODIFY: register new exports
└── config.js                   # no changes

bin/
└── fip-cli.js                  # MODIFY: register new CLI commands
```

---

## Task 1: 发票收票登记单台账 (`lib/ledgers/invoice-receipt.js`)

**背景:** 手册"发票管理 → 发票收票登记单台账"模块。查询条件：单据日期范围、所属税期、申请单位、纳税主体、发票类型、认证状态。输出：收票登记明细列表，支持导出 Excel。

**Files:**
- Create: `lib/ledgers/invoice-receipt.js`
- Modify: `lib/fip.js`
- Modify: `bin/fip-cli.js`

- [ ] **Step 1: 创建 ledger 文件**

```javascript
// lib/ledgers/invoice-receipt.js
const {
  sleep, getTableRowCount, openSideMenu, clickDrawerItem,
  clickShowQuery, setDateRange, setTaxPeriod, clickPickerButton,
  pickFromDict, pickTaxSubject, closeBill,
  cdpEvaluateAndClick, cdpEvaluate
} = require('../utils/index');
const config = require('../config');

async function exportInvoiceReceiptLedger(options = {}) {
  const cfg = config.get();
  const defaults = {
    startDate: cfg.startDate || '2026-04-01',
    endDate: cfg.endDate || '2026-04-30',
    startPeriod: cfg.startPeriod || '2026-04',
    endPeriod: cfg.endPeriod || '2026-04',
    companyCode: cfg.companyCode || '1000200020040011',
    taxCode: cfg.taxCode || '91110000101107173B',
    invoiceType: cfg.invoiceType || '全部',
    certifyStatus: cfg.certifyStatus || '全部',
    queryOnly: false
  };
  const opts = { ...defaults, ...options };

  if (opts.queryOnly) {
    console.log('开始发票收票登记单台账查询...');
  } else {
    console.log('开始发票收票登记单台账查询导出...');
  }

  // 1. 导航
  console.log('1. 打开税务系统菜单...');
  await openSideMenu('税务系统');
  await sleep(1000);

  console.log('2. 点击发票管理...');
  await clickDrawerItem('发票管理');
  await sleep(1000);

  console.log('3. 点击发票收票登记单台账...');
  await clickDrawerItem('发票收票登记单台账');
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

  // 7. 设置发票类型（如有下拉）
  if (opts.invoiceType && opts.invoiceType !== '全部') {
    console.log('9. 设置发票类型:', opts.invoiceType);
    await cdpEvaluateAndClick(`
      (function() {
        var all = document.querySelectorAll('*');
        var labelEl = null;
        for (var i = 0; i < all.length; i++) {
          var text = all[i].textContent.trim();
          if (text === '发票类型' || text === '发票类型：') {
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

    await cdpEvaluateAndClick(`
      (function() {
        var allDivs = document.querySelectorAll('div');
        var options = Array.from(allDivs).filter(function(el) {
          return el.textContent.trim() === '${opts.invoiceType}';
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
  }

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

  // 检查弹窗是否关闭
  const popupCheck = await cdpEvaluate(`document.querySelector('.FD26IYC-a-g') ? 'exists' : 'closed'`);

  if (popupCheck === 'closed') {
    console.log('导出完成！');
    await closeBill();
    return { exported: true, options: opts };
  }

  throw new Error('导出流程未完成');
}

module.exports = { exportInvoiceReceiptLedger };
```

- [ ] **Step 2: 在 `lib/fip.js` 中注册**

```javascript
// Add to requires at top
const invoiceReceipt = require('./ledgers/invoice-receipt');

// Add to module.exports
module.exports = {
  // ... existing exports
  exportInvoiceReceiptLedger: invoiceReceipt.exportInvoiceReceiptLedger,
};
```

- [ ] **Step 3: 在 `bin/fip-cli.js` 中注册 CLI 命令**

```javascript
program
  .command('export-invoice-receipt')
  .description('发票收票登记单台账查询导出（完整流程）')
  .option('--start-date <date>', '起始日期 (YYYY-MM-DD)', cfg.startDate)
  .option('--end-date <date>', '截止日期 (YYYY-MM-DD)', cfg.endDate)
  .option('--start-period <period>', '起始税期 (YYYY-MM)', cfg.startPeriod)
  .option('--end-period <period>', '截止税期 (YYYY-MM)', cfg.endPeriod)
  .option('--company-code <code>', '申请单位编码', cfg.companyCode)
  .option('--tax-code <code>', '纳税主体税号', cfg.taxCode)
  .option('--invoice-type <type>', '发票类型 (全部/增值税专用发票/增值税普通发票/电子发票等)', cfg.invoiceType)
  .option('--certify-status <status>', '认证状态 (全部/已认证/未认证)', cfg.certifyStatus)
  .option('--query-only', '仅查询不导出', false)
  .action(async (options) => {
    try {
      const result = await fip.exportInvoiceReceiptLedger({
        startDate: options.startDate,
        endDate: options.endDate,
        startPeriod: options.startPeriod,
        endPeriod: options.endPeriod,
        companyCode: options.companyCode,
        taxCode: options.taxCode,
        invoiceType: options.invoiceType,
        certifyStatus: options.certifyStatus,
        queryOnly: options.queryOnly
      });
      success(result);
    } catch (e) {
      error('export_invoice_receipt_error', e.message);
    }
  });
```

- [ ] **Step 4: 测试验证**

Run: `fip-cli export-invoice-receipt --query-only --start-period 2026-04 --end-period 2026-04`
Expected: JSON with `{ queried: true, rows: { total, visible } }`

- [ ] **Step 5: Commit**

```bash
git add lib/ledgers/invoice-receipt.js lib/fip.js bin/fip-cli.js
git commit -m "feat: add invoice receipt ledger export command"
```

---

## Task 2: 完税确认台账 (`lib/ledgers/tax-paid.js`)

**背景:** 手册"完税确认 → 完税确认台账"模块。查询条件：税期范围、申请单位、纳税主体、完税类型。该模块与增值税预缴款台账类似，但属于"完税确认"业务线。

**Files:**
- Create: `lib/ledgers/tax-paid.js`
- Modify: `lib/fip.js`
- Modify: `bin/fip-cli.js`

- [ ] **Step 1: 创建 ledger 文件**

```javascript
// lib/ledgers/tax-paid.js
const {
  sleep, getTableRowCount, openSideMenu, clickDrawerItem,
  clickShowQuery, setTaxPeriod, clickPickerButton,
  pickFromDict, pickTaxSubject, closeBill,
  cdpEvaluateAndClick, cdpEvaluate
} = require('../utils/index');
const config = require('../config');

async function exportTaxPaidLedger(options = {}) {
  const cfg = config.get();
  const defaults = {
    startPeriod: cfg.startPeriod || '2026-04',
    endPeriod: cfg.endPeriod || '2026-04',
    companyCode: cfg.companyCode || '1000200020040011',
    taxCode: cfg.taxCode || '91110000101107173B',
    taxType: cfg.taxType || '全部',
    queryOnly: false
  };
  const opts = { ...defaults, ...options };

  if (opts.queryOnly) {
    console.log('开始完税确认台账查询...');
  } else {
    console.log('开始完税确认台账查询导出...');
  }

  // 1. 导航
  console.log('1. 打开税务系统菜单...');
  await openSideMenu('税务系统');
  await sleep(1000);

  console.log('2. 点击完税确认...');
  await clickDrawerItem('完税确认');
  await sleep(1000);

  console.log('3. 点击完税确认台账...');
  await clickDrawerItem('完税确认台账');
  await sleep(2000);

  // 2. 展开查询
  console.log('4. 展开查询表单...');
  await clickShowQuery();
  await sleep(1000);

  // 3. 设置所属税期
  console.log('5. 设置所属税期:', opts.startPeriod, '至', opts.endPeriod);
  await setTaxPeriod(opts.startPeriod, opts.endPeriod);
  await sleep(500);

  // 4. 选择申请单位
  console.log('6. 选择申请单位:', opts.companyCode);
  await clickPickerButton('申请单位');
  await sleep(2000);
  await pickFromDict(opts.companyCode);
  await sleep(1000);

  // 5. 选择纳税主体
  console.log('7. 选择纳税主体:', opts.taxCode);
  await pickTaxSubject(opts.taxCode);
  await sleep(1000);

  // 6. 设置税种类型（如有）
  if (opts.taxType && opts.taxType !== '全部') {
    console.log('8. 设置税种类型:', opts.taxType);
    await cdpEvaluateAndClick(`
      (function() {
        var all = document.querySelectorAll('*');
        var labelEl = null;
        for (var i = 0; i < all.length; i++) {
          var text = all[i].textContent.trim();
          if (text === '税种' || text === '税种：' || text === '完税类型' || text === '完税类型：') {
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

    await cdpEvaluateAndClick(`
      (function() {
        var allDivs = document.querySelectorAll('div');
        var options = Array.from(allDivs).filter(function(el) {
          return el.textContent.trim() === '${opts.taxType}';
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
  }

  // 7. 点击查询按钮
  console.log('9. 点击查询按钮...');
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

  if (opts.queryOnly) {
    const rows = await getTableRowCount();
    console.log('查询完成，表格行数:', rows.visible);
    return { queried: true, rows, options: opts };
  }

  // 8. 点击导出按钮
  console.log('10. 点击导出按钮...');
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

  // 9. 点击弹窗中的导出按钮
  console.log('11. 点击弹窗确认导出...');
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

  const popupCheck = await cdpEvaluate(`document.querySelector('.FD26IYC-a-g') ? 'exists' : 'closed'`);

  if (popupCheck === 'closed') {
    console.log('导出完成！');
    await closeBill();
    return { exported: true, options: opts };
  }

  throw new Error('导出流程未完成');
}

module.exports = { exportTaxPaidLedger };
```

- [ ] **Step 2: 在 `lib/fip.js` 中注册**

```javascript
const taxPaid = require('./ledgers/tax-paid');

module.exports = {
  // ... existing exports
  exportTaxPaidLedger: taxPaid.exportTaxPaidLedger,
};
```

- [ ] **Step 3: 在 `bin/fip-cli.js` 中注册 CLI 命令**

```javascript
program
  .command('export-tax-paid')
  .description('完税确认台账查询导出（完整流程）')
  .option('--start-period <period>', '起始税期 (YYYY-MM)', cfg.startPeriod)
  .option('--end-period <period>', '截止税期 (YYYY-MM)', cfg.endPeriod)
  .option('--company-code <code>', '申请单位编码', cfg.companyCode)
  .option('--tax-code <code>', '纳税主体税号', cfg.taxCode)
  .option('--tax-type <type>', '税种类型 (全部/增值税/企业所得税等)', cfg.taxType)
  .option('--query-only', '仅查询不导出', false)
  .action(async (options) => {
    try {
      const result = await fip.exportTaxPaidLedger({
        startPeriod: options.startPeriod,
        endPeriod: options.endPeriod,
        companyCode: options.companyCode,
        taxCode: options.taxCode,
        taxType: options.taxType,
        queryOnly: options.queryOnly
      });
      success(result);
    } catch (e) {
      error('export_tax_paid_error', e.message);
    }
  });
```

- [ ] **Step 4: 测试验证**

Run: `fip-cli export-tax-paid --query-only --start-period 2026-04 --end-period 2026-04`
Expected: JSON with `{ queried: true, rows: { total, visible } }`

- [ ] **Step 5: Commit**

```bash
git add lib/ledgers/tax-paid.js lib/fip.js bin/fip-cli.js
git commit -m "feat: add tax paid ledger export command"
```

---

## Task 3: 税金计提台账 (`lib/ledgers/tax-accrual.js`)

**背景:** 手册"税金计提 → 税金计提台账"模块。查询条件：税期范围、申请单位、纳税主体、计提状态。与完税确认台账结构高度相似。

**Files:**
- Create: `lib/ledgers/tax-accrual.js`
- Modify: `lib/fip.js`
- Modify: `bin/fip-cli.js`

- [ ] **Step 1: 创建 ledger 文件**

```javascript
// lib/ledgers/tax-accrual.js
const {
  sleep, getTableRowCount, openSideMenu, clickDrawerItem,
  clickShowQuery, setTaxPeriod, clickPickerButton,
  pickFromDict, pickTaxSubject, closeBill,
  cdpEvaluateAndClick, cdpEvaluate
} = require('../utils/index');
const config = require('../config');

async function exportTaxAccrualLedger(options = {}) {
  const cfg = config.get();
  const defaults = {
    startPeriod: cfg.startPeriod || '2026-04',
    endPeriod: cfg.endPeriod || '2026-04',
    companyCode: cfg.companyCode || '1000200020040011',
    taxCode: cfg.taxCode || '91110000101107173B',
    accrualStatus: cfg.accrualStatus || '全部',
    queryOnly: false
  };
  const opts = { ...defaults, ...options };

  if (opts.queryOnly) {
    console.log('开始税金计提台账查询...');
  } else {
    console.log('开始税金计提台账查询导出...');
  }

  // 1. 导航
  console.log('1. 打开税务系统菜单...');
  await openSideMenu('税务系统');
  await sleep(1000);

  console.log('2. 点击税金计提...');
  await clickDrawerItem('税金计提');
  await sleep(1000);

  console.log('3. 点击税金计提台账...');
  await clickDrawerItem('税金计提台账');
  await sleep(2000);

  // 2. 展开查询
  console.log('4. 展开查询表单...');
  await clickShowQuery();
  await sleep(1000);

  // 3. 设置所属税期
  console.log('5. 设置所属税期:', opts.startPeriod, '至', opts.endPeriod);
  await setTaxPeriod(opts.startPeriod, opts.endPeriod);
  await sleep(500);

  // 4. 选择申请单位
  console.log('6. 选择申请单位:', opts.companyCode);
  await clickPickerButton('申请单位');
  await sleep(2000);
  await pickFromDict(opts.companyCode);
  await sleep(1000);

  // 5. 选择纳税主体
  console.log('7. 选择纳税主体:', opts.taxCode);
  await pickTaxSubject(opts.taxCode);
  await sleep(1000);

  // 6. 设置计提状态（如有）
  if (opts.accrualStatus && opts.accrualStatus !== '全部') {
    console.log('8. 设置计提状态:', opts.accrualStatus);
    await cdpEvaluateAndClick(`
      (function() {
        var all = document.querySelectorAll('*');
        var labelEl = null;
        for (var i = 0; i < all.length; i++) {
          var text = all[i].textContent.trim();
          if (text === '计提状态' || text === '计提状态：' || text === '状态' || text === '状态：') {
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

    await cdpEvaluateAndClick(`
      (function() {
        var allDivs = document.querySelectorAll('div');
        var options = Array.from(allDivs).filter(function(el) {
          return el.textContent.trim() === '${opts.accrualStatus}';
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
  }

  // 7. 点击查询按钮
  console.log('9. 点击查询按钮...');
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

  if (opts.queryOnly) {
    const rows = await getTableRowCount();
    console.log('查询完成，表格行数:', rows.visible);
    return { queried: true, rows, options: opts };
  }

  // 8. 点击导出按钮
  console.log('10. 点击导出按钮...');
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

  // 9. 点击弹窗中的导出按钮
  console.log('11. 点击弹窗确认导出...');
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

  const popupCheck = await cdpEvaluate(`document.querySelector('.FD26IYC-a-g') ? 'exists' : 'closed'`);

  if (popupCheck === 'closed') {
    console.log('导出完成！');
    await closeBill();
    return { exported: true, options: opts };
  }

  throw new Error('导出流程未完成');
}

module.exports = { exportTaxAccrualLedger };
```

- [ ] **Step 2: 在 `lib/fip.js` 中注册**

```javascript
const taxAccrual = require('./ledgers/tax-accrual');

module.exports = {
  // ... existing exports
  exportTaxAccrualLedger: taxAccrual.exportTaxAccrualLedger,
};
```

- [ ] **Step 3: 在 `bin/fip-cli.js` 中注册 CLI 命令**

```javascript
program
  .command('export-tax-accrual')
  .description('税金计提台账查询导出（完整流程）')
  .option('--start-period <period>', '起始税期 (YYYY-MM)', cfg.startPeriod)
  .option('--end-period <period>', '截止税期 (YYYY-MM)', cfg.endPeriod)
  .option('--company-code <code>', '申请单位编码', cfg.companyCode)
  .option('--tax-code <code>', '纳税主体税号', cfg.taxCode)
  .option('--accrual-status <status>', '计提状态 (全部/已计提/未计提)', cfg.accrualStatus)
  .option('--query-only', '仅查询不导出', false)
  .action(async (options) => {
    try {
      const result = await fip.exportTaxAccrualLedger({
        startPeriod: options.startPeriod,
        endPeriod: options.endPeriod,
        companyCode: options.companyCode,
        taxCode: options.taxCode,
        accrualStatus: options.accrualStatus,
        queryOnly: options.queryOnly
      });
      success(result);
    } catch (e) {
      error('export_tax_accrual_error', e.message);
    }
  });
```

- [ ] **Step 4: 测试验证**

Run: `fip-cli export-tax-accrual --query-only --start-period 2026-04 --end-period 2026-04`
Expected: JSON with `{ queried: true, rows: { total, visible } }`

- [ ] **Step 5: Commit**

```bash
git add lib/ledgers/tax-accrual.js lib/fip.js bin/fip-cli.js
git commit -m "feat: add tax accrual ledger export command"
```

---

## Task 4: 增值税清算底稿 (`lib/ledgers/vat-clearance.js`)

**背景:** 手册"增值税清算 → 增值税清算底稿"模块。该模块为向导式多步骤表单，不是简单列表。但手册显示有"底稿查询"功能，可以查看历史清算底稿列表。我们先实现列表查询导出，后续再扩展向导填报。

**Files:**
- Create: `lib/ledgers/vat-clearance.js`
- Modify: `lib/fip.js`
- Modify: `bin/fip-cli.js`

- [ ] **Step 1: 创建 ledger 文件**

```javascript
// lib/ledgers/vat-clearance.js
const {
  sleep, getTableRowCount, openSideMenu, clickDrawerItem,
  clickShowQuery, setTaxPeriod, clickPickerButton,
  pickFromDict, pickTaxSubject, closeBill,
  cdpEvaluateAndClick, cdpEvaluate
} = require('../utils/index');
const config = require('../config');

async function exportVatClearanceLedger(options = {}) {
  const cfg = config.get();
  const defaults = {
    startPeriod: cfg.startPeriod || '2026-04',
    endPeriod: cfg.endPeriod || '2026-04',
    companyCode: cfg.companyCode || '1000200020040011',
    taxCode: cfg.taxCode || '91110000101107173B',
    clearanceStatus: cfg.clearanceStatus || '全部',
    queryOnly: false
  };
  const opts = { ...defaults, ...options };

  if (opts.queryOnly) {
    console.log('开始增值税清算底稿查询...');
  } else {
    console.log('开始增值税清算底稿查询导出...');
  }

  // 1. 导航
  console.log('1. 打开税务系统菜单...');
  await openSideMenu('税务系统');
  await sleep(1000);

  console.log('2. 点击增值税清算...');
  await clickDrawerItem('增值税清算');
  await sleep(1000);

  console.log('3. 点击增值税清算底稿...');
  await clickDrawerItem('增值税清算底稿');
  await sleep(2000);

  // 2. 展开查询
  console.log('4. 展开查询表单...');
  await clickShowQuery();
  await sleep(1000);

  // 3. 设置所属税期
  console.log('5. 设置所属税期:', opts.startPeriod, '至', opts.endPeriod);
  await setTaxPeriod(opts.startPeriod, opts.endPeriod);
  await sleep(500);

  // 4. 选择申请单位
  console.log('6. 选择申请单位:', opts.companyCode);
  await clickPickerButton('申请单位');
  await sleep(2000);
  await pickFromDict(opts.companyCode);
  await sleep(1000);

  // 5. 选择纳税主体
  console.log('7. 选择纳税主体:', opts.taxCode);
  await pickTaxSubject(opts.taxCode);
  await sleep(1000);

  // 6. 设置清算状态（如有）
  if (opts.clearanceStatus && opts.clearanceStatus !== '全部') {
    console.log('8. 设置清算状态:', opts.clearanceStatus);
    await cdpEvaluateAndClick(`
      (function() {
        var all = document.querySelectorAll('*');
        var labelEl = null;
        for (var i = 0; i < all.length; i++) {
          var text = all[i].textContent.trim();
          if (text === '清算状态' || text === '清算状态：' || text === '状态' || text === '状态：') {
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

    await cdpEvaluateAndClick(`
      (function() {
        var allDivs = document.querySelectorAll('div');
        var options = Array.from(allDivs).filter(function(el) {
          return el.textContent.trim() === '${opts.clearanceStatus}';
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
  }

  // 7. 点击查询按钮
  console.log('9. 点击查询按钮...');
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

  if (opts.queryOnly) {
    const rows = await getTableRowCount();
    console.log('查询完成，表格行数:', rows.visible);
    return { queried: true, rows, options: opts };
  }

  // 8. 点击导出按钮
  console.log('10. 点击导出按钮...');
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

  // 9. 点击弹窗中的导出按钮
  console.log('11. 点击弹窗确认导出...');
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

  const popupCheck = await cdpEvaluate(`document.querySelector('.FD26IYC-a-g') ? 'exists' : 'closed'`);

  if (popupCheck === 'closed') {
    console.log('导出完成！');
    await closeBill();
    return { exported: true, options: opts };
  }

  throw new Error('导出流程未完成');
}

module.exports = { exportVatClearanceLedger };
```

- [ ] **Step 2: 在 `lib/fip.js` 中注册**

```javascript
const vatClearance = require('./ledgers/vat-clearance');

module.exports = {
  // ... existing exports
  exportVatClearanceLedger: vatClearance.exportVatClearanceLedger,
};
```

- [ ] **Step 3: 在 `bin/fip-cli.js` 中注册 CLI 命令**

```javascript
program
  .command('export-vat-clearance')
  .description('增值税清算底稿查询导出（完整流程）')
  .option('--start-period <period>', '起始税期 (YYYY-MM)', cfg.startPeriod)
  .option('--end-period <period>', '截止税期 (YYYY-MM)', cfg.endPeriod)
  .option('--company-code <code>', '申请单位编码', cfg.companyCode)
  .option('--tax-code <code>', '纳税主体税号', cfg.taxCode)
  .option('--clearance-status <status>', '清算状态 (全部/已清算/清算中/未清算)', cfg.clearanceStatus)
  .option('--query-only', '仅查询不导出', false)
  .action(async (options) => {
    try {
      const result = await fip.exportVatClearanceLedger({
        startPeriod: options.startPeriod,
        endPeriod: options.endPeriod,
        companyCode: options.companyCode,
        taxCode: options.taxCode,
        clearanceStatus: options.clearanceStatus,
        queryOnly: options.queryOnly
      });
      success(result);
    } catch (e) {
      error('export_vat_clearance_error', e.message);
    }
  });
```

- [ ] **Step 4: 测试验证**

Run: `fip-cli export-vat-clearance --query-only --start-period 2026-04 --end-period 2026-04`
Expected: JSON with `{ queried: true, rows: { total, visible } }`

- [ ] **Step 5: Commit**

```bash
git add lib/ledgers/vat-clearance.js lib/fip.js bin/fip-cli.js
git commit -m "feat: add VAT clearance ledger export command"
```

---

## Task 5: 企业所得税分配台账 (`lib/ledgers/income-tax-allocation.js`)

**背景:** 手册"所得税分配 → 企业所得税分配台账"模块。查询条件：税期范围、申请单位、纳税主体。该模块通常用于总分机构间的所得税分配计算结果查询。

**Files:**
- Create: `lib/ledgers/income-tax-allocation.js`
- Modify: `lib/fip.js`
- Modify: `bin/fip-cli.js`

- [ ] **Step 1: 创建 ledger 文件**

```javascript
// lib/ledgers/income-tax-allocation.js
const {
  sleep, getTableRowCount, openSideMenu, clickDrawerItem,
  clickShowQuery, setTaxPeriod, clickPickerButton,
  pickFromDict, pickTaxSubject, closeBill,
  cdpEvaluateAndClick, cdpEvaluate
} = require('../utils/index');
const config = require('../config');

async function exportIncomeTaxAllocationLedger(options = {}) {
  const cfg = config.get();
  const defaults = {
    startPeriod: cfg.startPeriod || '2026-04',
    endPeriod: cfg.endPeriod || '2026-04',
    companyCode: cfg.companyCode || '1000200020040011',
    taxCode: cfg.taxCode || '91110000101107173B',
    allocationStatus: cfg.allocationStatus || '全部',
    queryOnly: false
  };
  const opts = { ...defaults, ...options };

  if (opts.queryOnly) {
    console.log('开始企业所得税分配台账查询...');
  } else {
    console.log('开始企业所得税分配台账查询导出...');
  }

  // 1. 导航
  console.log('1. 打开税务系统菜单...');
  await openSideMenu('税务系统');
  await sleep(1000);

  console.log('2. 点击所得税分配...');
  await clickDrawerItem('所得税分配');
  await sleep(1000);

  console.log('3. 点击企业所得税分配台账...');
  await clickDrawerItem('企业所得税分配台账');
  await sleep(2000);

  // 2. 展开查询
  console.log('4. 展开查询表单...');
  await clickShowQuery();
  await sleep(1000);

  // 3. 设置所属税期
  console.log('5. 设置所属税期:', opts.startPeriod, '至', opts.endPeriod);
  await setTaxPeriod(opts.startPeriod, opts.endPeriod);
  await sleep(500);

  // 4. 选择申请单位
  console.log('6. 选择申请单位:', opts.companyCode);
  await clickPickerButton('申请单位');
  await sleep(2000);
  await pickFromDict(opts.companyCode);
  await sleep(1000);

  // 5. 选择纳税主体
  console.log('7. 选择纳税主体:', opts.taxCode);
  await pickTaxSubject(opts.taxCode);
  await sleep(1000);

  // 6. 设置分配状态（如有）
  if (opts.allocationStatus && opts.allocationStatus !== '全部') {
    console.log('8. 设置分配状态:', opts.allocationStatus);
    await cdpEvaluateAndClick(`
      (function() {
        var all = document.querySelectorAll('*');
        var labelEl = null;
        for (var i = 0; i < all.length; i++) {
          var text = all[i].textContent.trim();
          if (text === '分配状态' || text === '分配状态：' || text === '状态' || text === '状态：') {
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

    await cdpEvaluateAndClick(`
      (function() {
        var allDivs = document.querySelectorAll('div');
        var options = Array.from(allDivs).filter(function(el) {
          return el.textContent.trim() === '${opts.allocationStatus}';
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
  }

  // 7. 点击查询按钮
  console.log('9. 点击查询按钮...');
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

  if (opts.queryOnly) {
    const rows = await getTableRowCount();
    console.log('查询完成，表格行数:', rows.visible);
    return { queried: true, rows, options: opts };
  }

  // 8. 点击导出按钮
  console.log('10. 点击导出按钮...');
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

  // 9. 点击弹窗中的导出按钮
  console.log('11. 点击弹窗确认导出...');
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

  const popupCheck = await cdpEvaluate(`document.querySelector('.FD26IYC-a-g') ? 'exists' : 'closed'`);

  if (popupCheck === 'closed') {
    console.log('导出完成！');
    await closeBill();
    return { exported: true, options: opts };
  }

  throw new Error('导出流程未完成');
}

module.exports = { exportIncomeTaxAllocationLedger };
```

- [ ] **Step 2: 在 `lib/fip.js` 中注册**

```javascript
const incomeTaxAllocation = require('./ledgers/income-tax-allocation');

module.exports = {
  // ... existing exports
  exportIncomeTaxAllocationLedger: incomeTaxAllocation.exportIncomeTaxAllocationLedger,
};
```

- [ ] **Step 3: 在 `bin/fip-cli.js` 中注册 CLI 命令**

```javascript
program
  .command('export-income-tax-allocation')
  .description('企业所得税分配台账查询导出（完整流程）')
  .option('--start-period <period>', '起始税期 (YYYY-MM)', cfg.startPeriod)
  .option('--end-period <period>', '截止税期 (YYYY-MM)', cfg.endPeriod)
  .option('--company-code <code>', '申请单位编码', cfg.companyCode)
  .option('--tax-code <code>', '纳税主体税号', cfg.taxCode)
  .option('--allocation-status <status>', '分配状态 (全部/已分配/未分配)', cfg.allocationStatus)
  .option('--query-only', '仅查询不导出', false)
  .action(async (options) => {
    try {
      const result = await fip.exportIncomeTaxAllocationLedger({
        startPeriod: options.startPeriod,
        endPeriod: options.endPeriod,
        companyCode: options.companyCode,
        taxCode: options.taxCode,
        allocationStatus: options.allocationStatus,
        queryOnly: options.queryOnly
      });
      success(result);
    } catch (e) {
      error('export_income_tax_allocation_error', e.message);
    }
  });
```

- [ ] **Step 4: 测试验证**

Run: `fip-cli export-income-tax-allocation --query-only --start-period 2026-04 --end-period 2026-04`
Expected: JSON with `{ queried: true, rows: { total, visible } }`

- [ ] **Step 5: Commit**

```bash
git add lib/ledgers/income-tax-allocation.js lib/fip.js bin/fip-cli.js
git commit -m "feat: add income tax allocation ledger export command"
```

---

## Task 6: 更新 `export-all` 批量命令以包含新台账

**背景:** 现有的 `export-all` 命令只包含 Phase 1 的 5 个台账，需要扩展以支持新台账。

**Files:**
- Modify: `bin/fip-cli.js`

- [ ] **Step 1: 修改 `export-all` 命令的 ledgerMap**

在 `bin/fip-cli.js` 中找到 `export-all` 命令，将 `ledgerMap` 更新为：

```javascript
const ledgerMap = {
  'unbilled': 'exportUnbilledIncomeLedger',
  'input-transfer': 'exportInputTransferLedger',
  'output-invoice': 'exportOutputInvoiceLedger',
  'vat-prepayment': 'exportVatPrepaymentLedger',
  'passenger-transport': 'exportPassengerTransportLedger',
  'invoice-receipt': 'exportInvoiceReceiptLedger',
  'tax-paid': 'exportTaxPaidLedger',
  'tax-accrual': 'exportTaxAccrualLedger',
  'vat-clearance': 'exportVatClearanceLedger',
  'income-tax-allocation': 'exportIncomeTaxAllocationLedger'
};
```

同时将 `--ledgers` 选项的默认值更新为包含全部 10 个：

```javascript
.option('--ledgers <list>', '指定台账（逗号分隔）', 'unbilled,input-transfer,output-invoice,vat-prepayment,passenger-transport,invoice-receipt,tax-paid,tax-accrual,vat-clearance,income-tax-allocation')
```

- [ ] **Step 2: 测试验证**

Run: `fip-cli export-all --query-only --ledgers invoice-receipt,tax-paid`
Expected: JSON with results for only the two specified ledgers

- [ ] **Step 3: Commit**

```bash
git add bin/fip-cli.js
git commit -m "feat: extend export-all to include 5 new phase-3 ledgers"
```

---

## Task 7: 更新 CLI 帮助示例

**背景:** `examples` 命令需要展示新命令的用法。

**Files:**
- Modify: `bin/fip-cli.js`

- [ ] **Step 1: 在 `examples` 命令输出中追加新示例**

在 `examples` 命令的 `console.log` 模板末尾追加：

```
11. 导出发票收票登记单台账
    fip-cli export-invoice-receipt --start-period 2026-04 --end-period 2026-04

12. 导出完税确认台账
    fip-cli export-tax-paid --start-period 2026-04 --end-period 2026-04

13. 导出税金计提台账
    fip-cli export-tax-accrual --start-period 2026-04 --end-period 2026-04

14. 导出增值税清算底稿
    fip-cli export-vat-clearance --start-period 2026-04 --end-period 2026-04

15. 导出企业所得税分配台账
    fip-cli export-income-tax-allocation --start-period 2026-04 --end-period 2026-04
```

- [ ] **Step 2: Commit**

```bash
git add bin/fip-cli.js
git commit -m "docs: update examples command with phase 3 ledger commands"
```

---

## Spec Coverage Check

| 手册模块 | 对应命令 | Task | 状态 |
|---------|---------|------|------|
| 发票收票登记单台账 | `export-invoice-receipt` | Task 1 | ✅ 已规划 |
| 完税确认台账 | `export-tax-paid` | Task 2 | ✅ 已规划 |
| 税金计提台账 | `export-tax-accrual` | Task 3 | ✅ 已规划 |
| 增值税清算底稿 | `export-vat-clearance` | Task 4 | ✅ 已规划 |
| 企业所得税分配台账 | `export-income-tax-allocation` | Task 5 | ✅ 已规划 |
| 批量导出扩展 | `export-all` | Task 6 | ✅ 已规划 |
| 帮助文档更新 | `examples` | Task 7 | ✅ 已规划 |

---

## Self-Review Checklist

**1. Placeholder scan:** 无 TBD、TODO、"implement later"、"similar to Task N"。每个 Task 包含完整代码。

**2. Type consistency:** 所有 ledger 函数签名统一为 `exportXxxLedger(options = {})`，返回统一为 `{ queried: true, rows, options }` 或 `{ exported: true, options }`。CLI 选项命名统一使用 kebab-case。

**3. Spec coverage:** 5 个手册台账模块全部覆盖，批量导出和文档更新已包含。

**4. DRY 检查:** 5 个 ledger 文件结构高度相似，这是有意为之——每个文件独立可测，不引入过早抽象。如后续扩展到 15+ 个 ledger，再考虑提取公共模板。

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-24-fip-cli-phase3-ledgers.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints for review

**Which approach?**
