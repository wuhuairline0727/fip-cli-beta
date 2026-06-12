import { expect } from 'chai';
import sinon from 'sinon';
const http = require('http');

describe('utils/common', () => {
  let httpRequestStub: sinon.SinonStub;
  let common: any;

  beforeEach(() => {
    httpRequestStub = sinon
      .stub(http, 'request')
      .callsFake((options: any, callback: any) => {
        const req: any = {
          write: sinon.stub(),
          end: sinon.stub(),
          destroy: sinon.stub(),
          on: sinon.stub().callsFake((event: string, handler: any) => {
            if (event === 'error') {
              setImmediate(() =>
                handler(new Error('connect ECONNREFUSED 127.0.0.1:10086'))
              );
            }
            return req;
          }),
        };
        return req;
      });
    delete require.cache[require.resolve('../../../lib/browser')];
    delete require.cache[require.resolve('../../../lib/utils/common')];
    common = require('../../../lib/utils/common');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('sleep()', () => {
    it('should resolve after specified milliseconds', async () => {
      const start = Date.now();
      await common.sleep(50);
      const elapsed = Date.now() - start;
      expect(elapsed).to.be.at.least(45);
    });
  });

  describe('exported functions', () => {
    it('should export all expected functions', () => {
      expect(common.sleep).to.be.a('function');
      expect(common.findVisibleElementByText).to.be.a('function');
      expect(common.getPageInfo).to.be.a('function');
      expect(common.clickDashboardTab).to.be.a('function');
      expect(common.clickQueryButton).to.be.a('function');
      expect(common.getTableRowCount).to.be.a('function');
      expect(common.waitForElement).to.be.a('function');
      expect(common.waitForPopup).to.be.a('function');
      expect(common.waitForUrl).to.be.a('function');
    });
  });
});
