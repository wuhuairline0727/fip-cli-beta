import { expect } from 'chai';
import * as extractor from '../../../lib/audit/extractor';

describe('audit/extractor', () => {
  it('should export extractInvoiceFields function', () => {
    expect(extractor.extractInvoiceFields).to.be.a('function');
  });

  it('should export extractFromInputs function', () => {
    expect(extractor.extractFromInputs).to.be.a('function');
  });
});
