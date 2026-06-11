const { expect } = require('chai');
const sinon = require('sinon');
const fs = require('fs');
const path = require('path');

describe('logger', () => {
  let logger;
  let appendFileSyncStub;
  let consoleErrorStub;
  const logFile = path.join(process.cwd(), 'fip-debug.log');

  beforeEach(() => {
    // 清除模块缓存
    delete require.cache[require.resolve('../../lib/logger')];
    logger = require('../../lib/logger');
    appendFileSyncStub = sinon.stub(fs, 'appendFileSync');
    consoleErrorStub = sinon.stub(console, 'error');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('setDebug() / setVerbose()', () => {
    it('should enable debug mode', () => {
      logger.setDebug(true);
      logger.debug('test message');
      expect(consoleErrorStub.calledOnce).to.equal(true);
      expect(consoleErrorStub.firstCall.args[0]).to.include('[DEBUG]');
      expect(consoleErrorStub.firstCall.args[0]).to.include('test message');
    });

    it('should not output debug when disabled', () => {
      logger.setDebug(false);
      logger.debug('test message');
      expect(consoleErrorStub.called).to.equal(false);
    });

    it('should enable verbose mode', () => {
      logger.setVerbose(true);
      logger.verbose('verbose message');
      expect(consoleErrorStub.calledOnce).to.equal(true);
      expect(consoleErrorStub.firstCall.args[0]).to.include('[INFO]');
    });

    it('should output verbose when debug mode is on (verbose inherits debug)', () => {
      logger.setDebug(true);
      logger.setVerbose(false);
      logger.verbose('verbose message');
      expect(consoleErrorStub.calledOnce).to.equal(true);
    });

    it('should not output verbose when both modes are off', () => {
      logger.setDebug(false);
      logger.setVerbose(false);
      logger.verbose('verbose message');
      expect(consoleErrorStub.called).to.equal(false);
    });
  });

  describe('debug()', () => {
    it('should write to fip-debug.log when debug is enabled', () => {
      logger.setDebug(true);
      logger.debug('log this');
      expect(appendFileSyncStub.calledOnce).to.equal(true);
      expect(appendFileSyncStub.firstCall.args[0]).to.equal(logFile);
      expect(appendFileSyncStub.firstCall.args[1]).to.include('log this');
    });

    it('should include ISO timestamp in debug output', () => {
      logger.setDebug(true);
      const before = new Date().toISOString().slice(0, 16);
      logger.debug('timestamp test');
      const output = consoleErrorStub.firstCall.args[0];
      expect(output).to.include('[DEBUG]');
      expect(output).to.include(before);
    });
  });

  describe('verbose()', () => {
    it('should write to fip-debug.log when verbose is enabled', () => {
      logger.setVerbose(true);
      logger.verbose('verbose log');
      expect(appendFileSyncStub.calledOnce).to.equal(true);
      expect(appendFileSyncStub.firstCall.args[0]).to.equal(logFile);
    });
  });
});
