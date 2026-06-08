const { parseAmount, formatAmount, getBillingUnit, calculateDerivedValues, performChecks, audit } = require('../lib/audit/engine');
const { generateTextReport, generateJsonReport } = require('../lib/audit/reporter');

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertClose(actual, expected, message, epsilon = 0.001) {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`${message}: expected ~${expected}, got ${actual}`);
  }
}

function assertIncludes(str, substr, message) {
  if (!str.includes(substr)) {
    throw new Error(`${message}: expected to include "${substr}"`);
  }
}

// Test parseAmount
function testParseAmount() {
  assertEqual(parseAmount('¥1,234.56'), 1234.56, 'parseAmount with currency');
  assertEqual(parseAmount('1000000'), 1000000, 'parseAmount plain number');
  assertEqual(parseAmount(null), 0, 'parseAmount null');
  assertEqual(parseAmount(undefined), 0, 'parseAmount undefined');
  assertEqual(parseAmount(''), 0, 'parseAmount empty string');
  assertEqual(parseAmount(5000), 5000, 'parseAmount number input');
  console.log('  parseAmount: OK');
}

// Test formatAmount
function testFormatAmount() {
  assertEqual(formatAmount(1234.5), '¥1,234.50', 'formatAmount basic');
  assertEqual(formatAmount(1000000), '¥1,000,000.00', 'formatAmount large');
  assertEqual(formatAmount(-500), '-¥500.00', 'formatAmount negative');
  assertEqual(formatAmount(0), '¥0.00', 'formatAmount zero');
  console.log('  formatAmount: OK');
}

// Test getBillingUnit
function testGetBillingUnit() {
  const r1 = getBillingUnit('L1000200001');
  assertEqual(r1.status, '通过', 'billing unit L1000 prefix');
  assertEqual(r1.unit, '中国建筑一局（集团）有限公司总部', 'billing unit L1000 name');

  const r2 = getBillingUnit('L1005000001');
  assertEqual(r2.status, '通过', 'billing unit L1005 prefix');

  const r3 = getBillingUnit('L9999000001');
  assertEqual(r3.status, '需确认', 'billing unit unknown');
  console.log('  getBillingUnit: OK');
}

// Test calculateDerivedValues
function testCalculateDerivedValues() {
  const fields = {
    invoiced_amount: 30000000,
    received_amount: 25000000,
    current_amount: 5000000,
    confirmed_amount: 500000000
  };
  const d = calculateDerivedValues(fields);
  assertClose(d.unpaid_amount, 5000000, 'derived unpaid');
  assertClose(d.total_after_invoice, 35000000, 'derived total after');
  assertEqual(d.is_over_limit, false, 'derived not over limit');
  assertEqual(d.is_large_unpaid, true, 'derived is large unpaid');
  console.log('  calculateDerivedValues: OK');
}

// Test performChecks - all pass scenario
function testPerformChecksAllPass() {
  const fields = {
    profit_center: 'L1000200001',
    contract_amount: 100000000,
    attachment_contract_amount: 100000000,
    invoiced_amount: 30000000,
    received_amount: 25000000,
    current_amount: 5000000,
    confirmed_amount: 500000000,
    tax_approver: '刘书豪',
    attachments: ['合同关键页.pdf', '开票明细表.xlsx']
  };
  const derived = calculateDerivedValues(fields);
  const checks = performChecks(fields, derived);

  assertEqual(checks.profit_center.status, '通过', 'check profit_center');
  assertEqual(checks.billing_unit.status, '通过', 'check billing_unit');
  assertEqual(checks.contract_match.status, '通过', 'check contract_match');
  assertEqual(checks.amount_limit.status, '通过', 'check amount_limit');
  assertEqual(checks.approver.status, '通过', 'check approver');
  console.log('  performChecks all-pass: OK');
}

// Test performChecks - over limit
function testPerformChecksOverLimit() {
  const fields = {
    profit_center: 'L1000200001',
    invoiced_amount: 400000000,
    received_amount: 0,
    current_amount: 100000000,
    confirmed_amount: 450000000,
    tax_approver: '刘书豪'
  };
  const derived = calculateDerivedValues(fields);
  const checks = performChecks(fields, derived);

  assertEqual(checks.amount_limit.status, '失败', 'check over limit');
  assertIncludes(checks.amount_limit.message, '超限', 'check over limit message');
  console.log('  performChecks over-limit: OK');
}

// Test performChecks - missing confirmed amount
function testPerformChecksMissingConfirmed() {
  const fields = {
    profit_center: 'L1000200001',
    invoiced_amount: 10000000,
    received_amount: 10000000,
    current_amount: 5000000,
    tax_approver: '刘书豪'
  };
  const derived = calculateDerivedValues(fields);
  const checks = performChecks(fields, derived);

  assertEqual(checks.amount_limit.status, '需人工核对', 'check missing confirmed');
  assertEqual(checks.amount_limit.auto_checked, false, 'check manual flag');
  console.log('  performChecks missing-confirmed: OK');
}

// Test full audit
function testAudit() {
  const fields = {
    invoice_no: 'KP20002026030900367',
    project_name: '测试项目',
    profit_center: 'L1000200001',
    invoiced_amount: 30000000,
    received_amount: 25000000,
    current_amount: 5000000,
    confirmed_amount: 500000000,
    tax_approver: '刘书豪',
    attachments: ['合同关键页.pdf']
  };
  const result = audit(fields);

  assertEqual(result.invoice_no, 'KP20002026030900367', 'audit invoice_no');
  assertEqual(result.stats.failed, 0, 'audit no failures');
  assertEqual(result.checks.attachments.status, '警告', 'audit attachments warning');
  console.log('  audit full flow: OK');
}

// Test report generation
function testReports() {
  const fields = {
    invoice_no: 'KP20002026030900367',
    project_name: '测试项目',
    profit_center: 'L1000200001',
    invoiced_amount: 30000000,
    received_amount: 25000000,
    current_amount: 5000000,
    confirmed_amount: 500000000,
    tax_approver: '刘书豪',
    attachments: ['合同关键页.pdf']
  };
  const result = audit(fields);

  const textReport = generateTextReport(result);
  assertIncludes(textReport, 'KP20002026030900367', 'text report includes invoice');
  assertIncludes(textReport, '测试项目', 'text report includes project');
  assertIncludes(textReport, '¥30,000,000.00', 'text report formatted amount');

  const jsonReport = generateJsonReport(result);
  const parsed = JSON.parse(jsonReport);
  assertEqual(parsed.invoice_no, 'KP20002026030900367', 'json report parseable');

  console.log('  report generation: OK');
}

// Run all tests
function runTests() {
  console.log('Running audit engine tests...');
  try {
    testParseAmount();
    testFormatAmount();
    testGetBillingUnit();
    testCalculateDerivedValues();
    testPerformChecksAllPass();
    testPerformChecksOverLimit();
    testPerformChecksMissingConfirmed();
    testAudit();
    testReports();
    console.log('\nAll tests passed!');
    process.exit(0);
  } catch (e) {
    console.error('\nTest failed:', e.message);
    process.exit(1);
  }
}

runTests();
