/**
 * FIP-CLI 主模块类型定义
 * 对应 lib/fip.ts 的 export = { ... } 导出模式
 */

// ============ CDP 类型（来自 lib/utils/cdp.ts）============

export interface CDPRuntime {
  evaluate(options: { expression: string; returnByValue?: boolean }): Promise<{
    result?: {
      value?: unknown;
      type?: string;
    };
  }>;
}

export interface CDPInput {
  dispatchMouseEvent(options: {
    type: string;
    x: number;
    y: number;
    button?: string;
    clickCount?: number;
  }): Promise<void>;
}

// ============ 通用基础接口 ============

export interface ElementConstraints {
  leftMin?: number;
  leftMax?: number;
  topMin?: number;
  topMax?: number;
}

export interface FoundElement {
  found: boolean;
  x?: number;
  y?: number;
}

// ============ Ledger 台账接口 ============

export interface LedgerOptions {
  startPeriod?: string;
  endPeriod?: string;
  startDate?: string;
  endDate?: string;
  companyCode?: string;
  taxCode?: string;
  sellerCode?: string;
  docType?: string;
  docStatus?: string;
  queryOnly?: boolean;
}

export interface LedgerResult {
  exported?: boolean;
  queried?: boolean;
  rows?: { total: number; visible: number };
  options?: Record<string, unknown>;
}

export interface UnbilledIncomeOptions {
  startDate?: string;
  endDate?: string;
  startPeriod?: string;
  endPeriod?: string;
  companyCode?: string;
  taxCode?: string;
  voidStatus?: string;
  queryOnly?: boolean;
  [key: string]: unknown;
}

export interface UnbilledIncomeResult {
  exported?: boolean;
  queried?: boolean;
  rows?: { total: number; visible: number };
  options?: Record<string, unknown>;
}

export interface InputTransferOptions {
  startPeriod?: string;
  endPeriod?: string;
  companyCode?: string;
  taxCode?: string;
  docStatus?: string;
  queryOnly?: boolean;
  [key: string]: unknown;
}

export interface InputTransferResult {
  exported?: boolean;
  queried?: boolean;
  rows?: { total: number; visible: number };
  options?: Record<string, unknown>;
}

// ============ Audit 审核接口 ============

export interface Rules {
  profit_center_mapping: Record<string, string>;
  warning_threshold: number;
  expected_approver: string;
  tax_rate_expected: string;
  check_order: string[];
  attachments_required: string[];
}

export interface BillingUnitResult {
  unit: string;
  status: string;
}

export interface DerivedValues {
  unpaid_amount: number;
  unpaid_formatted: string;
  total_after_invoice: number;
  total_formatted: string;
  is_over_limit: boolean;
  is_large_unpaid: boolean;
  current_invoice: number;
  current_formatted: string;
  confirmed_amount: number;
}

export interface CheckResult {
  point: string;
  status: string;
  message: string;
  auto_checked: boolean;
  action_needed?: string | null;
  details?: Record<string, unknown>;
}

export interface AuditStats {
  passed: number;
  warning: number;
  failed: number;
  manual: number;
  info: number;
}

export interface AuditResult {
  invoice_no: string;
  project_name: string;
  profit_center: string;
  fields: Record<string, unknown>;
  derived: DerivedValues;
  checks: Record<string, CheckResult>;
  stats: AuditStats;
  timestamp: string;
}

// ============ Bills 单据接口 ============

export interface BillConfig {
  name?: string;
  codePrefix?: string;
  basePatterns?: Record<string, RegExp>;
  inputFields?: Record<
    string,
    { byId?: string; byIdPrefix?: string; byLabel?: string }
  >;
  tables?: Array<{
    name: string;
    identifyBy: { headerText: string };
    columns: Array<{
      label?: string;
      header?: string;
      key?: string;
      field?: string;
      type?: string;
    }>;
  }>;
  auditHints?: unknown[];
  filterConfig?: Record<string, unknown>;
}

export interface AuditHint {
  name: string;
  description: string;
  level: 'pass' | 'warning' | 'info';
  message: string;
}

// ============ Utils 工具接口 ============

export interface PageInfo {
  url?: string;
  title?: string;
  activeTab?: { type: string; name: string };
}

export interface TableRowCount {
  total: number;
  visible: number;
}

export interface WaitForElementResult {
  found: boolean;
  text: string;
  waited: number;
  coordinates?: FoundElement;
}

export interface WaitForPopupResult {
  found: boolean;
  waited: number;
}

export interface WaitForUrlResult {
  matched: boolean;
  url?: string;
  waited: number;
}

export interface DateRangeResult {
  startDate: string;
  endDate: string;
}

export interface OpenBillResult {
  opened: boolean;
  billId: string;
  url: string;
}

export interface CloseBillResult {
  closed: boolean;
  url: string;
}

export interface ClickResult {
  clicked: boolean;
  x: number;
  y: number;
}

export interface EvaluateAndClickOptions {
  sleepMs?: number;
  returnKey?: string;
  log?: string;
}

export interface FindElementResult {
  found: boolean;
  x?: number;
  y?: number;
}

export interface TableDataOptions {
  maxRows?: number;
  includeHeaders?: boolean;
}

export interface TableDataResult {
  rowCount: number;
  data: string[][];
  headers: string[] | null;
  tableCount: number;
  error?: string;
}

export interface AttachmentOptions {
  downloadDir?: string;
}

export interface AttachmentInfo {
  name: string;
  size: string;
  uploader: string;
  uploadTime: string;
  rowIndex: number;
}

export interface ListAttachmentsResult {
  attachmentCount: number;
  attachments: AttachmentInfo[];
  downloadDir: string;
}

export interface DownloadOptions extends AttachmentOptions {
  chromeDownloadDir?: string;
}

export interface DownloadedFile {
  name: string;
  moved: boolean;
  path?: string;
  error?: string;
}

export interface DownloadResult {
  downloaded: number;
  total: number;
  files: DownloadedFile[];
  downloadDir: string;
}

export interface DismissOptions {
  closeButtonTexts?: string[];
  maxDialogs?: number;
  waitAfterClose?: number;
}

export interface DismissResult {
  closed: number;
  details: string[];
}

// ============ Organization 组织机构接口 ============

export interface OrganizationRecord {
  organization: string;
  project: string;
  department: string;
  plateCode?: string;
  plateName?: string;
  profitCenter?: string;
  recordedAt?: string;
  lastUsedAt?: string;
  useCount?: number;
}

export interface CacheData {
  version: number;
  organizations: OrganizationRecord[];
  lastUpdated: string | null;
}

export interface CacheStats {
  totalRecords: number;
  lastUpdated: string | null;
  uniqueOrganizations: string[];
}

export interface SwitchOrganizationOptions {
  organization?: string;
  project?: string;
  department?: string;
  fromCache?: boolean;
  autoSelect?: boolean;
}

export interface AutoSelectResult {
  organization: { selected: boolean; name: string } | null;
  project: { selected: boolean; name: string } | null;
  department: { selected: boolean; name: string } | null;
}

export interface SwitchOrganizationResult {
  success: boolean;
  mode: string;
  current?: OrganizationRecord;
  selection?:
    | AutoSelectResult
    | { error: string; partial: AutoSelectResult }
    | null;
  cache?: {
    isNewRecord: boolean;
    totalRecords: number;
    uniqueOrganizations: string[];
  };
  matches?: OrganizationRecord[];
  matchCount?: number;
}

export interface PopupItemsResult {
  ok: boolean;
  error?: string;
  title?: string;
  itemCount?: number;
  items?: Array<{ code: string; name: string; level: string }>;
  buttons?: string[];
}

export interface DialogField {
  id: string;
  value: string;
  placeholder: string;
}

export interface DialogValue {
  ok: boolean;
  error?: string;
  title?: string;
  fields?: Record<string, DialogField>;
  buttons?: string[];
}

// ============ FipAPI 主接口 ============

export interface FipAPI {
  [key: string]: unknown;

  // --- utils / common ---
  sleep(ms: number): Promise<void>;
  escapeJsString(str: string): string;
  findVisibleElementByText(
    text: string,
    constraints?: ElementConstraints
  ): Promise<FoundElement | null>;
  getPageInfo(): Promise<PageInfo>;
  clickDashboardTab(tabName: string): Promise<boolean>;
  clickQueryButton(): Promise<boolean>;
  getTableRowCount(): Promise<TableRowCount>;
  waitForElement(
    text: string,
    options?: {
      timeout?: number;
      interval?: number;
      constraints?: ElementConstraints;
    }
  ): Promise<WaitForElementResult>;
  waitForPopup(timeout?: number): Promise<WaitForPopupResult>;
  waitForUrl(
    pattern: string | RegExp,
    timeout?: number
  ): Promise<WaitForUrlResult>;

  // --- utils / navigation ---
  openSideMenu(menuName: string): Promise<boolean>;
  clickDrawerItem(itemName: string): Promise<boolean>;

  // --- utils / form ---
  clickShowQuery(): Promise<boolean>;
  setDateInput(
    inputId: string,
    dateStr: string
  ): Promise<{ found: boolean; value?: string; reason?: string }>;
  setDateRange(startDate: string, endDate: string): Promise<DateRangeResult>;
  setTaxPeriod(
    startPeriod: string,
    endPeriod: string
  ): Promise<Record<string, unknown>>;

  // --- utils / picker ---
  clickPickerButton(labelText: string): Promise<boolean>;
  pickFromDict(queryCode: string): Promise<boolean>;
  pickTaxSubject(
    taxCode: string
  ): Promise<{ tax_code: string; selected: boolean }>;

  // --- utils / bill ---
  openBill(billId: string, tabName?: string | null): Promise<OpenBillResult>;
  closeBill(): Promise<CloseBillResult>;

  // --- utils / cdp ---
  withCDP<T>(
    callback: (Runtime: CDPRuntime, Input: CDPInput) => Promise<T>
  ): Promise<T>;
  cdpClick(x: number, y: number, sleepMs?: number): Promise<ClickResult>;
  cdpClickDouble(x: number, y: number, sleepMs?: number): Promise<ClickResult>;
  cdpEvaluateAndClick(
    expression: string,
    options?: EvaluateAndClickOptions
  ): Promise<ClickResult | { clicked: false; reason: string }>;
  cdpEvaluate(expression: string): Promise<unknown>;
  cdpFindElementByText(
    text: string,
    constraints?: {
      leftMin?: number;
      leftMax?: number;
      topMin?: number;
      topMax?: number;
    }
  ): Promise<FindElementResult>;
  cdpFindPickerButtonByInputId(
    inputId: string
  ): Promise<FindElementResult & { reason?: string }>;
  cdpFindDropdownOption(text: string): Promise<FindElementResult>;
  cdpFindPopupElementByText(
    text: string,
    constraints?: { leftMin?: number; leftMax?: number }
  ): Promise<FindElementResult & { reason?: string }>;

  // --- utils / table ---
  getTableData(
    options?: TableDataOptions
  ): Promise<TableDataResult | { error: string }>;

  // --- utils / attachment ---
  listAttachments(options?: AttachmentOptions): Promise<ListAttachmentsResult>;
  downloadAttachments(options?: DownloadOptions): Promise<DownloadResult>;
  closeAttachmentPopup(): Promise<{
    closed: boolean;
    reason?: string;
    method?: string;
  }>;
  waitForDownload(
    downloadDir: string,
    expectedName: string,
    timeoutMs?: number
  ): Promise<string | null>;

  // --- utils / dialog ---
  dismissDialogs(options?: DismissOptions): Promise<DismissResult>;
  waitAndDismissDialogs(
    timeout?: number,
    options?: DismissOptions
  ): Promise<DismissResult>;

  // --- utils / organization ---
  openSwitchOrgDialog(): Promise<DialogValue>;
  closeSwitchOrgDialog(action?: 'cancel' | 'confirm'): Promise<boolean>;
  getCurrentOrganization(): Promise<{
    organization: string;
    fromDialog?: boolean;
  }>;
  switchOrganization(
    options?: SwitchOrganizationOptions
  ): Promise<SwitchOrganizationResult>;
  queryAndSelectInPopup(
    fieldLabel: string,
    queryText: string,
    inputId?: string
  ): Promise<{ selected: boolean; field: string; value: string }>;
  clickRefreshButton(): Promise<boolean>;
  clickSystemConfirm(): Promise<boolean>;
  selectFirstDepartment(): Promise<string | null>;
  readPickerPopupItems(): Promise<PopupItemsResult>;
  readDialogFields(): Promise<DialogValue>;
  closePickerPopup(): Promise<boolean>;

  // --- utils / organization-cache ---
  CACHE_FILE: string;
  setCacheFile(filePath: string): void;
  getCacheFile(): string;
  loadCache(): CacheData;
  saveCache(cache: CacheData): void;
  addOrganizationRecord(record: OrganizationRecord): boolean;
  findOrganization(query?: Partial<OrganizationRecord>): OrganizationRecord[];
  getCacheStats(): CacheStats;
  clearCache(): void;
  listAllRecords(): Array<OrganizationRecord & { index: number }>;

  // --- ledgers ---
  exportUnbilledIncomeLedger(
    options?: UnbilledIncomeOptions
  ): Promise<UnbilledIncomeResult>;
  exportInputTransferLedger(
    options?: InputTransferOptions
  ): Promise<InputTransferResult>;
  exportOutputInvoiceLedger(options?: LedgerOptions): Promise<LedgerResult>;
  exportVatPrepaymentLedger(options?: LedgerOptions): Promise<LedgerResult>;
  exportPassengerTransportLedger(
    options?: LedgerOptions
  ): Promise<LedgerResult>;

  // --- audit ---
  extractInvoiceFields(): Promise<Record<string, unknown>>;
  auditInvoice(fields: Record<string, unknown>): AuditResult;
  generateAuditTextReport(result: AuditResult): string;
  generateAuditJsonReport(result: AuditResult): string;
  generateAuditMarkdownReport(result: AuditResult): string;

  // --- bills ---
  extractBill(
    billId: string | null,
    billType?: string | null
  ): Promise<Record<string, unknown>>;
  generateBillAuditHints(
    data: Record<string, unknown>,
    billType: string
  ): AuditHint[];

  // --- browser ---
  ensureConnection(): Promise<void>;
}

declare const fip: FipAPI;
export default fip;
