import * as utils from './utils/index';
import * as unbilledIncome from './ledgers/unbilled-income';
import * as inputTransfer from './ledgers/input-transfer';
import * as outputInvoice from './ledgers/output-invoice';
import * as vatPrepayment from './ledgers/vat-prepayment';
import * as passengerTransport from './ledgers/passenger-transport';
import { extractInvoiceFields } from './audit/extractor';
import { audit } from './audit/engine';
import {
  generateTextReport,
  generateJsonReport,
  generateMarkdownReport,
} from './audit/reporter';
import { extractBill } from './bills/extractor';
import { generateAuditHints } from './bills/audit-hints';
import { ensureConnection } from './browser';

export = {
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
