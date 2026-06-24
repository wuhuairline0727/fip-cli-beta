import { expect } from 'chai';
import {
  CONFIG_SCHEMA,
  validateConfigValue,
  validateConfig,
} from '../../lib/config-schema';

describe('config-schema', () => {
  describe('validateConfigValue()', () => {
    it('should return null for valid companyCode', () => {
      const result = validateConfigValue('companyCode', '00000000000000000000');
      expect(result).to.equal(null);
    });

    it('should return error message for invalid companyCode', () => {
      const result = validateConfigValue('companyCode', 'abc');
      expect(result).to.equal('公司代码应为纯数字');
    });

    it('should return null for valid startDate', () => {
      const result = validateConfigValue('startDate', '2026-04-01');
      expect(result).to.equal(null);
    });

    it('should return error message for invalid startDate', () => {
      const result = validateConfigValue('startDate', '2026/04/01');
      expect(result).to.equal('日期格式应为 YYYY-MM-DD');
    });

    it('should return null for unknown key', () => {
      const result = validateConfigValue('unknownKey', 'anything');
      expect(result).to.equal(null);
    });

    it('should return null for empty value', () => {
      expect(validateConfigValue('companyCode', '')).to.equal(null);
      expect(validateConfigValue('companyCode', null)).to.equal(null);
      expect(validateConfigValue('companyCode', undefined)).to.equal(null);
    });

    it('should validate taxCode format', () => {
      expect(validateConfigValue('taxCode', 'YYYYYYYYYYYYYYYYYY')).to.equal(
        null
      );
      expect(validateConfigValue('taxCode', 'short')).to.equal(
        '税号应为15-20位字母数字'
      );
    });

    it('should validate sellerCode format', () => {
      expect(validateConfigValue('sellerCode', 'YYYYYYYYYYYYYYYYYY')).to.equal(
        null
      );
      expect(validateConfigValue('sellerCode', 'invalid')).to.equal(
        '销方税号应为15-20位字母数字'
      );
    });

    it('should validate period format', () => {
      expect(validateConfigValue('startPeriod', '2026-04')).to.equal(null);
      expect(validateConfigValue('endPeriod', '2026-04')).to.equal(null);
      expect(validateConfigValue('startPeriod', '2026/04')).to.equal(
        '期间格式应为 YYYY-MM'
      );
    });
  });

  describe('validateConfig()', () => {
    it('should return empty array for valid config', () => {
      const config = {
        companyCode: '00000000000000000000',
        taxCode: 'YYYYYYYYYYYYYYYYYY',
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        startPeriod: '2026-04',
        endPeriod: '2026-04',
      };
      const errors = validateConfig(config);
      expect(errors).to.deep.equal([]);
    });

    it('should return errors for invalid config', () => {
      const config = {
        companyCode: 'abc',
        taxCode: 'short',
        startDate: '2026/04/01',
        endDate: '2026-04-30',
        startPeriod: '2026-04',
        endPeriod: '2026/04',
      };
      const errors = validateConfig(config);
      expect(errors).to.include('公司代码应为纯数字');
      expect(errors).to.include('税号应为15-20位字母数字');
      expect(errors).to.include('日期格式应为 YYYY-MM-DD');
      expect(errors).to.include('期间格式应为 YYYY-MM');
    });

    it('should skip unknown keys', () => {
      const config = {
        companyCode: '00000000000000000000',
        unknownKey: 'anything',
      };
      const errors = validateConfig(config);
      expect(errors).to.deep.equal([]);
    });

    it('should skip empty values', () => {
      const config = {
        companyCode: '',
        taxCode: null,
        startDate: undefined,
      };
      const errors = validateConfig(config);
      expect(errors).to.deep.equal([]);
    });
  });

  describe('CONFIG_SCHEMA', () => {
    it('should contain expected keys', () => {
      expect(CONFIG_SCHEMA).to.have.all.keys(
        'companyCode',
        'taxCode',
        'startDate',
        'endDate',
        'startPeriod',
        'endPeriod',
        'docStatus',
        'voidStatus',
        'docType',
        'sellerCode'
      );
    });
  });
});
