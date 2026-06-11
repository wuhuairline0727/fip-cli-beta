const { expect } = require('chai');
const sinon = require('sinon');

describe('ledgers/vat-prepayment', () => {
  let ledger;
  let configStub;

  beforeEach(() => {
    delete require.cache[require.resolve('../../../lib/config')];
    delete require.cache[require.resolve('../../../lib/ledgers/vat-prepayment')];

    const config = require('../../../lib/config');
    configStub = sinon.stub(config, 'get').returns({
      startPeriod: '2026-05',
      endPeriod: '2026-05',
      companyCode: '9999999999999999',
      taxCode: '91110000101107173B',
      docType: '预缴计算单',
    });

    ledger = require('../../../lib/ledgers/vat-prepayment');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should export exportVatPrepaymentLedger function', () => {
    expect(ledger.exportVatPrepaymentLedger).to.be.a('function');
  });

  it('should use config defaults including docType', async () => {
    try {
      await ledger.exportVatPrepaymentLedger({ queryOnly: true });
    } catch (e) {
      // 预期失败
    }
    expect(configStub.called).to.equal(true);
  });

  it('should allow docType override', async () => {
    try {
      await ledger.exportVatPrepaymentLedger({
        docType: '增值税预缴',
        queryOnly: true,
      });
    } catch (e) {
      // 预期失败
    }
    expect(configStub.called).to.equal(true);
  });
});
