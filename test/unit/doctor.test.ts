import { expect } from 'chai';
import {
  checkNodeVersion,
  checkDependencies,
  generateReport,
  generateJsonReport,
} from '../../lib/doctor';

describe('doctor', () => {
  describe('checkNodeVersion()', () => {
    it('should return ok status for current Node version >= 20', () => {
      const result = checkNodeVersion();
      expect(result).to.be.an('object');
      expect(result.name).to.equal('Node.js 版本');
      expect(result.status).to.equal('ok');
      expect(result.message).to.include(process.version);
      expect(result.message).to.include('20');
    });
  });

  describe('checkDependencies()', () => {
    it('should return ok status when node_modules exists', () => {
      const result = checkDependencies();
      expect(result).to.be.an('object');
      expect(result.name).to.equal('项目依赖');
      expect(result.status).to.equal('ok');
      expect(result.message).to.include('commander');
      expect(result.message).to.include('chrome-remote-interface');
    });
  });

  describe('generateReport()', () => {
    it('should return a formatted string report', () => {
      const checks = [
        { name: 'Node.js 版本', status: 'ok' as const, message: 'v20 ok' },
        { name: '项目依赖', status: 'ok' as const, message: 'installed' },
      ];
      const report = generateReport(checks);
      expect(report).to.be.a('string');
      expect(report).to.include('FIP CLI 诊断报告');
      expect(report).to.include('Node.js 版本');
      expect(report).to.include('项目依赖');
      expect(report).to.include('所有检查通过');
    });

    it('should count errors and warnings correctly', () => {
      const checks = [
        { name: 'A', status: 'error' as const, message: 'bad', fix: 'do something' },
        { name: 'B', status: 'warn' as const, message: 'meh', fix: 'do else' },
        { name: 'C', status: 'ok' as const, message: 'good' },
      ];
      const report = generateReport(checks);
      expect(report).to.include('1 个错误');
      expect(report).to.include('1 个警告');
      expect(report).to.include('建议按以下顺序修复');
    });
  });

  describe('generateJsonReport()', () => {
    it('should return a JSON report object', () => {
      const checks = [
        { name: 'Node.js 版本', status: 'ok' as const, message: 'v20 ok' },
        { name: '项目依赖', status: 'ok' as const, message: 'installed' },
        { name: 'WebBridge', status: 'error' as const, message: 'down', fix: 'start' },
      ];
      const report = generateJsonReport(checks);
      expect(report).to.be.an('object');
      expect(report.healthy).to.equal(false);
      expect(report.summary).to.deep.equal({ ok: 2, warn: 0, error: 1, skip: 0 });
      expect(report.checks).to.deep.equal(checks);
      expect(report.timestamp).to.be.a('string');
      expect(new Date(report.timestamp).toISOString()).to.equal(report.timestamp);
    });

    it('should mark healthy when no errors', () => {
      const checks = [
        { name: 'A', status: 'ok' as const, message: 'good' },
        { name: 'B', status: 'warn' as const, message: 'meh' },
      ];
      const report = generateJsonReport(checks);
      expect(report.healthy).to.equal(true);
      expect(report.summary).to.deep.equal({ ok: 1, warn: 1, error: 0, skip: 0 });
    });
  });
});
