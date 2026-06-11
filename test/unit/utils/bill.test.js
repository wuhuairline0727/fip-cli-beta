const { expect } = require('chai');
const sinon = require('sinon');
const http = require('http');

describe('utils/bill', () => {
  let httpRequestStub;
  let bill;

  beforeEach(() => {
    httpRequestStub = sinon.stub(http, 'request').callsFake((options, callback) => {
      const req = {
        write: sinon.stub(),
        end: sinon.stub(),
        destroy: sinon.stub(),
        on: sinon.stub().callsFake((event, handler) => {
          if (event === 'error') {
            setImmediate(() => handler(new Error('connect ECONNREFUSED 127.0.0.1:10086')));
          }
          return req;
        }),
      };
      return req;
    });
    delete require.cache[require.resolve('../../../lib/browser')];
    delete require.cache[require.resolve('../../../lib/utils/bill')];
    bill = require('../../../lib/utils/bill');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should export bill functions', () => {
    expect(bill.openBill).to.be.a('function');
    expect(bill.closeBill).to.be.a('function');
  });
});
