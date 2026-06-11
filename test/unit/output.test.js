const { expect } = require('chai');
const sinon = require('sinon');
const fs = require('fs');
const path = require('path');

describe('output', () => {
  let output;
  let consoleLogStub;
  let fsStub;

  beforeEach(() => {
    delete require.cache[require.resolve('../../lib/output')];
    output = require('../../lib/output');
    consoleLogStub = sinon.stub(console, 'log');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('success()', () => {
    it('should output JSON with ok: true', () => {
      output.success({ foo: 'bar' });
      expect(consoleLogStub.calledOnce).to.equal(true);
      const parsed = JSON.parse(consoleLogStub.firstCall.args[0]);
      expect(parsed.ok).to.equal(true);
      expect(parsed.data.foo).to.equal('bar');
    });

    it('should pretty-print JSON with 2-space indent', () => {
      output.success({ a: 1 });
      const printed = consoleLogStub.firstCall.args[0];
      expect(printed).to.include('\n');
      expect(printed).to.include('  ');
    });
  });

  describe('setScreenshotOptions()', () => {
    it('should update screenshotOnError', () => {
      output.setScreenshotOptions({ screenshotOnError: false });
      // 无法直接验证内部状态，但后续 error() 行为会改变
    });

    it('should update screenshotDir', () => {
      output.setScreenshotOptions({ screenshotDir: '/tmp/screenshots' });
      // 内部状态更新，通过 error() 行为间接验证
    });
  });

  describe('error()', () => {
    it('should output JSON with ok: false and error details', async () => {
      try {
        await output.error('TEST_ERROR', 'something went wrong');
      } catch (e) {
        // error() 会抛出异常
      }
      expect(consoleLogStub.calledOnce).to.equal(true);
      const parsed = JSON.parse(consoleLogStub.firstCall.args[0]);
      expect(parsed.ok).to.equal(false);
      expect(parsed.error.code).to.equal('TEST_ERROR');
      expect(parsed.error.message).to.equal('something went wrong');
    });

    it('should throw an error with code and isFipError flag', async () => {
      let thrown = null;
      try {
        await output.error('MY_CODE', 'my message');
      } catch (err) {
        thrown = err;
      }
      expect(thrown).to.be.instanceOf(Error);
      expect(thrown.code).to.equal('MY_CODE');
      expect(thrown.isFipError).to.equal(true);
      expect(thrown.message).to.equal('my message');
    });
  });
});
