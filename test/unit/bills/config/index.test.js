const { expect } = require('chai');

describe('bills/config/index', () => {
  const { detectBillType, getBillConfig, BILL_TYPE_MAP } = require('../../../../lib/bills/config/index');

  describe('detectBillType()', () => {
    it('should identify SLBX from bill number', () => {
      const type = detectBillType('SLBX2004202605003766');
      expect(type).to.equal('SLBX');
    });

    it('should identify TBX from bill number', () => {
      const type = detectBillType('TBX2004202605003766');
      expect(type).to.equal('TBX');
    });

    it('should identify CFK from bill number', () => {
      const type = detectBillType('CFK2004202605003766');
      expect(type).to.equal('CFK');
    });

    it('should identify CBX from bill number', () => {
      const type = detectBillType('CBX2004202605003766');
      expect(type).to.equal('CBX');
    });

    it('should identify YJK from bill number', () => {
      const type = detectBillType('YJK20042026061003638');
      expect(type).to.equal('YJK');
    });

    it('should return null for unknown prefix', () => {
      const type = detectBillType('UNKNOWN123');
      expect(type).to.equal(null);
    });

    it('should return null for empty string', () => {
      const type = detectBillType('');
      expect(type).to.equal(null);
    });

    it('should return null for non-string', () => {
      expect(detectBillType(null)).to.equal(null);
      expect(detectBillType(123)).to.equal(null);
    });
  });

  describe('getBillConfig()', () => {
    it('should load SLBX config', () => {
      const config = getBillConfig('SLBX');
      expect(config).to.be.an('object');
      expect(config.name).to.equal('境内差旅报销单');
      expect(config).to.have.property('basePatterns');
      expect(config).to.have.property('inputFields');
      expect(config).to.have.property('tables');
      expect(config).to.have.property('filterConfig');
    });

    it('should load TBX config', () => {
      const config = getBillConfig('TBX');
      expect(config).to.be.an('object');
      expect(config.name).to.equal('通用报销单');
    });

    it('should load CFK config', () => {
      const config = getBillConfig('CFK');
      expect(config).to.be.an('object');
      expect(config.name).to.equal('对外成本费用付款申请');
    });

    it('should load CBX config', () => {
      const config = getBillConfig('CBX');
      expect(config).to.be.an('object');
      expect(config.name).to.equal('差旅费报销');
    });

    it('should load YJK config', () => {
      const config = getBillConfig('YJK');
      expect(config).to.be.an('object');
      expect(config.name).to.equal('预缴计算单');
    });

    it('should return null for unknown type', () => {
      expect(getBillConfig('UNKNOWN')).to.equal(null);
    });

    it('should return null for empty string', () => {
      expect(getBillConfig('')).to.equal(null);
    });
  });

  describe('BILL_TYPE_MAP', () => {
    it('should contain all supported types', () => {
      expect(BILL_TYPE_MAP).to.have.all.keys('SLBX', 'TBX', 'CFK', 'CBX', 'YJK');
    });
  });
});
