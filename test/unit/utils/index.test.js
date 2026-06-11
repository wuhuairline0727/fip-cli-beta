const { expect } = require('chai');

describe('utils/index', () => {
  const utils = require('../../../lib/utils/index');

  it('should export all utility functions', () => {
    expect(utils).to.be.an('object');
    // 核心函数应该存在
    expect(utils.sleep).to.be.a('function');
    expect(utils.openBill).to.be.a('function');
    expect(utils.closeBill).to.be.a('function');
    expect(utils.dismissDialogs).to.be.a('function');
    expect(utils.cdpClick).to.be.a('function');
    expect(utils.getTableData).to.be.a('function');
    expect(utils.getTableRowCount).to.be.a('function');
    expect(utils.listAttachments).to.be.a('function');
    expect(utils.downloadAttachments).to.be.a('function');
    expect(utils.openSideMenu).to.be.a('function');
    expect(utils.clickDrawerItem).to.be.a('function');
    expect(utils.clickShowQuery).to.be.a('function');
    expect(utils.setDateRange).to.be.a('function');
    expect(utils.setTaxPeriod).to.be.a('function');
    expect(utils.clickPickerButton).to.be.a('function');
    expect(utils.pickFromDict).to.be.a('function');
    expect(utils.pickTaxSubject).to.be.a('function');
  });

  it('should mark functions with _source property', () => {
    expect(utils.sleep._source).to.equal('common');
    expect(utils.openBill._source).to.equal('bill');
    expect(utils.cdpClick._source).to.equal('cdp');
  });
});
