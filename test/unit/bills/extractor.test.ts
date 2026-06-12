import { expect } from 'chai';
import {
  parseAmount,
  buildExtractionCode,
  postProcessYjk,
} from '../../../lib/bills/extractor';

describe('bills/extractor', () => {
  describe('parseAmount()', () => {
    it('should parse "1,234.56" to 1234.56', () => {
      expect(parseAmount('1,234.56')).to.equal(1234.56);
    });

    it('should parse "¥1,234.56" to 1234.56', () => {
      expect(parseAmount('¥1,234.56')).to.equal(1234.56);
    });

    it('should parse "￥1,234.56" to 1234.56', () => {
      expect(parseAmount('￥1,234.56')).to.equal(1234.56);
    });

    it('should return null for empty string', () => {
      expect(parseAmount('')).to.equal(null);
    });

    it('should return null for non-string input', () => {
      expect(parseAmount(null)).to.equal(null);
      expect(parseAmount(undefined)).to.equal(null);
      expect(parseAmount(1234.56 as any)).to.equal(null);
    });

    it('should return null for invalid number string', () => {
      expect(parseAmount('abc')).to.equal(null);
      expect(parseAmount('N/A')).to.equal(null);
    });
  });

  describe('buildExtractionCode()', () => {
    it('should return a string containing key code fragments', () => {
      const config = {
        name: '测试单据',
        basePatterns: {
          bill_no: /单据编号[：:]\s*(\S+)/,
        },
        inputFields: {
          project_name: { byLabel: '项目名称' },
        },
        tables: [
          {
            name: 'items',
            identifyBy: { headerText: '费用项目' },
            columns: [
              { header: '费用项目', field: 'item', type: 'string' },
              { header: '金额', field: 'amount', type: 'amount' },
            ],
          },
        ],
        auditHints: [],
      };

      const code = buildExtractionCode(config);
      expect(code).to.be.a('string');
      expect(code).to.include('(function()');
      expect(code).to.include('const result = {};');
      expect(code).to.include('parseCellAmount');
      expect(code).to.include('extractRowData');
      expect(code).to.include('isValidDataRow');
      expect(code).to.include('单据编号');
      expect(code).to.include('项目名称');
      expect(code).to.include('费用项目');
      expect(code).to.include('items');
      expect(code).to.include('attachments');
    });

    it('should handle empty config gracefully', () => {
      const code = buildExtractionCode({});
      expect(code).to.be.a('string');
      expect(code).to.include('(function()');
      expect(code).to.include('const result = {};');
    });
  });

  describe('postProcessYjk()', () => {
    it('should calculate tax rates based on vat_prepayment_6', () => {
      const data = {
        vat_prepayment_6: '1000.00',
        surcharge_prepayment: [
          {
            urban_maintenance_tax: '70.00',
            education_surcharge: '30.00',
            local_education_surcharge: '20.00',
            total_surcharge: '120.00',
          },
        ],
      };

      const result = postProcessYjk(data) as any;
      expect(
        result.surcharge_prepayment[0].urban_maintenance_tax_rate
      ).to.equal('7.00%');
      expect(result.surcharge_prepayment[0].education_surcharge_rate).to.equal(
        '3.00%'
      );
      expect(
        result.surcharge_prepayment[0].local_education_surcharge_rate
      ).to.equal('2.00%');
      expect(result.surcharge_prepayment[0].total_surcharge_rate).to.equal(
        '12.00%'
      );
      expect(result.surcharge_tax_rates['城市维护建设税']).to.equal('7.00%');
      expect(result.surcharge_tax_rates['教育费及附加']).to.equal('3.00%');
      expect(result.surcharge_tax_rates['地方教育费及附加']).to.equal('2.00%');
      expect(result.surcharge_tax_rates['合计']).to.equal('12.00%');
    });

    it('should skip rate calculation when vat_prepayment_6 is zero', () => {
      const data = {
        vat_prepayment_6: '0',
        surcharge_prepayment: [
          {
            urban_maintenance_tax: '70.00',
            education_surcharge: '30.00',
          },
        ],
      };

      const result = postProcessYjk(data) as any;
      expect(result.surcharge_prepayment[0].urban_maintenance_tax_rate).to.be
        .undefined;
      expect(result.surcharge_prepayment[0].education_surcharge_rate).to.be
        .undefined;
    });

    it('should skip rate calculation when vat_prepayment_6 is missing', () => {
      const data = {
        surcharge_prepayment: [
          {
            urban_maintenance_tax: '70.00',
          },
        ],
      };

      const result = postProcessYjk(data) as any;
      expect(result.surcharge_prepayment[0].urban_maintenance_tax_rate).to.be
        .undefined;
    });

    it('should include vat_summary and income_tax_summary', () => {
      const data = {
        vat_prepayment_6: '1000',
        prepayment_tax_rate_4: '3%',
        levy_rate_5: '2%',
        invoice_amount_1: '50000',
        subcontract_invoice_deduction_2: '10000',
        taxable_sales_3: '40000',
        is_income_tax_prepayment: '是',
        corporate_income_tax: '500',
        individual_income_tax: '200',
      };

      const result = postProcessYjk(data) as any;
      expect(result.vat_summary).to.deep.equal({
        vat_prepayment_6: '1000',
        prepayment_tax_rate_4: '3%',
        levy_rate_5: '2%',
        invoice_amount_1: '50000',
        subcontract_invoice_deduction_2: '10000',
        taxable_sales_3: '40000',
      });
      expect(result.income_tax_summary).to.deep.equal({
        is_prepayment: '是',
        corporate_tax: '500',
        individual_tax: '200',
      });
    });
  });
});
