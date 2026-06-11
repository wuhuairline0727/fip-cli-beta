const { expect } = require('chai');

describe('ledgers/output-invoice', () => {
  const ledger = require('../../../lib/ledgers/output-invoice');

  it('should export exportOutputInvoiceLedger function', () => {
    expect(ledger.exportOutputInvoiceLedger).to.be.a('function');
  });
});
