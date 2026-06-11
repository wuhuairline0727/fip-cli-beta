import * as fs from 'fs';
import * as path from 'path';
import * as config from '../config';

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

let RULES: Rules | null = null;

export function loadRules(): Rules {
  if (RULES) return RULES;
  const rulesPath = path.join(__dirname, 'rules.json');
  let fileRules: Rules | null = null;
  try {
    fileRules = JSON.parse(fs.readFileSync(rulesPath, 'utf8')) as Rules;
  } catch (e) {
    // rules.json 不存在或损坏，使用内建 fallback
  }

  if (fileRules) {
    RULES = fileRules;
  } else {
    // 内建 fallback — 与 rules.json 内容保持一致
    RULES = {
      profit_center_mapping: {
        L1000: '中国建筑一局（集团）有限公司总部',
        L1005: '中建一局集团第五建筑有限公司总部',
      },
      warning_threshold: 5000000,
      expected_approver: '刘书豪',
      tax_rate_expected: '9%',
      check_order: [
        'profit_center',
        'billing_unit',
        'contract_match',
        'unpaid_amount',
        'amount_limit',
        'approver',
      ],
      attachments_required: [
        '合同关键页',
        '业主开票确认函',
        '外经证（异地项目）',
        '开票明细表',
        '累计确权额证明',
      ],
    };
  }

  // 允许用户通过 config 覆盖 expected_approver
  const userApprover = config.get('expectedApprover') as string | undefined;
  if (userApprover) {
    RULES.expected_approver = userApprover;
  }
  return RULES;
}

export function parseAmount(amountStr: string | null | undefined): number {
  if (amountStr === null || amountStr === undefined) return 0;
  const cleaned = String(amountStr).replace(/[¥,\s]/g, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

export function formatAmount(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  const parts = abs.toFixed(2).split('.');
  const intPart = parts[0];
  const decPart = parts[1];
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return sign + '¥' + grouped + '.' + decPart;
}

export function getBillingUnit(profitCenter: string | undefined): BillingUnitResult {
  const rules = loadRules();
  const pc = profitCenter || '';
  if (pc.startsWith('L1000')) {
    return { unit: rules.profit_center_mapping.L1000, status: '通过' };
  }
  if (pc.startsWith('L1005')) {
    return { unit: rules.profit_center_mapping.L1005, status: '通过' };
  }
  return { unit: '【请人工确认】', status: '需确认' };
}

export function calculateDerivedValues(fields: Record<string, unknown>): DerivedValues {
  const invoiced = parseAmount(fields.invoiced_amount as string | null | undefined);
  const received = parseAmount(fields.received_amount as string | null | undefined);
  const current = parseAmount(fields.current_amount as string | null | undefined);
  const confirmed = parseAmount(fields.confirmed_amount as string | null | undefined);
  const unpaid = invoiced - received;
  const totalAfter = invoiced + current;

  return {
    unpaid_amount: unpaid,
    unpaid_formatted: formatAmount(unpaid),
    total_after_invoice: totalAfter,
    total_formatted: formatAmount(totalAfter),
    is_over_limit: confirmed > 0 && totalAfter > confirmed,
    is_large_unpaid: unpaid >= loadRules().warning_threshold,
    current_invoice: current,
    current_formatted: formatAmount(current),
    confirmed_amount: confirmed,
  };
}

export function performChecks(
  fields: Record<string, unknown>,
  derived: DerivedValues
): Record<string, CheckResult> {
  const rules = loadRules();
  const checks: Record<string, CheckResult> = {};
  const profitCenter = (fields.profit_center as string) || '';
  const { unit: billingUnit, status: pcStatus } = getBillingUnit(profitCenter);

  // 检查1: 利润中心核对
  checks.profit_center = {
    point: '利润中心核对',
    status: pcStatus,
    message: `利润中心: ${profitCenter || '未提取'}`,
    auto_checked: true,
  };

  // 检查2: 开票单位核对
  checks.billing_unit = {
    point: '开票单位核对',
    status: pcStatus,
    message: `利润中心 ${profitCenter || '未提取'} 对应开票单位: ${billingUnit}`,
    auto_checked: true,
    details: { billing_unit: billingUnit },
  };

  // 检查3: 单据合同金额与附件合同额核对
  const contractAmount = parseAmount(fields.contract_amount as string | null | undefined);
  const attachmentContract = parseAmount(fields.attachment_contract_amount as string | null | undefined);
  if (contractAmount > 0 && attachmentContract > 0) {
    if (Math.abs(contractAmount - attachmentContract) < 0.01) {
      checks.contract_match = {
        point: '单据合同金额与附件合同额核对',
        status: '通过',
        message: `单据金额 ${formatAmount(contractAmount)} 与附件金额 ${formatAmount(attachmentContract)} 一致`,
        auto_checked: true,
      };
    } else {
      checks.contract_match = {
        point: '单据合同金额与附件合同额核对',
        status: '警告',
        message: `金额不一致！单据 ${formatAmount(contractAmount)} vs 附件 ${formatAmount(attachmentContract)}`,
        auto_checked: true,
        action_needed: '核实合同金额差异原因',
        details: {
          difference: formatAmount(
            Math.abs(contractAmount - attachmentContract)
          ),
        },
      };
    }
  } else {
    checks.contract_match = {
      point: '单据合同金额与附件合同额核对',
      status: '需人工核对',
      message: '附件合同金额未提供，无法自动核对',
      auto_checked: false,
      action_needed: '请核对附件中的合同金额',
    };
  }

  // 检查4: 已开票未收款金额检查
  const unpaid = derived.unpaid_amount;
  const thresholdWan = (rules.warning_threshold / 10000).toFixed(0);
  if (derived.is_large_unpaid) {
    checks.unpaid_amount = {
      point: '已开票未收款金额检查',
      status: '警告',
      message: `已开票未收款 ${derived.unpaid_formatted} >= ${thresholdWan}万`,
      auto_checked: true,
      action_needed: '撰写《大额已开票未收款情况说明》',
    };
  } else if (unpaid < 0) {
    checks.unpaid_amount = {
      point: '已开票未收款金额检查',
      status: '信息',
      message: `预收账款状态: ${derived.unpaid_formatted}`,
      auto_checked: true,
    };
  } else {
    checks.unpaid_amount = {
      point: '已开票未收款金额检查',
      status: '通过',
      message: `已开票未收款 ${derived.unpaid_formatted} < ${thresholdWan}万，正常`,
      auto_checked: true,
    };
  }

  // 检查5: 开票金额与累计确权额核对
  const confirmed = parseAmount(fields.confirmed_amount as string | null | undefined);
  if (confirmed <= 0) {
    checks.amount_limit = {
      point: '开票金额与累计确权额核对',
      status: '需人工核对',
      message: '累计确权额未提供，无法自动核对',
      auto_checked: false,
      action_needed: '请从结算系统或财务部门获取累计确权额',
      details: { manual_input_required: true },
    };
  } else if (derived.is_over_limit) {
    const over = derived.total_after_invoice - confirmed;
    checks.amount_limit = {
      point: '开票金额与累计确权额核对',
      status: '失败',
      message: `开票金额超限！${derived.total_formatted} > 确权额 ${formatAmount(confirmed)}`,
      auto_checked: true,
      action_needed: '核实累计确权额是否正确，或确认是否有新增确权',
      details: { over_amount: formatAmount(over) },
    };
  } else {
    checks.amount_limit = {
      point: '开票金额与累计确权额核对',
      status: '通过',
      message: `${derived.total_formatted} <= 确权额 ${formatAmount(confirmed)}，符合要求`,
      auto_checked: true,
    };
  }

  // 检查6: 税务主管审批人核对
  const approver = (fields.tax_approver as string) || '';
  if (!approver) {
    checks.approver = {
      point: '税务主管审批人核对',
      status: '需确认',
      message: '未提取到审批人信息',
      auto_checked: false,
      action_needed: '请确认审批人信息',
    };
  } else if (approver.includes(rules.expected_approver)) {
    checks.approver = {
      point: '税务主管审批人核对',
      status: '通过',
      message: `审批人匹配: ${approver}`,
      auto_checked: true,
    };
  } else {
    checks.approver = {
      point: '税务主管审批人核对',
      status: '需确认',
      message: `审批人'${approver}'需要确认`,
      auto_checked: true,
      action_needed: '确认审批人是否正确',
    };
  }

  return checks;
}

export function checkAttachments(fields: Record<string, unknown>): CheckResult {
  const rules = loadRules();
  const attachments = (fields.attachments || []) as Array<{ name?: string } | string>;
  const required = rules.attachments_required || [];
  const uiCount = (fields.attachment_count_from_ui as number) || 0;

  // 如果附件列表为空但 UI 显示有附件，说明附件在弹窗中未被静态提取
  // 此时不逐个检查 required，而是提示人工核对
  if (attachments.length === 0 && uiCount > 0) {
    return {
      point: '附件完整性检查',
      status: '需人工核对',
      message: `页面显示有 ${uiCount} 个附件，但无法自动获取文件名进行核对（附件列表在弹窗中）`,
      auto_checked: false,
      action_needed:
        '请人工核对附件是否包含：合同关键页、业主开票确认函、外经证（异地项目）、开票明细表、累计确权额证明',
      details: { uiAttachmentCount: uiCount },
    };
  }

  const results: Array<{ name: string; status: string; files: string[] }> = [];
  for (const req of required) {
    // 异地项目才需要外经证
    if (req.includes('外经证') && !fields.is_external_project) {
      continue;
    }
    const keyword = req.replace('（异地项目）', '');
    const found = attachments.some((a) => {
      const name = typeof a === 'string' ? a : a.name || '';
      return name.includes(keyword);
    });
    results.push({
      name: req,
      status: found ? '已上传' : '缺失',
      files: attachments
        .filter((a) => {
          const name = typeof a === 'string' ? a : a.name || '';
          return name.includes(keyword);
        })
        .map((a) => (typeof a === 'string' ? a : a.name || '')),
    });
  }

  const missing = results.filter((r) => r.status === '缺失');
  return {
    point: '附件完整性检查',
    status: missing.length > 0 ? '警告' : '通过',
    message:
      missing.length > 0
        ? `缺少附件: ${missing.map((m) => m.name).join(', ')}`
        : `主要附件已齐备 (${attachments.length} 个)`,
    auto_checked: true,
    action_needed: missing.length > 0 ? '补充缺失的附件' : null,
    details: { attachments: results },
  };
}

export function audit(fields: Record<string, unknown>): AuditResult {
  const derived = calculateDerivedValues(fields);
  const checks = performChecks(fields, derived);

  // 附件检查
  checks.attachments = checkAttachments(fields);

  // 统计结果
  const stats: AuditStats = {
    passed: 0,
    warning: 0,
    failed: 0,
    manual: 0,
    info: 0,
  };

  for (const check of Object.values(checks)) {
    if (check.status === '通过') stats.passed++;
    else if (check.status === '警告') stats.warning++;
    else if (check.status === '失败') stats.failed++;
    else if (check.status === '需人工核对' || check.status === '需确认')
      stats.manual++;
    else if (check.status === '信息') stats.info++;
  }

  return {
    invoice_no: (fields.invoice_no as string) || 'unknown',
    project_name: (fields.project_name as string) || '',
    profit_center: (fields.profit_center as string) || '',
    fields,
    derived,
    checks,
    stats,
    timestamp: new Date().toISOString(),
  };
}
