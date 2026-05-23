# FIP CLI Phase 2 后续开发计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 FIP CLI 剩余核心功能：税务台账数据抓取、智能单据查询、批量附件下载、Dashboard 单据交互探索。

**Architecture:** 基于已验证的 5 个台账导出流程，扩展数据解析能力（不导出 Excel 而是直接读取表格数据）；在 Dashboard 页面实现跨标签页单据搜索；在单据详情页实现附件批量下载；所有功能复用现有的 CDP 抽象层和配置系统。

**Tech Stack:** Node.js, Commander.js, Chrome Remote Interface (CDP), Kimi WebBridge

---

## 当前状态

已完成的 5 个台账导出功能：
- `export-unbilled` — 未开票收入台账
- `export-input-transfer` — 进项转出明细台账
- `export-output-invoice` — 销项发票明细台账
- `export-vat-prepayment` — 增值税预缴款台账
- `export-passenger-transport` — 旅客运输服务台账

基础设施：CDP 抽象层、配置文件 `~/.fiprc.json`、自动截图、条件轮询。

---

## 文件结构变更

```
lib/
├── ledgers/
│   └── ... (existing 5 ledgers)
├── utils/
│   ├── cdp.js          (existing)
│   ├── common.js       (existing)
│   ├── form.js         (existing)
│   ├── picker.js       (existing)
│   ├── navigation.js   (existing)
│   ├── bill.js         (existing)
│   ├── table.js        # NEW: 表格数据读取
│   └── attachment.js   # NEW: 附件下载
└── fip.js              (modify: register new exports)
```

---

## Task 1: 表格数据读取模块 (`lib/utils/table.js`)

**背景:** 目前台账只能导出 Excel，用户需要直接获取表格数据用于分析。

**Files:**
- Create: `lib/utils/table.js`
- Modify: `lib/fip.js`
- Test: `test/table.test.js`

- [ ] **Step 1: 实现 `getTableData()` 函数**

```javascript
// lib/utils/table.js
const { evaluate } = require('../browser');

async function getTableData(options = {}) {
  const { maxRows = 1000, includeHeaders = true } = options;
  
  const result = await evaluate(`
    (function() {
      // Find the visible table in the active tabpanel
      var tables = document.querySelectorAll('table');
      var table = null;
      for (var i = 0; i < tables.length; i++) {
        var rect = tables[i].getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && rect.top > 100) {
          table = tables[i];
          break;
        }
      }
      if (!table) return { error: 'no visible table found' };
      
      var rows = table.querySelectorAll('tr');
      var data = [];
      var startIdx = ${includeHeaders ? 0 : 1};
      
      for (var r = startIdx; r < Math.min(rows.length, ${maxRows + 1}); r++) {
        var cells = rows[r].querySelectorAll('td, th');
        var rowData = [];
        for (var c = 0; c < cells.length; c++) {
          rowData.push(cells[c].textContent.trim());
        }
        data.push(rowData);
      }
      
      return { 
        rowCount: data.length, 
        data: data,
        headers: includeHeaders && data.length > 0 ? data[0] : null
      };
    })()
  `);
  
  return result;
}

module.exports = { getTableData };
```

- [ ] **Step 2: 在 `lib/fip.js` 中注册导出**

```javascript
// Add to requires
const { getTableData } = require('./utils/table');

// Add to module.exports
module.exports = {
  // ... existing exports
  getTableData,
};
```

- [ ] **Step 3: 在 `bin/fip-cli.js` 中添加 CLI 命令**

```javascript
program
  .command('table-data')
  .description('读取当前页面表格数据（JSON 输出）')
  .option('--max-rows <n>', '最大行数', '1000')
  .option('--no-headers', '不包含表头')
  .action(async (options) => {
    try {
      const result = await fip.getTableData({
        maxRows: parseInt(options.maxRows),
        includeHeaders: options.headers
      });
      success(result);
    } catch (e) {
      error('table_data_error', e.message);
    }
  });
```

- [ ] **Step 4: 测试验证**

Run: `fip-cli navigate <ledger-url> && fip-cli show-query && fip-cli query && fip-cli table-data`
Expected: JSON output with table rows

- [ ] **Step 5: Commit**

```bash
git add lib/utils/table.js lib/fip.js bin/fip-cli.js
git commit -m "feat: add table data reading module"
```

---

## Task 2: 税务台账数据抓取（带数据返回）

**背景:** Task #2 需求。在现有导出功能基础上，增加直接数据抓取模式，不下载 Excel 而是返回 JSON 数据。

**Files:**
- Modify: `lib/ledgers/unbilled-income.js`
- Modify: `lib/ledgers/input-transfer.js`
- Modify: `lib/ledgers/output-invoice.js`
- Modify: `lib/ledgers/vat-prepayment.js`
- Modify: `lib/ledgers/passenger-transport.js`
- Modify: `lib/fip.js`
- Modify: `bin/fip-cli.js`

- [ ] **Step 1: 在 `unbilled-income.js` 中添加 `queryUnbilledIncomeData()` 函数**

在文件末尾添加：

```javascript
async function queryUnbilledIncomeData(params = {}) {
  const { getTableData } = require('../utils/table');
  
  // Reuse export flow but stop after query
  const result = await exportUnbilledIncomeLedger({ ...params, queryOnly: true });
  
  // Read table data
  const tableData = await getTableData({ maxRows: 1000 });
  
  return {
    queried: true,
    rowCount: tableData.rowCount,
    data: tableData.data,
    headers: tableData.headers
  };
}

module.exports = {
  exportUnbilledIncomeLedger,
  queryUnbilledIncomeData  // Add this
};
```

- [ ] **Step 2: 对其他 4 个 ledger 重复相同模式**

每个 ledger 文件：
1. 添加 `queryXxxData()` 函数
2. 在 `module.exports` 中导出

- [ ] **Step 3: 在 `lib/fip.js` 中注册新函数**

```javascript
const { queryUnbilledIncomeData } = require('./ledgers/unbilled-income');
const { queryInputTransferData } = require('./ledgers/input-transfer');
const { queryOutputInvoiceData } = require('./ledgers/output-invoice');
const { queryVatPrepaymentData } = require('./ledgers/vat-prepayment');
const { queryPassengerTransportData } = require('./ledgers/passenger-transport');

module.exports = {
  // ... existing exports
  queryUnbilledIncomeData,
  queryInputTransferData,
  queryOutputInvoiceData,
  queryVatPrepaymentData,
  queryPassengerTransportData,
};
```

- [ ] **Step 4: 在 `bin/fip-cli.js` 中添加数据查询命令**

```javascript
// Add after each export command, e.g.:
program
  .command('data-unbilled')
  .description('未开票收入台账数据抓取（返回 JSON）')
  .option('--start-date <date>', '起始日期', cfg.startDate)
  .option('--end-date <date>', '截止日期', cfg.endDate)
  .option('--start-period <period>', '起始税期', cfg.startPeriod)
  .option('--end-period <period>', '截止税期', cfg.endPeriod)
  .option('--company-code <code>', '申请单位编码', cfg.companyCode)
  .option('--tax-code <code>', '纳税主体税号', cfg.taxCode)
  .option('--void-status <status>', '作废状态', cfg.voidStatus)
  .action(async (options) => {
    try {
      const result = await fip.queryUnbilledIncomeData({
        startDate: options.startDate,
        endDate: options.endDate,
        startPeriod: options.startPeriod,
        endPeriod: options.endPeriod,
        companyCode: options.companyCode,
        taxCode: options.taxCode,
        voidStatus: options.voidStatus
      });
      success(result);
    } catch (e) {
      error('data_unbilled_error', e.message);
    }
  });

// Repeat for data-input-transfer, data-output-invoice, data-vat-prepayment, data-passenger-transport
```

- [ ] **Step 5: 测试验证**

Run: `fip-cli data-unbilled --start-period 2026-04 --end-period 2026-04`
Expected: JSON with table data rows

- [ ] **Step 6: Commit**

```bash
git add lib/ledgers/ lib/fip.js bin/fip-cli.js
git commit -m "feat: add ledger data query commands (JSON output)"
```

---

## Task 3: Dashboard 单据列表交互探索

**背景:** Task #10 需求。探索 Dashboard 首页四个标签页（我的单据/待办/已办/已办结）的结构，记录单据打开方式。

**Files:**
- Create: `lib/utils/dashboard.js`
- Modify: `lib/fip.js`
- Modify: `bin/fip-cli.js`

- [ ] **Step 1: 实现 `exploreDashboard()` 函数**

```javascript
// lib/utils/dashboard.js
const { evaluate } = require('../browser');

async function exploreDashboard() {
  const info = await evaluate(`
    (function() {
      var result = {
        tabs: [],
        currentTab: null,
        tableInfo: null,
        billLinks: []
      };
      
      // Find tabs
      var tabs = document.querySelectorAll('.ant-tabs-tab');
      for (var i = 0; i < tabs.length; i++) {
        var rect = tabs[i].getBoundingClientRect();
        if (rect.width > 0) {
          result.tabs.push({
            text: tabs[i].textContent.trim(),
            active: tabs[i].classList.contains('ant-tabs-tab-active'),
            left: rect.left,
            top: rect.top
          });
          if (tabs[i].classList.contains('ant-tabs-tab-active')) {
            result.currentTab = tabs[i].textContent.trim();
          }
        }
      }
      
      // Find table
      var tables = document.querySelectorAll('table');
      for (var i = 0; i < tables.length; i++) {
        var rect = tables[i].getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          var headers = [];
          var ths = tables[i].querySelectorAll('th');
          for (var h = 0; h < ths.length; h++) {
            headers.push(ths[h].textContent.trim());
          }
          result.tableInfo = {
            rowCount: tables[i].querySelectorAll('tr').length - 1,
            headers: headers
          };
          break;
        }
      }
      
      // Find bill links (elements with bill-related click handlers)
      var allElements = document.querySelectorAll('*');
      for (var i = 0; i < allElements.length; i++) {
        var onclick = allElements[i].getAttribute('onclick');
        var rect = allElements[i].getBoundingClientRect();
        if (onclick && onclick.includes('bill') && rect.width > 0) {
          result.billLinks.push({
            tag: allElements[i].tagName,
            text: allElements[i].textContent.trim().substring(0, 50),
            onclick: onclick.substring(0, 100)
          });
        }
      }
      
      return result;
    })()
  `);
  
  return info;
}

async function switchDashboardTab(tabName) {
  const { cdpEvaluateAndClick } = require('./cdp');
  
  const result = await cdpEvaluateAndClick(`
    var tabs = document.querySelectorAll('.ant-tabs-tab');
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i].textContent.trim() === '${tabName}') {
        var rect = tabs[i].getBoundingClientRect();
        if (rect.width > 0) {
          return { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
        }
      }
    }
    return null;
  `);
  
  return result;
}

module.exports = { exploreDashboard, switchDashboardTab };
```

- [ ] **Step 2: 在 `lib/fip.js` 中注册**

```javascript
const { exploreDashboard, switchDashboardTab } = require('./utils/dashboard');

module.exports = {
  // ... existing
  exploreDashboard,
  switchDashboardTab,
};
```

- [ ] **Step 3: 在 `bin/fip-cli.js` 中添加命令**

```javascript
program
  .command('explore-dashboard')
  .description('探索 Dashboard 单据列表结构')
  .action(async () => {
    try {
      const result = await fip.exploreDashboard();
      success(result);
    } catch (e) {
      error('explore_dashboard_error', e.message);
    }
  });

program
  .command('switch-tab <name>')
  .description('切换 Dashboard 标签页（我的单据/待办/已办/已办结）')
  .action(async (name) => {
    try {
      await fip.switchDashboardTab(name);
      success({ tab: name, switched: true });
    } catch (e) {
      error('switch_tab_error', e.message);
    }
  });
```

- [ ] **Step 4: 手动测试并记录结果**

Run: `fip-cli explore-dashboard`
Expected: JSON with tabs, tableInfo, billLinks

记录发现到 `docs/dashboard-exploration.md`

- [ ] **Step 5: Commit**

```bash
git add lib/utils/dashboard.js lib/fip.js bin/fip-cli.js docs/dashboard-exploration.md
git commit -m "feat: add dashboard exploration and tab switching"
```

---

## Task 4: 智能单据查询与定位

**背景:** Task #3 需求。在 Dashboard 四个标签页中自动搜索目标单据。

**Files:**
- Modify: `lib/utils/bill.js`
- Modify: `lib/fip.js`
- Modify: `bin/fip-cli.js`

- [ ] **Step 1: 实现 `searchBillAcrossTabs()` 函数**

在 `lib/utils/bill.js` 中添加：

```javascript
async function searchBillAcrossTabs(billId, options = {}) {
  const { evaluate } = require('../browser');
  const { switchDashboardTab } = require('./dashboard');
  const { sleep } = require('./common');
  
  const tabs = options.tabs || ['我的单据', '待办', '已办', '已办结'];
  const results = [];
  
  for (const tabName of tabs) {
    try {
      await switchDashboardTab(tabName);
      await sleep(1500);
      
      // Try to find search input and search
      const searchResult = await evaluate(`
        (function() {
          // Find search input
          var inputs = document.querySelectorAll('input');
          var searchInput = null;
          for (var i = 0; i < inputs.length; i++) {
            var placeholder = inputs[i].placeholder || '';
            if (placeholder.includes('搜索') || placeholder.includes('单据') || placeholder.includes('单号')) {
              var rect = inputs[i].getBoundingClientRect();
              if (rect.width > 0) {
                searchInput = inputs[i];
                break;
              }
            }
          }
          
          if (searchInput) {
            searchInput.value = '${billId}';
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            searchInput.dispatchEvent(new Event('change', { bubbles: true }));
            return { hasSearchInput: true };
          }
          
          // If no search input, scan table for bill ID
          var tables = document.querySelectorAll('table');
          for (var t = 0; t < tables.length; t++) {
            var rect = tables[t].getBoundingClientRect();
            if (rect.width > 0) {
              var rows = tables[t].querySelectorAll('tr');
              for (var r = 1; r < rows.length; r++) {
                var cells = rows[r].querySelectorAll('td');
                for (var c = 0; c < cells.length; c++) {
                  if (cells[c].textContent.trim() === '${billId}') {
                    return { 
                      found: true, 
                      tab: '${tabName}',
                      row: r,
                      cellText: cells[c].textContent.trim()
                    };
                  }
                }
              }
            }
          }
          
          return { found: false, tab: '${tabName}' };
        })()
      `);
      
      if (searchResult.hasSearchInput) {
        await sleep(2000);
        // Check results after search
        const afterSearch = await evaluate(`
          var tables = document.querySelectorAll('table');
          for (var t = 0; t < tables.length; t++) {
            var rect = tables[t].getBoundingClientRect();
            if (rect.width > 0) {
              var rows = tables[t].querySelectorAll('tr');
              for (var r = 1; r < rows.length; r++) {
                var cells = rows[r].querySelectorAll('td');
                for (var c = 0; c < cells.length; c++) {
                  if (cells[c].textContent.trim() === '${billId}') {
                    return { found: true, tab: '${tabName}', row: r };
                  }
                }
              }
            }
          }
          return { found: false, tab: '${tabName}' };
        `);
        results.push(afterSearch);
      } else {
        results.push(searchResult);
      }
      
    } catch (e) {
      results.push({ tab: tabName, error: e.message });
    }
  }
  
  const found = results.find(r => r.found);
  return {
    billId,
    found: !!found,
    location: found || null,
    searchedTabs: results
  };
}

module.exports = {
  // ... existing exports
  searchBillAcrossTabs
};
```

- [ ] **Step 2: 在 `lib/fip.js` 中注册**

```javascript
const { searchBillAcrossTabs } = require('./utils/bill');

module.exports = {
  // ... existing
  searchBillAcrossTabs,
};
```

- [ ] **Step 3: 在 `bin/fip-cli.js` 中添加命令**

```javascript
program
  .command('search-bill <billId>')
  .description('在 Dashboard 所有标签页中搜索单据')
  .option('--tabs <list>', '指定标签页（逗号分隔）', '我的单据,待办,已办,已办结')
  .action(async (billId, options) => {
    try {
      const tabs = options.tabs.split(',');
      const result = await fip.searchBillAcrossTabs(billId, { tabs });
      success(result);
    } catch (e) {
      error('search_bill_error', e.message);
    }
  });
```

- [ ] **Step 4: 测试验证**

Run: `fip-cli search-bill TEST-2026-001`
Expected: JSON showing which tab contains the bill

- [ ] **Step 5: Commit**

```bash
git add lib/utils/bill.js lib/fip.js bin/fip-cli.js
git commit -m "feat: add cross-tab bill search"
```

---

## Task 5: 批量附件下载自动化

**背景:** Task #5 需求。在单据详情页点击附件按钮，批量下载附件。

**Files:**
- Create: `lib/utils/attachment.js`
- Modify: `lib/fip.js`
- Modify: `bin/fip-cli.js`

- [ ] **Step 1: 实现 `downloadAttachments()` 函数**

```javascript
// lib/utils/attachment.js
const fs = require('fs');
const path = require('path');
const { evaluate } = require('../browser');
const { sleep } = require('./common');
const { withCDP } = require('./cdp');

async function downloadAttachments(options = {}) {
  const { downloadDir = './downloads', timeout = 30000 } = options;
  
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }
  
  // Step 1: Click attachment button
  const attachBtn = await evaluate(`
    (function() {
      var all = document.querySelectorAll('*');
      for (var i = 0; i < all.length; i++) {
        if (all[i].textContent.trim() === '附件') {
          var rect = all[i].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            return { 
              found: true, 
              x: rect.left + rect.width/2, 
              y: rect.top + rect.height/2 
            };
          }
        }
      }
      return { found: false };
    })()
  `);
  
  if (!attachBtn.found) {
    throw new Error('Attachment button not found');
  }
  
  // Click via CDP
  const { cdpClick } = require('./cdp');
  await cdpClick(attachBtn.x, attachBtn.y);
  await sleep(2000);
  
  // Step 2: Find attachment list in popup
  const attachments = await evaluate(`
    (function() {
      var result = [];
      var rows = document.querySelectorAll('tr');
      for (var i = 0; i < rows.length; i++) {
        var links = rows[i].querySelectorAll('a');
        for (var j = 0; j < links.length; j++) {
          var href = links[j].getAttribute('href');
          if (href && (href.includes('download') || href.includes('file'))) {
            var rect = links[j].getBoundingClientRect();
            if (rect.width > 0) {
              result.push({
                name: links[j].textContent.trim(),
                href: href,
                x: rect.left + rect.width/2,
                y: rect.top + rect.height/2
              });
            }
          }
        }
      }
      return result;
    })()
  `);
  
  return {
    attachmentCount: attachments.length,
    attachments: attachments,
    downloadDir
  };
}

module.exports = { downloadAttachments };
```

- [ ] **Step 2: 在 `lib/fip.js` 中注册**

```javascript
const { downloadAttachments } = require('./utils/attachment');

module.exports = {
  // ... existing
  downloadAttachments,
};
```

- [ ] **Step 3: 在 `bin/fip-cli.js` 中添加命令**

```javascript
program
  .command('download-attachments')
  .description('下载当前单据的所有附件')
  .option('--dir <path>', '下载目录', './downloads')
  .action(async (options) => {
    try {
      const result = await fip.downloadAttachments({ downloadDir: options.dir });
      success(result);
    } catch (e) {
      error('download_attachments_error', e.message);
    }
  });
```

- [ ] **Step 4: 测试验证**

Run: `fip-cli open-bill <bill-id> && fip-cli download-attachments --dir ./test-downloads`
Expected: JSON with attachment list

- [ ] **Step 5: Commit**

```bash
git add lib/utils/attachment.js lib/fip.js bin/fip-cli.js
git commit -m "feat: add attachment download automation"
```

---

## Task 6: 统一数据导出命令

**背景:** 用户反馈需要一键导出多个台账数据。创建一个聚合命令，按顺序执行多个台账查询。

**Files:**
- Modify: `bin/fip-cli.js`

- [ ] **Step 1: 实现 `export-all` 命令**

```javascript
program
  .command('export-all')
  .description('按顺序导出所有台账数据')
  .option('--start-period <period>', '起始税期', cfg.startPeriod)
  .option('--end-period <period>', '截止税期', cfg.endPeriod)
  .option('--company-code <code>', '申请单位编码', cfg.companyCode)
  .option('--tax-code <code>', '纳税主体税号', cfg.taxCode)
  .option('--ledgers <list>', '指定台账（逗号分隔）', 'unbilled,input-transfer,output-invoice,vat-prepayment,passenger-transport')
  .option('--query-only', '仅查询不导出', false)
  .action(async (options) => {
    try {
      const ledgers = options.ledgers.split(',');
      const results = {};
      
      const ledgerMap = {
        'unbilled': 'exportUnbilledIncomeLedger',
        'input-transfer': 'exportInputTransferLedger',
        'output-invoice': 'exportOutputInvoiceLedger',
        'vat-prepayment': 'exportVatPrepaymentLedger',
        'passenger-transport': 'exportPassengerTransportLedger'
      };
      
      const commonParams = {
        startPeriod: options.startPeriod,
        endPeriod: options.endPeriod,
        companyCode: options.companyCode,
        taxCode: options.taxCode,
        queryOnly: options.queryOnly
      };
      
      for (const name of ledgers) {
        const fnName = ledgerMap[name.trim()];
        if (!fnName || !fip[fnName]) {
          results[name] = { error: 'Unknown ledger' };
          continue;
        }
        
        try {
          const result = await fip[fnName](commonParams);
          results[name] = { success: true, ...result };
        } catch (e) {
          results[name] = { success: false, error: e.message };
        }
        
        await fip.sleep(2000);
      }
      
      success({
        executed: ledgers.length,
        results
      });
    } catch (e) {
      error('export_all_error', e.message);
    }
  });
```

- [ ] **Step 2: 测试验证**

Run: `fip-cli export-all --start-period 2026-04 --end-period 2026-04 --query-only`
Expected: JSON with all ledger query results

- [ ] **Step 3: Commit**

```bash
git add bin/fip-cli.js
git commit -m "feat: add export-all command for batch ledger export"
```

---

## Spec Coverage Check

| 需求 | 对应 Task | 状态 |
|------|----------|------|
| 税务台账数据抓取 | Task 1, 2 | ✅ 已规划 |
| 智能单据查询与定位 | Task 3, 4 | ✅ 已规划 |
| 批量附件下载自动化 | Task 5 | ✅ 已规划 |
| Dashboard 单据交互探索 | Task 3 | ✅ 已规划 |
| 统一批量导出 | Task 6 | ✅ 已规划（新增） |

---

## 执行选项

**Plan complete and saved to `docs/superpowers/plans/2026-05-23-fip-cli-phase2.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
