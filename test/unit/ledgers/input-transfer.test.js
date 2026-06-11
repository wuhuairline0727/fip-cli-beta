const { expect } = require('chai');

describe('ledgers/input-transfer', () => {
  const ledger = require('../../../lib/ledgers/input-transfer');

  it('should export exportInputTransferLedger function', () => {
    expect(ledger.exportInputTransferLedger).to.be.a('function');
  });
});
