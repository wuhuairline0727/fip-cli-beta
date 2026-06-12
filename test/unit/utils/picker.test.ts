import { expect } from 'chai';
import sinon from 'sinon';
const http = require('http');

describe('utils/picker', () => {
  let picker: any;

  beforeEach(() => {
    sinon.stub(http, 'request').callsFake((_options: any, _callback: any) => {
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
    delete require.cache[require.resolve('../../../lib/utils/picker')];
    picker = require('../../../lib/utils/picker');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should export picker functions', () => {
    expect(picker.clickPickerButton).to.be.a('function');
    expect(picker.pickFromDict).to.be.a('function');
    expect(picker.pickTaxSubject).to.be.a('function');
  });
});
