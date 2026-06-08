# 开票单智能审核自动化

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 FIP CLI 中实现开票单信息自动搜集与智能核对功能，支持从 FIP 门户单据详情页提取字段、执行 6 项自动审核规则、生成审核报告。

**Architecture:** 新增 `lib/audit/` 模块：
- `extractor.js` — 使用 CDP evaluate 从开票单详情页 DOM 提取字段（复用现有 browser.evaluate）
- `engine.js` — 审核引擎，实现 6 项自动核对规则（移植自 invoice-auditor 的 Python 逻辑）
- `reporter.js` — 报告生成器，输出文本/JSON 格式审核报告
- CLI 层新增 `audit-invoice` 命令，支持 `--bill-id` 或当前页面模式

**Tech Stack:** Node.js, CDP (Chrome DevTools Protocol), 纯 JS 实现（不依赖 Python/OCR）

---

## 当前状态

已有基础设施：
- `open-bill <billId>` — 在 Dashboard 搜索并打开单据详情页
- `close-bill` — 关闭单据返回 Dashboard
- `evaluate(code)` — CDP JS 执行器
- `screenshot()` — 页面截图

invoice-auditor 项目（已分析）提供了完整的审核规则和业务逻辑参考，但使用 Python + Playwright + PaddleOCR。本计划将其核心规则移植到 Node.js，去掉 OCR 依赖（FIP CLI 直接操作浏览器 DOM）。

---

## 文件结构变更

```
lib/
├── audit/
│   ├── extractor.js          # NEW: DOM 字段提取器
│   ├── engine.js             # NEW: 审核引擎（6项规则）
│   ├── reporter.js           # NEW: 报告生成器
│   └── rules.json            # NEW: 审核规则配置
├── utils/
│   └── ... (existing)
├── ledgers/
│   └── ... (existing)
└── fip.js                    # MODIFY: register new exports

bin/
└── fip-cli.js                # MODIFY: add audit-invoice command
```

---

## Task 1: 开票单 DOM 字段提取器 (`lib/audit/extractor.js`)

**背景:** 从 FIP 开票单详情页提取审核所需字段。invoice-auditor 的 `fip_dom_extractor.py` 已实现 Playwright 版本，我们改用 CDP evaluate。

**Files:**
- Create: `lib/audit/extractor.js`
- Test: 手动在 FIP 门户测试

- [ ] **Step 1: 实现 `extractInvoiceFields()` 函数**

```javascript
// lib/audit/extractor.js
const { evaluate } = require('../browser');

/**
 * 从 FIP 开票单详情页提取字段
 * @returns {Promise<Object>} 提取的字段字典
 */
async function extractInvoiceFields() {
  const code = `
    (function() {
      const result = {};
      const pageText = document.body.innerText || '';

      // 正则模式匹配（与 invoice-auditor 一致）
      const patterns = {
        invoice_no: /申请单号[：:]\\s*(KP\\d{20})/,
        invoice_date: /申请日期[：:]\\s*(\\d{4}-\\d{2}-\\d{2})/,
        profit_center: /利润中心[：:]\\s*(L\\d{10})/,
        project_name: /项目名称[：:]\\s*(.+?)(?:\\n|\\r|\\t|  +|$)/,
        project_code: /项目编号[：:]\\s*(\\S+)/,
        buyer_name: /购买方名称[：:]\\s*(.+?)(?:\\n|\\r|\\t|  +|$)/,
        buyer_tax_no: /纳税人识别号[：:]\\s*([A-Z0-9]{18})/,
        buyer_address: /地址、电话[：:]\\s*(.+?)(?:\\n|\\r|\\t|  +|$)/,
        buyer_bank: /开户行及账号[：:]\\s*(.+?)(?:\\n|\\r|\\t|  +|$)/,
        seller_name: /销售方名称[：:]\\s*(.+?)(?:\\n|\\r|\\t|  +|$)/,
        seller_tax_no: /销售方纳税人识别号[：:]\\s*([A-Z0-9]{18})/,
        contract_no: /合同编号[：:]\\s*(\\S+)/,
        contract_name: /合同名称[：:]\\s*(.+?)(?:\\n|\\r|\\t|  +|$)/,
        contract_amount: /合同总金额[：:]?[\\s¥]*([\\d,\\.]+)/,
        invoiced_amount: /已开票总金额[：:]?[\\s¥]*([\\d,\\.]+)/,
        received_amount: /已收款总金额[：:]?[\\s¥]*([\\d,\\.]+)/,
        current_amount: /本次开票金额[：:]?[\\s¥]*([\\d,\\.]+)/,
        unpaid_amount: /已申请未开票金额[：:]?[\\s¥]*([\\d,\\.]+)/,
        confirmed_amount: /累计确权额[：:]?[\\s¥]*([\\d,\\.]+)/,
        settled_amount: /已结算总金额[：:]?[\\s¥]*([\\d,\\.]+)/,
        settled_uninvoiced: /已结算未开票金额[：:]?[\\s¥]*([\\d,\\.]+)/,
        service_location: /建筑服务发生地[：:]\\s*(.+?)(?:\\n|\\r|\\t|  +|$)/,
        tax_rate: /税率[：:]\\s*(\\d+%)/,
        amount_without_tax: /金额[（(]不含税[)）][：:]?[\\s¥]*([\\d,\\.]+)/,
        tax_amount: /税额[：:]?[\\s¥]*([\\d,\\.]+)/,
        total_amount: /价税合计[：:]?[\\s¥]*([\\d,\\.]+)/,
        external_cert_no: /跨区域涉税事项报告管理编号[：:]\\s*(.+?)(?:\\n|\\r|\\t|  +|$)/,
        external_cert_valid: /报告有效期[：:]\\s*(.+?)(?:\\n|\\r|\\t|  +|$)/,
        tax_approver: /税务主管[：:]\\s*(.+?)(?:\\n|\\r|\\t|  +|$)/,
        submitter: /提交人[：:]\\s*(.+?)(?:\\n|\\r|\\t|  +|$)/,
        submit_dept: /提交部门[：:]\\s*(.+?)(?:\\n|\\r|\\t|  +|$)/,
      };

      for (const [key, pattern] of Object.entries(patterns)) {
        const match = pageText.match(pattern);
        if (match) {
          result[key] = match[1].trim();
        }
      }

      // 提取开票备注（textarea）
      const textareas = document.querySelectorAll('textarea');
      for (const ta of textareas) {
        const text = ta.value || ta.textContent || '';
        if (text.includes('工程名称') && text.includes('工程地址')) {
          result.invoice_remark = text.trim();
          break;
        }
      }

      // 提取附件列表
      const attachments = [];
      const allElements = document.querySelectorAll('*');
      const seen = new Set();
      for (const el of allElements) {
        const text = el.textContent || '';
        const match = text.match(/[^\\/\\n]+\\.(pdf|png|jpg|jpeg|doc|docx)/i);
        if (match && !seen.has(match[0])) {
          seen.add(match[0]);
          attachments.push(match[0]);
        }
      }
      result.attachments = attachments;

      // 标记是否异地项目
      result.is_external_project = pageText.includes('跨区域涉税事项报告') ||
                                    pageText.includes('外经证') ||
                                    (result.external_cert_no ? true : false);

      // 原始文本（用于调试）
      result._raw_text_length = pageText.length;

      return result;
    })()
  `;

  const result = await evaluate(code);
  return result.data?.value || {};
}

/**
 * 从 input 元素提取字段（备用方法）
 */
async function extractFromInputs() {
  const code = `
    (function() {
      const result = {};
      const inputs = document.querySelectorAll('input[type="text"], input:not([type])');
      for (const input of inputs) {
        // 尝试找 label
        let label = null;
        if (input.id) {
          const lbl = document.querySelector('label[for="' + input.id + '"]');
          if (lbl) label = lbl.textContent.trim();
        }
        if (!label && input.parentElement) {
          const prev = input.parentElement.querySelector('label, .ant-form-item-label');
          if (prev) label = prev.textContent.trim();
        }
        if (label && input.value) {
          result[label] = input.value;
        }
      }
      return result;
    })()
  `;
  const result = await evaluate(code);
  return result.data?.value || {};
}

module.exports = { extractInvoiceFields, extractFromInputs };
```

- [ ] **Step 2: 在 `lib/fip.js` 中注册**

```javascript
const { extractInvoiceFields } = require('./audit/extractor');

module.exports = {
  // ... existing exports
  extractInvoiceFields,
};
```

- [ ] **Step 3: 在 `bin/fip-cli.js` 中添加调试命令**

```javascript
program
  .command('extract-invoice')
  .description('从当前开票单页面提取字段（调试用）')
  .action(async () => {
    try {
      const fields = await fip.extractInvoiceFields();
      success(fields);
    } catch (e) {
      error('extract_invoice_error', e.message);
    }
  });
```

- [ ] **Step 4: 测试验证**

Run: `fip-cli open-bill KP20002026030900367 && fip-cli extract-invoice`
Expected: JSON with fields like `invoice_no`, `profit_center`, `project_name`, etc.

- [ ] **Step 5: Commit**

```bash
git add lib/audit/extractor.js lib/fip.js bin/fip-cli.js
git commit -m "feat: add invoice field extractor from DOM"
```

---

## Task 2: 审核规则配置 (`lib/audit/rules.json`)

**背景:** 将 invoice-auditor 的 `audit_rules.json` 和硬编码规则提取为独立配置文件。

**Files:**
- Create: `lib/audit/rules.json`

- [ ] **Step 1: 创建规则配置文件**

```json
{
  "version": "1.0",
  "profit_center_mapping": {
    "L1000": "中国建筑一局（集团）有限公司总部",
    "L1005": "中建一局集团第五建筑有限公司总部"
  },
  "warning_threshold": 5000000,
  "expected_approver": "刘书豪",
  "tax_rate_expected": "9%",
  "check_order": [
    "profit_center",
    "billing_unit",
    "contract_match",
    "unpaid_amount",
    "amount_limit",
    "approver"
  ],
  "attachments_required": [
    "合同关键页",
    "业主开票确认函",
    "外经证（异地项目）",
    "开票明细表",
    "累计确权额证明"
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/audit/rules.json
git commit -m "feat: add invoice audit rules configuration"
```

---

## Task 3: 审核引擎 (`lib/audit/engine.js`)

**背景:** 实现 6 项自动核对规则。移植自 `invoice_auditor_core.py` 的 `InvoiceAuditor` 类。

**Files:**
- Create: `lib/audit/engine.js`
- Modify: `lib/fip.js`

- [ ] **Step 1: 实现金额解析和派生值计算**

```javascript
// lib/audit/engine.js
const fs = require('fs');
const path = require('path');

let RULES = null;

function loadRules() {
  if (RULES) return RULES;
  const rulesPath = path.join(__dirname, 'rules.json');
  try {
    RULES = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
  } catch (e) {
    RULES = {
      profit_center_mapping: { L1000: '中国建筑一局（集团）有限公司总部', L1005: '中建一局集团第五建筑有限公司总部' },
      warning_threshold: 5000000,
      expected_approver: '刘书豪'
    };
  }
  return RULES;
}

function parseAmount(amountStr) {
  if (!amountStr) return 0;
  const cleaned = String(amountStr).replace(/[¥,\s]/g, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

function formatAmount(amount) {
  return '¥' + amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getBillingUnit(profitCenter) {
  const rules = loadRules();
  const pc = profitCenter || '';
  if (pc.startsWith('L1000')) {
    return { unit: rules.profit_center_mapping.L1000, status: '通过' };
  }
  if (pc.startsWith('L1005')) {
    return { unit: rules.profit_center_mapping.L1005, status: '通过' };
  }
  return { unit: '【请人工确认】', status: '需确认' };
}

function calculateDerivedValues(fields) {
  const invoiced = parseAmount(fields.invoiced_amount);
  const received = parseAmount(fields.received_amount);
  const current = parseAmount(fields.current_amount);
  const confirmed = parseAmount(fields.confirmed_amount);
  const unpaid = invoiced - received;
  const totalAfter = invoiced + current;

  return {
    unpaid_amount: unpaid,
    unpaid_formatted: formatAmount(unpaid),
    total_after_invoice: totalAfter,
    total_formatted: formatAmount(totalAfter),
    is_over_limit: confirmed > 0 && totalAfter > confirmed,
    is_large_unpaid: unpaid >= loadRules().warning_threshold,
    current_invoice: current,
    current_formatted: formatAmount(current),
    confirmed_amount: confirmed
  };
}
```

- [ ] **Step 2: 实现 6 项自动核对**

```javascript
function performChecks(fields, derived) {
  const rules = loadRules();
  const checks = {};
  const profitCenter = fields.profit_center || '';
  const { unit: billingUnit, status: pcStatus } = getBillingUnit(profitCenter);

  // 检查1: 利润中心核对
  checks.profit_center = {
    point: '利润中心',
    status: pcStatus,
    message: `利润中心: ${profitCenter}`,
    auto_checked: true
  };

  // 检查2: 开票单位核对
  checks.billing_unit = {
    point: '开票单位核对',
    status: pcStatus,
    message: `利润中心 ${profitCenter} 对应开票单位: ${billingUnit}`,
    auto_checked: true,
    details: { billing_unit: billingUnit }
  };

  // 检查3: 单据合同金额与附件合同额核对
  const contractAmount = parseAmount(fields.contract_amount);
  const attachmentContract = parseAmount(fields.attachment_contract_amount);
  if (contractAmount > 0 && attachmentContract > 0) {
    if (Math.abs(contractAmount - attachmentContract) < 0.01) {
      checks.contract_match = {
        point: '单据合同金额与附件合同额核对',
        status: '通过',
        message: `单据金额 ${formatAmount(contractAmount)} 与附件金额 ${formatAmount(attachmentContract)} 一致`,
        auto_checked: true
      };
    } else {
      checks.contract_match = {
        point: '单据合同金额与附件合同额核对',
        status: '警告',
        message: `金额不一致！单据 ${formatAmount(contractAmount)} vs 附件 ${formatAmount(attachmentContract)}`,
        auto_checked: true,
        action_needed: '核实合同金额差异原因',
        details: { difference: formatAmount(Math.abs(contractAmount - attachmentContract)) }
      };
    }
  } else {
    checks.contract_match = {
      point: '单据合同金额与附件合同额核对',
      status: '需人工核对',
      message: '附件合同金额未提供，无法自动核对',
      auto_checked: false,
      action_needed: '请核对附件中的合同金额'
    };
  }

  // 检查4: 已开票未收款金额检查
  const unpaid = derived.unpaid_amount;
  if (derived.is_large_unpaid) {
    checks.unpaid_amount = {
      point: '已开票未收款金额检查',
      status: '警告',
      message: `已开票未收款 ${derived.unpaid_formatted} >= 500万`,
      auto_checked: true,
      action_needed: '撰写《大额已开票未收款情况说明》'
    };
  } else if (unpaid < 0) {
    checks.unpaid_amount = {
      point: '已开票未收款金额检查',
      status: '信息',
      message: `预收账款状态: ${derived.unpaid_formatted}`,
      auto_checked: true
    };
  } else {
    checks.unpaid_amount = {
      point: '已开票未收款金额检查',
      status: '通过',
      message: `已开票未收款 ${derived.unpaid_formatted} < 500万，正常`,
      auto_checked: true
    };
  }

  // 检查5: 开票金额与累计确权额核对
  const confirmed = parseAmount(fields.confirmed_amount);
  if (confirmed <= 0) {
    checks.amount_limit = {
      point: '开票金额与累计确权额核对',
      status: '需人工核对',
      message: '累计确权额未提供，无法自动核对',
      auto_checked: false,
      action_needed: '请从结算系统或财务部门获取累计确权额',
      details: { manual_input_required: true }
    };
  } else if (derived.is_over_limit) {
    const over = derived.total_after_invoice - confirmed;
    checks.amount_limit = {
      point: '开票金额与累计确权额核对',
      status: '失败',
      message: `开票金额超限！${derived.total_formatted} > 确权额 ${formatAmount(confirmed)}`,
      auto_checked: true,
      action_needed: '核实累计确权额是否正确，或确认是否有新增确权',
      details: { over_amount: formatAmount(over) }
    };
  } else {
    checks.amount_limit = {
      point: '开票金额与累计确权额核对',
      status: '通过',
      message: `${derived.total_formatted} <= 确权额 ${formatAmount(confirmed)}，符合要求`,
      auto_checked: true
    };
  }

  // 检查6: 税务主管审批人核对
  const approver = fields.tax_approver || '';
  if (approver.includes(rules.expected_approver)) {
    checks.approver = {
      point: '税务主管审批人核对',
      status: '通过',
      message: `审批人匹配: ${approver}`,
      auto_checked: true
    };
  } else {
    checks.approver = {
      point: '税务主管审批人核对',
      status: '需确认',
      message: `审批人'${approver}'需要确认`,
      auto_checked: true,
      action_needed: '确认审批人是否正确'
    };
  }

  return checks;
}
```

- [ ] **Step 3: 实现主审核函数**

```javascript
function audit(fields) {
  const derived = calculateDerivedValues(fields);
  const checks = performChecks(fields, derived);

  // 统计结果
  const stats = {
    passed: 0,
    warning: 0,
    failed: 0,
    manual: 0,
    info: 0
  };

  for (const check of Object.values(checks)) {
    if (check.status === '通过') stats.passed++;
    else if (check.status === '警告') stats.warning++;
    else if (check.status === '失败') stats.failed++;
    else if (check.status === '需人工核对' || check.status === '需确认') stats.manual++;
    else if (check.status === '信息') stats.info++;
  }

  return {
    invoice_no: fields.invoice_no || 'unknown',
    project_name: fields.project_name || '',
    profit_center: fields.profit_center || '',
    fields,
    derived,
    checks,
    stats,
    timestamp: new Date().toISOString()
  };
}

module.exports = { audit, parseAmount, formatAmount, getBillingUnit, calculateDerivedValues, performChecks, loadRules };
```

- [ ] **Step 4: 在 `lib/fip.js` 中注册**

```javascript
const { audit } = require('./audit/engine');

module.exports = {
  // ... existing exports
  auditInvoice: audit,
};
```

- [ ] **Step 5: Commit**

```bash
git add lib/audit/engine.js lib/audit/rules.json lib/fip.js
git commit -m "feat: add invoice audit engine with 6 auto-check rules"
```

---

## Task 4: 报告生成器 (`lib/audit/reporter.js`)

**背景:** 将审核结果生成文本报告（类似 invoice-auditor 的 `generate_full_report.py`）。

**Files:**
- Create: `lib/audit/reporter.js`
- Modify: `lib/fip.js`

- [ ] **Step 1: 实现文本报告生成**

```javascript
// lib/audit/reporter.js

function generateTextReport(result) {
  const lines = [];
  const separator = '='.repeat(80);

  lines.push(separator);
  lines.push('                    开票单智能审核报告');
  lines.push(separator);
  lines.push('');

  // 基本信息
  lines.push('【单据基本信息】');
  lines.push(`单据编号: ${result.invoice_no}`);
  lines.push(`项目名称: ${result.project_name || '未提取'}`);
  lines.push(`利润中心: ${result.profit_center || '未提取'}`);
  lines.push('');

  // 金额信息
  lines.push('【金额信息】');
  if (result.fields.contract_amount) lines.push(`合同总金额: ${result.fields.contract_amount}`);
  if (result.fields.invoiced_amount) lines.push(`已开票总金额: ${result.fields.invoiced_amount}`);
  if (result.fields.current_amount) lines.push(`本次开票金额: ${result.fields.current_amount}`);
  if (result.fields.received_amount) lines.push(`已收款总金额: ${result.fields.received_amount}`);
  if (result.derived.unpaid_formatted) lines.push(`已开票未收款: ${result.derived.unpaid_formatted}`);
  lines.push('');

  // 自动核对结果
  lines.push(separator);
  lines.push('                              自动核对结果');
  lines.push(separator);
  lines.push('');

  const statusIcons = {
    '通过': '✅',
    '警告': '⚠️',
    '失败': '❌',
    '需人工核对': '⏸️',
    '需确认': '⏸️',
    '信息': 'ℹ️'
  };

  for (const [key, check] of Object.entries(result.checks)) {
    const icon = statusIcons[check.status] || '❓';
    lines.push(`${icon} [${check.status}] ${check.point}`);
    lines.push(`   ${check.message}`);
    if (check.action_needed) {
      lines.push(`   → ${check.action_needed}`);
    }
    lines.push('');
  }

  // 统计
  lines.push('【核对统计】');
  lines.push(`通过: ${result.stats.passed} 项`);
  lines.push(`警告: ${result.stats.warning} 项`);
  lines.push(`失败: ${result.stats.failed} 项`);
  lines.push(`需人工核对: ${result.stats.manual} 项`);
  lines.push('');

  // 审核结论
  lines.push(separator);
  lines.push('                              审核结论');
  lines.push(separator);
  lines.push('');

  if (result.stats.failed > 0) {
    lines.push('【结论】: 有失败项，需处理后提交');
  } else if (result.stats.warning > 0 || result.stats.manual > 0) {
    lines.push('【结论】: 有警告/需确认项，处理后可提交');
  } else {
    lines.push('【结论】: 全部通过，可提交');
  }

  lines.push('');
  lines.push(`审核时间: ${result.timestamp}`);
  lines.push('');

  return lines.join('\n');
}

function generateJsonReport(result) {
  return JSON.stringify(result, null, 2);
}

module.exports = { generateTextReport, generateJsonReport };
```

- [ ] **Step 2: 在 `lib/fip.js` 中注册**

```javascript
const { generateTextReport, generateJsonReport } = require('./audit/reporter');

module.exports = {
  // ... existing exports
  generateAuditTextReport: generateTextReport,
  generateAuditJsonReport: generateJsonReport,
};
```

- [ ] **Step 3: Commit**

```bash
git add lib/audit/reporter.js lib/fip.js
git commit -m "feat: add invoice audit report generator"
```

---

## Task 5: CLI 命令整合 (`audit-invoice`)

**背景:** 将提取 + 审核 + 报告整合为一个命令。支持两种模式：
1. `--bill-id <id>` — 自动打开单据、提取、审核、关闭
2. 无参数 — 对当前页面执行审核（假设已在开票单详情页）

**Files:**
- Modify: `bin/fip-cli.js`

- [ ] **Step 1: 添加 `audit-invoice` 命令**

```javascript
program
  .command('audit-invoice [billId]')
  .description('智能审核开票单（自动提取字段+核对+生成报告）')
  .option('--confirmed-amount <amount>', '累计确权额（人工提供，如 50000000）')
  .option('--attachment-contract <amount>', '附件合同金额（用于核对）')
  .option('--format <type>', '报告格式 (text/json)', 'text')
  .option('--output <path>', '报告输出文件路径')
  .option('--keep-open', '审核后不关闭单据', false)
  .action(async (billId, options) => {
    try {
      // 1. 如果提供了 billId，先打开单据
      if (billId) {
        console.log(`打开单据 ${billId}...`);
        await fip.openBill(billId);
        await fip.sleep(3000);
      }

      // 2. 提取字段
      console.log('提取单据字段...');
      const fields = await fip.extractInvoiceFields();

      if (!fields.invoice_no) {
        throw new Error('未能从页面提取到单据编号，请确认当前页面是开票单详情页');
      }

      console.log(`提取成功: 单据 ${fields.invoice_no}`);

      // 3. 合并人工输入的参数
      if (options.confirmedAmount) {
        fields.confirmed_amount = options.confirmedAmount;
      }
      if (options.attachmentContract) {
        fields.attachment_contract_amount = options.attachmentContract;
      }

      // 4. 执行审核
      console.log('执行自动核对...');
      const result = fip.auditInvoice(fields);

      // 5. 生成报告
      let report;
      if (options.format === 'json') {
        report = fip.generateAuditJsonReport(result);
      } else {
        report = fip.generateAuditTextReport(result);
      }

      // 6. 输出到文件或控制台
      if (options.output) {
        const fs = require('fs');
        fs.writeFileSync(options.output, report, 'utf8');
        console.log(`报告已保存: ${options.output}`);
      }

      // 7. 关闭单据（除非 --keep-open）
      if (billId && !options.keepOpen) {
        console.log('关闭单据...');
        await fip.closeBill();
      }

      // 8. 返回结果
      success({
        invoice_no: result.invoice_no,
        stats: result.stats,
        report: options.output ? null : report,
        output_file: options.output || null,
        format: options.format
      });
    } catch (e) {
      error('audit_invoice_error', e.message);
    }
  });
```

- [ ] **Step 2: 测试验证**

Run: `fip-cli audit-invoice KP20002026030900367 --confirmed-amount 500000000 --format text`
Expected: 文本报告输出，包含 6 项核对结果和统计

- [ ] **Step 3: Commit**

```bash
git add bin/fip-cli.js
git commit -m "feat: add audit-invoice CLI command"
```

---

## Task 6: 附件下载 + 审核整合（可选增强）

**背景:** invoice-auditor 支持附件 OCR 审核（合同、确认函、外经证）。FIP CLI 已有 `download-attachments` 命令，可以整合。

**Files:**
- Modify: `lib/audit/engine.js`
- Modify: `bin/fip-cli.js`

- [ ] **Step 1: 在 engine.js 中添加附件检查逻辑**

```javascript
// 在 engine.js 的 audit() 函数末尾添加附件检查

function checkAttachments(fields) {
  const rules = loadRules();
  const attachments = fields.attachments || [];
  const required = rules.attachments_required || [];
  const results = [];

  for (const req of required) {
    // 异地项目才需要外经证
    if (req.includes('外经证') && !fields.is_external_project) {
      continue;
    }
    const found = attachments.some(a => a.includes(req.replace('（异地项目）', '')));
    results.push({
      name: req,
      status: found ? '已上传' : '缺失',
      files: attachments.filter(a => a.includes(req.replace('（异地项目）', '')))
    });
  }

  const missing = results.filter(r => r.status === '缺失');
  return {
    point: '附件完整性检查',
    status: missing.length > 0 ? '警告' : '通过',
    message: missing.length > 0
      ? `缺少附件: ${missing.map(m => m.name).join(', ')}`
      : `主要附件已齐备 (${attachments.length} 个)`,
    auto_checked: true,
    action_needed: missing.length > 0 ? '补充缺失的附件' : null,
    details: { attachments: results }
  };
}

// 在 performChecks 末尾添加
// checks.attachments = checkAttachments(fields);
```

- [ ] **Step 2: 在 CLI 中添加 `--download-attachments` 选项**

```javascript
.option('--download-attachments', '审核前下载附件', false)

// 在 action 中，提取字段后添加：
if (options.downloadAttachments) {
  console.log('下载附件...');
  const attachResult = await fip.downloadAttachments({ downloadDir: `./downloads/${fields.invoice_no}` });
  fields.attachments = attachResult.attachments.map(a => a.name);
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/audit/engine.js bin/fip-cli.js
git commit -m "feat: add attachment check to invoice audit"
```

---

## Spec Coverage Check

| 需求 | 对应 Task | 状态 |
|------|----------|------|
| （1）搜集开票单信息 | Task 1 (extractor.js) | ✅ 已规划 |
| （2）核对相关信息 | Task 3 (engine.js) | ✅ 已规划 |
| 利润中心核对 | engine.js performChecks | ✅ 已规划 |
| 开票单位核对 | engine.js performChecks | ✅ 已规划 |
| 合同金额核对 | engine.js performChecks | ✅ 已规划 |
| 未收款金额检查 | engine.js performChecks | ✅ 已规划 |
| 确权额核对 | engine.js performChecks | ✅ 已规划 |
| 审批人核对 | engine.js performChecks | ✅ 已规划 |
| 报告生成 | Task 4 (reporter.js) | ✅ 已规划 |
| CLI 整合 | Task 5 | ✅ 已规划 |
| 附件检查 | Task 6 | ✅ 已规划 |

---

## Self-Review Checklist

**1. Placeholder scan:** 无 TBD、TODO。每个 Task 包含完整代码。

**2. Type consistency:** `fields` 对象贯穿 extractor → engine → reporter，字段名与 invoice-auditor 保持一致（`invoice_no`, `profit_center`, `confirmed_amount` 等）。

**3. Spec coverage:** 6 项自动核对全部覆盖，5 项人工核对中的"提供累计确权额"通过 `--confirmed-amount` CLI 选项支持。

**4. DRY:** 金额解析 `parseAmount` 和格式化 `formatAmount` 集中在 engine.js，不重复。

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-25-invoice-audit-automation.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints for review

**Which approach?**
