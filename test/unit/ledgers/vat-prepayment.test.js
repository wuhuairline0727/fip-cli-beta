const { expect } = require('chai');

describe('ledgers/vat-prepayment', () => {
  const ledger = require('../../../lib/ledgers/vat-prepayment');

  it('should export exportVatPrepaymentLedger function', () => {
    expect(ledger.exportVatPrepaymentLedger).to.be.a('function');
  });
});
