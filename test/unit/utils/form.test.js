const { expect } = require('chai');
const sinon = require('sinon');
const http = require('http');

describe('utils/form', () => {
  let httpRequestStub;
  let form;

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
    delete require.cache[require.resolve('../../../lib/utils/form')];
    form = require('../../../lib/utils/form');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should export form functions', () => {
    expect(form.clickShowQuery).to.be.a('function');
    expect(form.setDateRange).to.be.a('function');
    expect(form.setTaxPeriod).to.be.a('function');
  });
});
