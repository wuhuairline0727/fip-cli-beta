import { expect } from 'chai';
import * as common from '../../../../lib/bills/config/common';

describe('bills/config/common', () => {
  it('should export COMMON_BASE_PATTERNS', () => {
    expect(common.COMMON_BASE_PATTERNS).to.be.an('object');
    expect(common.COMMON_BASE_PATTERNS).to.have.property('bill_no');
    expect(common.COMMON_BASE_PATTERNS).to.have.property('submitter');
    expect(common.COMMON_BASE_PATTERNS).to.have.property('status');
  });

  it('should have valid regex patterns in COMMON_BASE_PATTERNS', () => {
    const patterns = common.COMMON_BASE_PATTERNS;
    expect(patterns.bill_no.test('单据编号：SLBX2004202605003766')).to.equal(
      true
    );
    expect(patterns.submitter.test('提单人：张三')).to.equal(true);
    expect(
      patterns.status.test('境内差旅报销单\n自动填报\n审批中\n单据编号：')
    ).to.equal(true);
  });

  it('should export COMMON_INPUT_FIELDS', () => {
    expect(common.COMMON_INPUT_FIELDS).to.be.an('object');
    // 内联正则匹配不到的字段（值在 input.value 中）放在 INPUT_FIELDS
    expect(common.COMMON_INPUT_FIELDS).to.have.property('reimbursement_reason');
    expect(common.COMMON_INPUT_FIELDS).to.have.property('department');
    expect(common.COMMON_INPUT_FIELDS).to.have.property('project_name');
    expect(common.COMMON_INPUT_FIELDS).to.have.property('submit_date');
    expect(common.COMMON_INPUT_FIELDS).to.have.property('attachment_count');
  });

  it('COMMON_INPUT_FIELDS entries should have at least one valid locator', () => {
    const fields = common.COMMON_INPUT_FIELDS;
    for (const [key, spec] of Object.entries(fields)) {
      const hasLocator =
        (typeof spec.byId === 'string' && spec.byId.length > 0) ||
        (typeof spec.byIdPrefix === 'string' && spec.byIdPrefix.length > 0) ||
        (typeof spec.byLabel === 'string' && spec.byLabel.length > 0);
      expect(
        hasLocator,
        `field ${key} must define byId/byIdPrefix/byLabel`
      ).to.equal(true);
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
