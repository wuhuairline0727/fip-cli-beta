import { expect } from 'chai';
import sinon from 'sinon';

describe('audit/engine', () => {
  let engine: any;

  beforeEach(() => {
    delete require.cache[require.resolve('../../../lib/audit/engine')];
    delete require.cache[require.resolve('../../../lib/config')];
    engine = require('../../../lib/audit/engine');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('loadRules()', () => {
    it('should load rules from rules.json if exists', () => {
      const rules = engine.loadRules();
      expect(rules).to.be.an('object');
      expect(rules).to.have.property('check_order');
      expect(rules.check_order).to.be.an('array');
    });

    it('should have fallback rules if rules.json missing', () => {
      const rules = engine.loadRules();
      expect(rules).to.have.property('profit_center_mapping');
      expect(rules).to.have.property('warning_threshold');
      expect(rules).to.have.property('expected_approver');
      expect(rules).to.have.property('tax_rate_expected');
    });
  });

  describe('exported functions', () => {
    it('should export all expected functions', () => {
      expect(engine.audit).to.be.a('function');
      expect(engine.parseAmount).to.be.a('function');
      expect(engine.formatAmount).to.be.a('function');
      expect(engine.getBillingUnit).to.be.a('function');
      expect(engine.calculateDerivedValues).to.be.a('function');
      expect(engine.performChecks).to.be.a('function');
      expect(engine.checkAttachments).to.be.a('function');
      expect(engine.loadRules).to.be.a('function');
    });
  });

  describe('parseAmount()', () => {
    it('should parse amount strings correctly', () => {
      expect(engine.parseAmount('1,234.56')).to.equal(1234.56);
      expect(engine.parseAmount('¥1,234.56')).to.equal(1234.56);
      expect(engine.parseAmount('0')).to.equal(0);
    });

    it('should return 0 for invalid input', () => {
      expect(engine.parseAmount('')).to.equal(0);
      expect(engine.parseAmount(null)).to.equal(0);
    });
  });
});
