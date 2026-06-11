const { expect } = require('chai');

describe('ledgers/passenger-transport', () => {
  const ledger = require('../../../lib/ledgers/passenger-transport');

  it('should export exportPassengerTransportLedger function', () => {
    expect(ledger.exportPassengerTransportLedger).to.be.a('function');
  });
});
