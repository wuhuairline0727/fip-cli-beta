import { expect } from 'chai';
import * as ledger from '../../../lib/ledgers/unbilled-income';

describe('ledgers/unbilled-income', () => {

  describe('periodToDateRange()', () => {
    it('should convert 2026-04 to date range starting from Jan 1', () => {
      const result = ledger.periodToDateRange('2026-04');
      expect(result).to.deep.equal({
        startDate: '2026-01-01',
        endDate: '2026-04-30',
      });
    });

    it('should handle February in leap year', () => {
      const result = ledger.periodToDateRange('2024-02');
      expect(result).to.deep.equal({
        startDate: '2024-01-01',
        endDate: '2024-02-29',
      });
    });

    it('should handle February in non-leap year', () => {
      const result = ledger.periodToDateRange('2023-02');
      expect(result).to.deep.equal({
        startDate: '2023-01-01',
        endDate: '2023-02-28',
      });
    });

    it('should handle December', () => {
      const result = ledger.periodToDateRange('2026-12');
      expect(result).to.deep.equal({
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      });
    });

    it('should return null for invalid format', () => {
      expect(ledger.periodToDateRange('2026/04')).to.equal(null);
      expect(ledger.periodToDateRange('2026')).to.equal(null);
      expect(ledger.periodToDateRange('')).to.equal(null);
      expect(ledger.periodToDateRange(null)).to.equal(null);
    });
  });

  it('should export exportUnbilledIncomeLedger function', () => {
    expect(ledger.exportUnbilledIncomeLedger).to.be.a('function');
  });
});
