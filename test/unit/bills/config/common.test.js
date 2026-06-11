const { expect } = require('chai');

describe('bills/config/common', () => {
  const common = require('../../../../lib/bills/config/common');

  it('should export COMMON_BASE_PATTERNS', () => {
    expect(common.COMMON_BASE_PATTERNS).to.be.an('object');
    expect(common.COMMON_BASE_PATTERNS).to.have.property('bill_no');
    expect(common.COMMON_BASE_PATTERNS).to.have.property('submitter');
    expect(common.COMMON_BASE_PATTERNS).to.have.property('submit_date');
    expect(common.COMMON_BASE_PATTERNS).to.have.property('status');
    expect(common.COMMON_BASE_PATTERNS).to.have.property('attachment_count');
  });

  it('should have valid regex patterns', () => {
    const patterns = common.COMMON_BASE_PATTERNS;
    expect(patterns.bill_no.test('单据编号：SLBX2004202605003766')).to.equal(true);
    expect(patterns.submitter.test('提单人：张三')).to.equal(true);
    expect(patterns.submit_date.test('提单日期：2026-04-01')).to.equal(true);
    expect(patterns.status.test('状态：审批中')).to.equal(true);
    expect(patterns.attachment_count.test('附件(个)：5')).to.equal(true);
  });

  it('should export COMMON_INPUT_FIELDS', () => {
    expect(common.COMMON_INPUT_FIELDS).to.be.an('object');
    expect(common.COMMON_INPUT_FIELDS).to.have.property('reimbursement_reason');
    expect(common.COMMON_INPUT_FIELDS).to.have.property('department');
    expect(common.COMMON_INPUT_FIELDS).to.have.property('project_name');
  });

  it('should have byLabel strategy in input fields', () => {
    const fields = common.COMMON_INPUT_FIELDS;
    for (const key of Object.keys(fields)) {
      expect(fields[key]).to.have.property('byLabel');
      expect(fields[key].byLabel).to.be.a('string');
    }
  });

  it('should export FILTER_CONFIG with correct structure', () => {
    expect(common.FILTER_CONFIG).to.be.an('object');
    expect(common.FILTER_CONFIG).to.have.property('headerTexts');
    expect(common.FILTER_CONFIG).to.have.property('invoiceStatusWords');
    expect(common.FILTER_CONFIG).to.have.property('gwtClassPrefix');
    expect(common.FILTER_CONFIG.headerTexts).to.be.an('array');
    expect(common.FILTER_CONFIG.invoiceStatusWords).to.be.an('array');
    expect(common.FILTER_CONFIG.gwtClassPrefix).to.be.a('string');
  });
});
