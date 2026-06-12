import { expect } from 'chai';
import sinon from 'sinon';
const http = require('http');

describe('utils/cdp', () => {
  let httpRequestStub: sinon.SinonStub;
  let cdp: any;

  beforeEach(() => {
    httpRequestStub = sinon.stub(http, 'request').callsFake((options: any, callback: any) => {
      const req: any = {
        write: sinon.stub(),
        end: sinon.stub(),
        destroy: sinon.stub(),
        on: sinon.stub().callsFake((event: string, handler: any) => {
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
