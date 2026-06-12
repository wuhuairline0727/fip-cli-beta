import * as utils from './utils/index';
import * as orgCache from './utils/organization-cache';
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
import { ensureConnection, checkConnection } from './browser';

// 重导出 utils 的所有命名导出
export * from './utils/index';

// 命名导出（方便单独导入和 tree-shaking）
export { extractInvoiceFields };
export { audit };
export { generateTextReport, generateJsonReport, generateMarkdownReport };
export { extractBill };
export { generateAuditHints };
export { ensureConnection, checkConnection };

export const exportUnbilledIncomeLedger = unbilledIncome.exportUnbilledIncomeLedger;
export const exportInputTransferLedger = inputTransfer.exportInputTransferLedger;
export const exportOutputInvoiceLedger = outputInvoice.exportOutputInvoiceLedger;
export const exportVatPrepaymentLedger = vatPrepayment.exportVatPrepaymentLedger;
export const exportPassengerTransportLedger = passengerTransport.exportPassengerTransportLedger;
export const auditInvoice = audit;
export const generateAuditTextReport = generateTextReport;
export const generateAuditJsonReport = generateJsonReport;
export const generateAuditMarkdownReport = generateMarkdownReport;
export const generateBillAuditHints = generateAuditHints;

// 默认导出聚合对象（兼容旧代码）
const fip = {
  ...utils,
  CACHE_FILE: orgCache.CACHE_FILE,
  setCacheFile: orgCache.setCacheFile,
  getCacheFile: orgCache.getCacheFile,
  loadCache: orgCache.loadCache,
  saveCache: orgCache.saveCache,
  addOrganizationRecord: orgCache.addOrganizationRecord,
  findOrganization: orgCache.findOrganization,
  getCacheStats: orgCache.getCacheStats,
  clearCache: orgCache.clearCache,
  listAllRecords: orgCache.listAllRecords,
  exportUnbilledIncomeLedger: unbilledIncome.exportUnbilledIncomeLedger,
  exportInputTransferLedger: inputTransfer.exportInputTransferLedger,
  exportOutputInvoiceLedger: outputInvoice.exportOutputInvoiceLedger,
  exportVatPrepaymentLedger: vatPrepayment.exportVatPrepaymentLedger,
  exportPassengerTransportLedger: passengerTransport.exportPassengerTransportLedger,
  extractInvoiceFields,
  auditInvoice: audit,
  generateAuditTextReport: generateTextReport,
  generateAuditJsonReport: generateJsonReport,
  generateAuditMarkdownReport: generateMarkdownReport,
  extractBill,
  generateBillAuditHints: generateAuditHints,
  checkConnection,
  ensureConnection,
};

export default fip;
