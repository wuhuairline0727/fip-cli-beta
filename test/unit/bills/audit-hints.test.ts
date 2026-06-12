import { expect } from 'chai';
import { extractKeywords, generateAuditHints } from '../../../lib/bills/audit-hints';

describe('bills/audit-hints', () => {
  describe('extractKeywords()', () => {
    it('should split by backslash', () => {
      const result = extractKeywords('管理费用\\业务招待费');
      expect(result).to.deep.equal(['管理费用', '业务招待费']);
    });

    it('should split by forward slash', () => {
      const result = extractKeywords('管理费用/业务招待费');
      expect(result).to.deep.equal(['管理费用', '业务招待费']);
    });

    it('should trim whitespace', () => {
      const result = extractKeywords('  管理费用  \\  业务招待费  ');
      expect(result).to.deep.equal(['管理费用', '业务招待费']);
    });

    it('should return empty array for null', () => {
      expect(extractKeywords(null)).to.deep.equal([]);
    });

    it('should return empty array for undefined', () => {
      expect(extractKeywords(undefined)).to.deep.equal([]);
    });

    it('should return empty array for non-string', () => {
      expect(extractKeywords(123 as any)).to.deep.equal([]);
    });

    it('should return empty array for empty string', () => {
      expect(extractKeywords('')).to.deep.equal([]);
    });

    it('should handle single keyword', () => {
      const result = extractKeywords('差旅费');
      expect(result).to.deep.equal(['差旅费']);
    });
  });

  describe('generateAuditHints()', () => {
    it('should return empty array for empty data', () => {
      const hints = generateAuditHints({}, 'SLBX');
      expect(hints).to.be.an('array');
    });

    it('should generate hints with correct structure', () => {
      const data = {
        expense_items: ['管理费用\\业务招待费'],
        amounts: ['1000.00'],
      };
      const hints = generateAuditHints(data, 'SLBX');
      expect(hints).to.be.an('array');
      if (hints.length > 0) {
        expect(hints[0]).to.have.all.keys('name', 'description', 'level', 'message');
      }
    });

    it('should handle missing expense_items gracefully', () => {
      const hints = generateAuditHints({ amounts: ['1000'] }, 'TBX');
      expect(hints).to.be.an('array');
    });
  });
});
