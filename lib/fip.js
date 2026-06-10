const utils = require('./utils/index');
const unbilledIncome = require('./ledgers/unbilled-income');
const inputTransfer = require('./ledgers/input-transfer');
const outputInvoice = require('./ledgers/output-invoice');
const vatPrepayment = require('./ledgers/vat-prepayment');
const passengerTransport = require('./ledgers/passenger-transport');
const { extractInvoiceFields } = require('./audit/extractor');
const { audit } = require('./audit/engine');
const {
  generateTextReport,
  generateJsonReport,
  generateMarkdownReport,
} = require('./audit/reporter');
const { extractBill } = require('./bills/extractor');
const { generateAuditHints } = require('./bills/audit-hints');
const { ensureConnection } = require('./browser');

module.exports = {
  ...utils,
  exportUnbilledIncomeLedger: unbilledIncome.exportUnbilledIncomeLedger,
  exportInputTransferLedger: inputTransfer.exportInputTransferLedger,
  exportOutputInvoiceLedger: outputInvoice.exportOutputInvoiceLedger,
  exportVatPrepaymentLedger: vatPrepayment.exportVatPrepaymentLedger,
  exportPassengerTransportLedger:
    passengerTransport.exportPassengerTransportLedger,
  extractInvoiceFields,
  auditInvoice: audit,
  generateAuditTextReport: generateTextReport,
  generateAuditJsonReport: generateJsonReport,
  generateAuditMarkdownReport: generateMarkdownReport,
  extractBill,
  generateBillAuditHints: generateAuditHints,
  ensureConnection,
};
