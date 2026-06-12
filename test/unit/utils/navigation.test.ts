import { expect } from 'chai';
import sinon from 'sinon';
const http = require('http');

describe('utils/navigation', () => {
  let httpRequestStub: sinon.SinonStub;
  let navigation: any;

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
    delete require.cache[require.resolve('../../../lib/utils/navigation')];
    navigation = require('../../../lib/utils/navigation');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should export navigation functions', () => {
    expect(navigation.openSideMenu).to.be.a('function');
    expect(navigation.clickDrawerItem).to.be.a('function');
  });
});
