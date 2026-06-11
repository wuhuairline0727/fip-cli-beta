const { expect } = require('chai');

describe('fip', () => {
  const fip = require('../../lib/fip');

  it('should export all utility functions from utils/index', () => {
    expect(fip.sleep).to.be.a('function');
    expect(fip.openBill).to.be.a('function');
    expect(fip.closeBill).to.be.a('function');
    expect(fip.dismissDialogs).to.be.a('function');
    expect(fip.getTableData).to.be.a('function');
    expect(fip.getTableRowCount).to.be.a('function');
    expect(fip.listAttachments).to.be.a('function');
    expect(fip.downloadAttachments).to.be.a('function');
  });

  it('should export ledger functions', () => {
    expect(fip.exportUnbilledIncomeLedger).to.be.a('function');
    expect(fip.exportInputTransferLedger).to.be.a('function');
    expect(fip.exportOutputInvoiceLedger).to.be.a('function');
    expect(fip.exportVatPrepaymentLedger).to.be.a('function');
    expect(fip.exportPassengerTransportLedger).to.be.a('function');
  });

  it('should export audit functions', () => {
    expect(fip.extractInvoiceFields).to.be.a('function');
    expect(fip.auditInvoice).to.be.a('function');
    expect(fip.generateAuditTextReport).to.be.a('function');
    expect(fip.generateAuditJsonReport).to.be.a('function');
    expect(fip.generateAuditMarkdownReport).to.be.a('function');
  });

  it('should export bill functions', () => {
    expect(fip.extractBill).to.be.a('function');
    expect(fip.generateBillAuditHints).to.be.a('function');
  });

  it('should export browser connection function', () => {
    expect(fip.ensureConnection).to.be.a('function');
  });
});
