import { expect } from 'chai';
import sinon from 'sinon';
import type { ClientRequest } from 'http';
const http = require('http');

describe('browser', () => {
  let httpRequestStub: sinon.SinonStub;

  beforeEach(() => {
    // 清除可能由其他测试注入的模块缓存
    delete require.cache[require.resolve('../../lib/browser')];
    // 模拟 http.request 在未连接时抛出错误
    httpRequestStub = sinon
      .stub(http, 'request')
      .callsFake((options, callback) => {
        const req = {
          write: sinon.stub(),
          end: sinon.stub(),
          destroy: sinon.stub(),
          on: sinon
            .stub()
            .callsFake((event: string, handler: (err: Error) => void) => {
              if (event === 'error') {
                // 模拟连接失败
                setImmediate(() =>
                  handler(new Error('connect ECONNREFUSED 127.0.0.1:10086'))
                );
              }
              return req;
            }),
        };
        return req as unknown as ClientRequest;
      });
  });

  afterEach(() => {
    sinon.restore();
    // 清除模块缓存，确保每次 require 都是新的
    delete require.cache[require.resolve('../../lib/browser')];
  });

  describe('checkConnection()', () => {
    it('should return false when WebBridge is not connected', async () => {
      const { checkConnection } = require('../../lib/browser');
      const result = await checkConnection();
      expect(result).to.equal(false);
    });
  });

  describe('ensureConnection()', () => {
    it('should throw error with code WEBBRIDGE_NOT_CONNECTED when not connected', async () => {
      const { ensureConnection } = require('../../lib/browser');
      try {
        await ensureConnection();
        expect.fail('should have thrown');
      } catch (err: any) {
        expect(err).to.be.instanceOf(Error);
        expect(err.code).to.equal('WEBBRIDGE_NOT_CONNECTED');
        expect(err.message).to.include('Kimi WebBridge 未连接');
      }
    });
  });
});
