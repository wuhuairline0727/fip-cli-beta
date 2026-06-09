/**
 * 单据提取器测试
 * 使用简单断言函数（非 jest/mocha）
 */

const { detectBillType, getBillConfig, BILL_TYPE_MAP } = require('../lib/bills/config');

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

console.log('\n========================');
console.log(`Total: ${passed + failed}, Passed: ${passed}, Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
}
