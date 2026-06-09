/**
 * 单据提取器测试
 * 使用简单断言函数（非 jest/mocha）
 */

const { detectBillType, getBillConfig, BILL_TYPE_MAP } = require('../lib/bills/config');
const { parseAmount, buildExtractionCode, extractBill } = require('../lib/bills/extractor');
const { extractKeywords, generateAuditHints } = require('../lib/bills/audit-hints');

let passed = 0;
let failed = 0;

function assertEqual(actual, expected, message) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr === expectedStr) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    console.error(`    expected: ${expectedStr}`);
    console.error(`    actual:   ${actualStr}`);
    failed++;
  }
}

function assertTrue(value, message) {
  if (value === true) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    console.error(`    expected: true`);
    console.error(`    actual:   ${JSON.stringify(value)}`);
    failed++;
  }
}

console.log('\n=== testBillTypeConfigs ===');
(function testBillTypeConfigs() {
  const configs = {
    SLBX: getBillConfig('SLBX'),
    TBX: getBillConfig('TBX'),
    CFK: getBillConfig('CFK'),
    CBX: getBillConfig('CBX'),
  };

  for (const [type, config] of Object.entries(configs)) {
    assertTrue(typeof config === 'object' && config !== null, `${type} config is an object`);
    assertTrue('name' in config, `${type} config has name`);
    assertTrue('codePrefix' in config, `${type} config has codePrefix`);
    assertTrue('basePatterns' in config, `${type} config has basePatterns`);
    assertTrue('inputFields' in config, `${type} config has inputFields`);
    assertTrue('tables' in config, `${type} config has tables`);
  }

  function hasTable(config, tableName) {
    return Array.isArray(config.tables) && config.tables.some(t => t.name === tableName);
  }

  assertTrue(hasTable(configs.SLBX, 'transport_expenses'), 'SLBX has transport_expenses table');
  assertTrue(hasTable(configs.SLBX, 'accommodation_expenses'), 'SLBX has accommodation_expenses table');
  assertTrue(hasTable(configs.SLBX, 'subsidy_expenses'), 'SLBX has subsidy_expenses table');
  assertTrue(hasTable(configs.SLBX, 'expense_allocation'), 'SLBX has expense_allocation table');

  assertTrue(hasTable(configs.TBX, 'expense_items'), 'TBX has expense_items table');
  assertTrue(hasTable(configs.TBX, 'expense_allocation'), 'TBX has expense_allocation table');

  assertTrue(hasTable(configs.CFK, 'expense_details'), 'CFK has expense_details table');
  assertTrue(hasTable(configs.CFK, 'expense_allocation'), 'CFK has expense_allocation table');

  assertTrue(hasTable(configs.CBX, 'expense_allocation'), 'CBX has expense_allocation table');
})();

console.log('\n=== detectBillType ===');
assertEqual(detectBillType('SLBX2004202605003766'), 'SLBX', 'detects SLBX prefix');
assertEqual(detectBillType('TBX1234567890'), 'TBX', 'detects TBX prefix');
assertEqual(detectBillType('CFK1234567890'), 'CFK', 'detects CFK prefix');
assertEqual(detectBillType('CBX1234567890'), 'CBX', 'detects CBX prefix');
assertEqual(detectBillType('UNKNOWN123'), null, 'returns null for unknown prefix');
assertEqual(detectBillType(''), null, 'returns null for empty string');
assertEqual(detectBillType(null), null, 'returns null for null');

console.log('\n=== getBillConfig ===');
const slbxConfig = getBillConfig('SLBX');
assertEqual(typeof slbxConfig, 'object', 'returns an object for valid type');
assertEqual(slbxConfig.name, '境内差旅报销单', 'has correct name');
assertEqual(slbxConfig.codePrefix, 'SLBX', 'has correct codePrefix');
assertTrue(typeof slbxConfig.basePatterns === 'object' && slbxConfig.basePatterns !== null, 'has basePatterns object');
assertTrue(typeof slbxConfig.inputFields === 'object' && slbxConfig.inputFields !== null, 'has inputFields object');
assertTrue('bill_no' in slbxConfig.basePatterns, 'basePatterns includes common bill_no');
assertTrue('reimbursement_reason' in slbxConfig.inputFields, 'inputFields includes common reimbursement_reason');

assertEqual(getBillConfig('UNKNOWN'), null, 'returns null for unknown type');
assertEqual(getBillConfig(null), null, 'returns null for null type');

console.log('\n=== BILL_TYPE_MAP ===');
assertTrue('SLBX' in BILL_TYPE_MAP, 'contains SLBX');
assertTrue('TBX' in BILL_TYPE_MAP, 'contains TBX');
assertTrue('CFK' in BILL_TYPE_MAP, 'contains CFK');
assertTrue('CBX' in BILL_TYPE_MAP, 'contains CBX');

console.log('\n=== parseAmount ===');
assertEqual(parseAmount('1,234.56'), 1234.56, 'parses comma-separated amount');
assertEqual(parseAmount('¥1,234.56'), 1234.56, 'parses amount with ¥');
assertEqual(parseAmount('￥1,234.56'), 1234.56, 'parses amount with ￥');
assertEqual(parseAmount('100.00'), 100, 'parses plain amount');
assertEqual(parseAmount('  1,000  '), 1000, 'parses amount with spaces');
assertEqual(parseAmount(''), null, 'returns null for empty string');
assertEqual(parseAmount(null), null, 'returns null for null');
assertEqual(parseAmount('abc'), null, 'returns null for non-numeric');
assertEqual(parseAmount('¥0.00'), 0, 'parses zero amount');

console.log('\n=== buildExtractionCode ===');
const testConfig = getBillConfig('SLBX');
const extractionCode = buildExtractionCode(testConfig);
assertTrue(typeof extractionCode === 'string', 'returns a string');
assertTrue(extractionCode.includes('document.body.innerText'), 'includes pageText extraction');
assertTrue(extractionCode.includes('basePatterns'), 'includes basePatterns');
assertTrue(extractionCode.includes('inputFields'), 'includes inputFields');
assertTrue(extractionCode.includes('attachments'), 'includes attachments');
assertTrue(extractionCode.includes('ui_attachment_count'), 'includes ui_attachment_count');
assertTrue(extractionCode.includes('tr[class*="FD26IYC"]'), 'includes table row selector');
assertTrue(extractionCode.includes('getElementById'), 'includes byId strategy');
assertTrue(extractionCode.includes('querySelectorAll(\'label\')'), 'includes byLabel strategy');

console.log('\n=== extractKeywords ===');
assertEqual(extractKeywords('管理费用\\业务招待费'), ['管理费用', '业务招待费'], 'splits by backslash');
assertEqual(extractKeywords('管理费用/业务招待费'), ['管理费用', '业务招待费'], 'splits by forward slash');
assertEqual(extractKeywords('  管理费用  \\  业务招待费  '), ['管理费用', '业务招待费'], 'trims whitespace');
assertEqual(extractKeywords(''), [], 'returns empty array for empty string');
assertEqual(extractKeywords(null), [], 'returns empty array for null');
assertEqual(extractKeywords(undefined), [], 'returns empty array for undefined');

console.log('\n=== generateAuditHints ===');
// 测试预算与费用事项一致的情况（应返回 pass）
(function testBudgetExpenseMatchPass() {
  const data = {
    expense_allocation: [{ budget_item: '管理费用\\业务招待费', expense_item: '管理费用\\业务招待费' }],
  };
  const hints = generateAuditHints(data, 'SLBX');
  const hint = hints.find(h => h.name === 'budget_expense_match');
  assertTrue(!!hint, 'budget_expense_match hint exists for matching case');
  assertEqual(hint.level, 'pass', 'budget_expense_match is pass when matching');
})();

// 测试预算与费用事项不一致的情况（应返回 warning）
(function testBudgetExpenseMatchWarning() {
  const data = {
    expense_allocation: [{ budget_item: '管理费用\\办公费', expense_item: '管理费用\\业务招待费' }],
  };
  const hints = generateAuditHints(data, 'SLBX');
  const hint = hints.find(h => h.name === 'budget_expense_match');
  assertTrue(!!hint, 'budget_expense_match hint exists for mismatch case');
  assertEqual(hint.level, 'warning', 'budget_expense_match is warning when mismatching');
})();

// 测试报销事由匹配的情况
(function testReasonExpenseMatchPass() {
  const data = {
    expense_allocation: [{ expense_item: '管理费用\\业务招待费' }],
    reimbursement_reason: '客户业务招待费',
  };
  const hints = generateAuditHints(data, 'SLBX');
  const hint = hints.find(h => h.name === 'reason_expense_match');
  assertTrue(!!hint, 'reason_expense_match hint exists for matching case');
  assertEqual(hint.level, 'pass', 'reason_expense_match is pass when reason contains keyword');
})();

// 测试报销事由不匹配的情况
(function testReasonExpenseMatchInfo() {
  const data = {
    expense_allocation: [{ expense_item: '管理费用\\业务招待费' }],
    reimbursement_reason: '购买办公用品',
  };
  const hints = generateAuditHints(data, 'SLBX');
  const hint = hints.find(h => h.name === 'reason_expense_match');
  assertTrue(!!hint, 'reason_expense_match hint exists for mismatch case');
  assertEqual(hint.level, 'info', 'reason_expense_match is info when reason does not contain keyword');
})();

// 测试预算余额充足的情况
(function testBudgetBalanceSufficient() {
  const data = {
    expense_allocation: [{ budget_balance: 5000 }],
    amount: 1000,
  };
  const hints = generateAuditHints(data, 'SLBX');
  const hint = hints.find(h => h.name === 'budget_balance_check');
  assertTrue(!!hint, 'budget_balance_check hint exists for sufficient case');
  assertEqual(hint.level, 'pass', 'budget_balance_check is pass when balance is sufficient');
})();

// 测试预算余额不足的情况
(function testBudgetBalanceInsufficient() {
  const data = {
    expense_allocation: [{ budget_balance: 500 }],
    amount: 1000,
  };
  const hints = generateAuditHints(data, 'SLBX');
  const hint = hints.find(h => h.name === 'budget_balance_check');
  assertTrue(!!hint, 'budget_balance_check hint exists for insufficient case');
  assertEqual(hint.level, 'warning', 'budget_balance_check is warning when balance is insufficient');
})();

console.log('\n========================');
console.log(`Total: ${passed + failed}, Passed: ${passed}, Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
}
