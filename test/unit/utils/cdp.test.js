const { expect } = require('chai');
const sinon = require('sinon');
const http = require('http');

describe('utils/cdp', () => {
  let httpRequestStub;
  let cdp;

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
    delete require.cache[require.resolve('../../../lib/utils/cdp')];
    cdp = require('../../../lib/utils/cdp');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should export CDP functions', () => {
    expect(cdp.withCDP).to.be.a('function');
    expect(cdp.cdpClick).to.be.a('function');
    expect(cdp.cdpEvaluate).to.be.a('function');
    expect(cdp.cdpEvaluateAndClick).to.be.a('function');
  });
});
