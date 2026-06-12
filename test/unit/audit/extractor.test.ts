import { expect } from 'chai';

describe('audit/extractor', () => {
  const extractor = require('../../../lib/audit/extractor');

  it('should export extractInvoiceFields function', () => {
    expect(extractor.extractInvoiceFields).to.be.a('function');
  });

  it('should export extractFromInputs function', () => {
    expect(extractor.extractFromInputs).to.be.a('function');
  });
});
