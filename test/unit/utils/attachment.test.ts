import { expect } from 'chai';
import sinon from 'sinon';
import type { ClientRequest } from 'http';
const http = require('http');

describe('utils/attachment', () => {
  let attachment: any;

  beforeEach(() => {
    sinon.stub(http, 'request').callsFake((_options: any, _callback: any) => {
      const req = {
        write: sinon.stub(),
        end: sinon.stub(),
        destroy: sinon.stub(),
        on: sinon
          .stub()
          .callsFake((event: string, handler: (err: Error) => void) => {
            if (event === 'error') {
              setImmediate(() =>
                handler(new Error('connect ECONNREFUSED 127.0.0.1:10086'))
              );
            }
            return req;
          }),
      };
      return req as unknown as ClientRequest;
    });
    delete require.cache[require.resolve('../../../lib/browser')];
    delete require.cache[require.resolve('../../../lib/utils/attachment')];
    attachment = require('../../../lib/utils/attachment');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should export attachment functions', () => {
    expect(attachment.listAttachments).to.be.a('function');
    expect(attachment.downloadAttachments).to.be.a('function');
  });
});
