import { expect } from 'chai';
import fip from '../../lib/fip';

const fipAny: any = fip;

describe('fip', () => {
  it('should export all utility functions from utils/index', () => {
    expect(fipAny.sleep).to.be.a('function');
    expect(fipAny.openBill).to.be.a('function');
    expect(fipAny.closeBill).to.be.a('function');
    expect(fipAny.dismissDialogs).to.be.a('function');
    expect(fipAny.getTableData).to.be.a('function');
    expect(fipAny.getTableRowCount).to.be.a('function');
    expect(fipAny.listAttachments).to.be.a('function');
    expect(fipAny.downloadAttachments).to.be.a('function');
  });

  it('should export ledger functions', () => {
    expect(fipAny.exportUnbilledIncomeLedger).to.be.a('function');
    expect(fipAny.exportInputTransferLedger).to.be.a('function');
    expect(fipAny.exportOutputInvoiceLedger).to.be.a('function');
    expect(fipAny.exportVatPrepaymentLedger).to.be.a('function');
    expect(fipAny.exportPassengerTransportLedger).to.be.a('function');
  });

  it('should export audit functions', () => {
    expect(fipAny.extractInvoiceFields).to.be.a('function');
    expect(fipAny.auditInvoice).to.be.a('function');
    expect(fipAny.generateAuditTextReport).to.be.a('function');
    expect(fipAny.generateAuditJsonReport).to.be.a('function');
    expect(fipAny.generateAuditMarkdownReport).to.be.a('function');
  });

  it('should export bill functions', () => {
    expect(fipAny.extractBill).to.be.a('function');
    expect(fipAny.generateBillAuditHints).to.be.a('function');
  });

  it('should export browser connection function', () => {
    expect(fipAny.ensureConnection).to.be.a('function');
  });
});
