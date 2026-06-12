import { expect } from 'chai';

describe('bills/config/* - 各单据类型配置结构验证', () => {
  const configs = [
    { type: 'SLBX', file: 'domestic-travel', name: '境内差旅报销单' },
    { type: 'TBX', file: 'general-expense', name: '通用报销单' },
    { type: 'CFK', file: 'external-payment', name: '对外成本费用付款申请' },
    { type: 'CBX', file: 'travel-expense', name: '差旅费报销' },
    { type: 'YJK', file: 'yjk', name: '预缴计算单' },
  ];

  for (const { type, file, name } of configs) {
    describe(`${type} (${name})`, () => {
      const config = require(`../../../../lib/bills/config/${file}`);

      it('should export a config object', () => {
        expect(config).to.be.an('object');
      });

      it('should have basePatterns object', () => {
        expect(config.basePatterns).to.be.an('object');
      });

      it('should have inputFields object', () => {
        expect(config.inputFields).to.be.an('object');
      });

      it('should have tables array', () => {
        expect(config.tables).to.be.an('array');
      });

      it('should have valid table configurations', () => {
        for (const table of config.tables) {
          expect(table).to.have.property('name');
          expect(table).to.have.property('identifyBy');
          expect(table).to.have.property('columns');
          expect(table.columns).to.be.an('array');
          for (const col of table.columns) {
            expect(col).to.have.property('header');
            expect(col).to.have.property('field');
          }
        }
      });
    });
  }
});
