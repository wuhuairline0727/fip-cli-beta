const { expect } = require('chai');

describe('audit/reporter', () => {
  const {
    generateTextReport,
    generateJsonReport,
    generateMarkdownReport,
  } = require('../../../lib/audit/reporter');

  describe('generateTextReport()', () => {
    it('should generate a text report with all checks', () => {
      const result = {
        invoice_no: 'KP20002026060500211',
        project_name: '测试项目',
        profit_center: '利润中心A',
        checks: {
          contract_match: { status: '通过', point: '合同金额核对', message: '金额匹配' },
          attachments: { status: '失败', point: '附件完整性', message: '缺少附件', action_needed: '补充附件' },
        },
        stats: { passed: 1, warning: 0, failed: 1, manual: 0, info: 0 },
      };
      const report = generateTextReport(result);
      expect(report).to.be.a('string');
      expect(report).to.include('合同金额核对');
      expect(report).to.include('附件完整性');
      expect(report).to.include('金额匹配');
    });

    it('should include separator lines', () => {
      const report = generateTextReport({
        invoice_no: 'KP001',
        checks: {},
        stats: { passed: 0, fail: 0, warn: 0, manual: 0, info: 0 },
      });
      expect(report).to.be.a('string');
      expect(report).to.include('='.repeat(80));
    });
  });

  describe('generateJsonReport()', () => {
    it('should generate a JSON report', () => {
      const result = {
        checks: [{ name: 'A', status: 'pass' }],
        summary: { pass: 1, fail: 0, warn: 0 },
      };
      const report = generateJsonReport(result);
      expect(report).to.be.a('string');
      const parsed = JSON.parse(report);
      expect(parsed.checks).to.be.an('array');
      expect(parsed.summary).to.be.an('object');
    });
  });

  describe('generateMarkdownReport()', () => {
    it('should generate a markdown report', () => {
      const result = {
        invoice_no: 'KP20002026060500211',
        project_name: '测试项目',
        profit_center: '利润中心A',
        checks: {
          contract_match: { status: '通过', point: '合同金额核对', message: 'OK' },
          approver: { status: '失败', point: '审批人', message: '未找到', action_needed: '确认审批人' },
        },
        stats: { passed: 1, warning: 0, failed: 1, manual: 0, info: 0 },
      };
      const report = generateMarkdownReport(result);
      expect(report).to.be.a('string');
      expect(report).to.include('#');
      expect(report).to.include('|');
      expect(report).to.include('合同金额核对');
    });
  });
});
