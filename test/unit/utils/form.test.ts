import { expect } from 'chai';
import sinon from 'sinon';
const http = require('http');

describe('utils/form', () => {
  let httpRequestStub: sinon.SinonStub;
  let form: any;

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
