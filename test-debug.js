// Phase 4 验证：构造模板字符串 + eval，确认 regex 在浏览器中能正确匹配
const code = `
  const re = /单据编号[：:]\\s*([A-Z0-9]+)/;
  re.test('单据编号：SLBX1234ABC');
`;
const result = eval(code);
console.log('regexToString 修复后正则可用:', result);

// 验证 cfg.basePatterns 的实际生成的代码能正确匹配
const { buildExtractionCode } = require('./lib/bills/extractor');
const { getBillConfig } = require('./lib/bills/config');
const code2 = buildExtractionCode(getBillConfig('SLBX'));
// 在生成代码中查找 basePatterns 块
const m = code2.match(/const basePatterns = \{[\s\S]*?\n  \}/);
console.log('生成的 basePatterns 片段:');
console.log(m?.[0]);
