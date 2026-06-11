const { expect } = require('chai');
const sinon = require('sinon');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('config', () => {
  let config;
  const homedir = os.homedir();
  const configFile = path.join(homedir, '.fiprc.json');

  beforeEach(() => {
    delete require.cache[require.resolve('../../lib/config')];
    config = require('../../lib/config');
  });

  describe('CONFIG_FILE', () => {
    it('should point to ~/.fiprc.json', () => {
      expect(config.CONFIG_FILE).to.equal(configFile);
    });
  });

  describe('get()', () => {
    it('should return default values when config file does not exist', () => {
      const result = config.get();
      expect(result).to.be.an('object');
      expect(result).to.have.property('companyCode');
      expect(result).to.have.property('taxCode');
      expect(result).to.have.property('startDate');
      expect(result).to.have.property('endDate');
      expect(result).to.have.property('startPeriod');
      expect(result).to.have.property('endPeriod');
    });

    it('should return specific key value', () => {
      const companyCode = config.get('companyCode');
      expect(companyCode).to.be.a('string');
    });

    it('should return undefined for unknown key', () => {
      const result = config.get('nonexistent_key');
      expect(result).to.be.undefined;
    });
  });

  describe('set()', () => {
    it('should validate companyCode format', () => {
      expect(() => config.set('companyCode', 'abc')).to.throw();
    });

    it('should accept valid companyCode', () => {
      expect(() => config.set('companyCode', '1000200020040011')).to.not.throw();
    });

    it('should validate startDate format', () => {
      expect(() => config.set('startDate', '2026/04/01')).to.throw();
    });

    it('should accept valid startDate', () => {
      expect(() => config.set('startDate', '2026-04-01')).to.not.throw();
    });

    it('should validate taxCode format', () => {
      expect(() => config.set('taxCode', 'short')).to.throw();
    });

    it('should validate period format', () => {
      expect(() => config.set('startPeriod', '2026/04')).to.throw();
    });

    it('should accept valid period', () => {
      expect(() => config.set('startPeriod', '2026-04')).to.not.throw();
    });

    it('should allow unknown keys without validation', () => {
      expect(() => config.set('customKey', 'anyValue')).to.not.throw();
    });
  });

  describe('loadConfig() / saveConfig()', () => {
    it('should export loadConfig function', () => {
      expect(config.loadConfig).to.be.a('function');
    });

    it('should export saveConfig function', () => {
      expect(config.saveConfig).to.be.a('function');
    });
  });
});
