import type { AuditResult, CheckResult, AuditStats } from './engine';

const CHECK_ORDER = [
  'profit_center',
  'billing_unit',
  'contract_match',
  'unpaid_amount',
  'amount_limit',
  'approver',
  'attachments',
];

function formatFieldAmount(val: unknown): unknown {
  let num = val;
  if (typeof val === 'string') {
    num = parseFloat(val.replace(/,/g, ''));
  }
  if (typeof num === 'number' && !isNaN(num)) {
    const sign = num < 0 ? '-' : '';
    const abs = Math.abs(num);
    const parts = abs.toFixed(2).split('.');
    const grouped = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return sign + '¥' + grouped + '.' + parts[1];
  }
  return val;
}

export function generateTextReport(result: AuditResult): string {
  const lines: string[] = [];
  const separator = '='.repeat(80);

  lines.push(separator);
  lines.push('                    开票单智能审核报告');
  lines.push(separator);
  lines.push('');

  // 基本信息
  lines.push('【单据基本信息】');
  lines.push(`单据编号: ${result.invoice_no}`);
  lines.push(`项目名称: ${result.project_name || '未提取'}`);
  lines.push(`利润中心: ${result.profit_center || '未提取'}`);
  if (result.fields?.buyer_name)
    lines.push(`购买方: ${result.fields.buyer_name as string}`);
  if (result.fields?.seller_name)
    lines.push(`销售方: ${result.fields.seller_name as string}`);
  lines.push('');

  // 金额信息
  lines.push('【金额信息】');
  if (result.fields?.contract_amount !== undefined) {
    lines.push(
      `合同总金额: ${formatFieldAmount(result.fields.contract_amount)}`
    );
  }
  if (result.fields?.invoiced_amount !== undefined) {
    lines.push(
      `已开票总金额: ${formatFieldAmount(result.fields.invoiced_amount)}`
    );
  }
  if (result.fields?.current_amount !== undefined) {
    lines.push(
      `本次开票金额: ${formatFieldAmount(result.fields.current_amount)}`
    );
  }
  if (result.fields?.received_amount !== undefined) {
    lines.push(
      `已收款总金额: ${formatFieldAmount(result.fields.received_amount)}`
    );
  }
  if (result.derived?.unpaid_formatted)
    lines.push(`已开票未收款: ${result.derived.unpaid_formatted}`);
  if (result.fields?.confirmed_amount) {
    lines.push(
      `累计确权额: ${formatFieldAmount(result.fields.confirmed_amount)}`
    );
  }
  lines.push('');

  // 自动核对结果
  lines.push(separator);
  lines.push('                              自动核对结果');
  lines.push(separator);
  lines.push('');

  const statusIcons: Record<string, string> = {
    通过: '[OK]',
    警告: '[WARN]',
    失败: '[FAIL]',
    需人工核对: '[MANUAL]',
    需确认: '[CHECK]',
    信息: '[INFO]',
  };

  for (const key of CHECK_ORDER) {
    const check = result.checks[key];
    if (!check) continue;
    const icon = statusIcons[check.status] || '[?]';
    lines.push(`${icon} [${check.status}] ${check.point}`);
    lines.push(`   ${check.message}`);
    if (check.action_needed) {
      lines.push(`   -> ${check.action_needed}`);
    }
    lines.push('');
  }

  // 统计
  lines.push('【核对统计】');
  lines.push(`通过: ${result.stats?.passed ?? 0} 项`);
  lines.push(`警告: ${result.stats?.warning ?? 0} 项`);
  lines.push(`失败: ${result.stats?.failed ?? 0} 项`);
  lines.push(`需人工核对: ${result.stats?.manual ?? 0} 项`);
  if (result.stats?.info > 0) lines.push(`信息: ${result.stats.info} 项`);
  lines.push('');

  // 审核结论
  lines.push(separator);
  lines.push('                              审核结论');
  lines.push(separator);
  lines.push('');

  if (result.stats?.failed > 0) {
    lines.push('【结论】: 有失败项，需处理后提交');
  } else if (result.stats?.warning > 0 || result.stats?.manual > 0) {
    lines.push('【结论】: 有警告/需确认项，处理后可提交');
  } else {
    lines.push('【结论】: 全部通过，可提交');
  }

  lines.push('');
  lines.push(`审核时间: ${result.timestamp}`);
  lines.push('');

  return lines.join('\n');
}

export function generateJsonReport(result: AuditResult): string {
  return JSON.stringify(result, null, 2);
}

export function generateMarkdownReport(result: AuditResult): string {
  const lines: string[] = [];

  lines.push('# 开票单智能审核报告');
  lines.push('');

  // 基本信息
  lines.push('## 单据基本信息');
  lines.push('');
  lines.push(`| 字段 | 值 |`);
  lines.push(`|------|-----|`);
  lines.push(`| 单据编号 | ${result.invoice_no} |`);
  lines.push(`| 项目名称 | ${result.project_name || '未提取'} |`);
  lines.push(`| 利润中心 | ${result.profit_center || '未提取'} |`);
  if (result.fields?.buyer_name)
    lines.push(`| 购买方 | ${result.fields.buyer_name as string} |`);
  if (result.fields?.seller_name)
    lines.push(`| 销售方 | ${result.fields.seller_name as string} |`);
  lines.push('');

  // 金额信息
  lines.push('## 金额信息');
  lines.push('');
  lines.push(`| 项目 | 金额 |`);
  lines.push(`|------|------|`);
  if (result.fields?.contract_amount !== undefined)
    lines.push(
      `| 合同总金额 | ${result.fields.contract_amount as string | number} |`
    );
  if (result.fields?.invoiced_amount !== undefined)
    lines.push(
      `| 已开票总金额 | ${result.fields.invoiced_amount as string | number} |`
    );
  if (result.fields?.current_amount !== undefined)
    lines.push(
      `| 本次开票金额 | ${result.fields.current_amount as string | number} |`
    );
  if (result.fields?.received_amount !== undefined)
    lines.push(
      `| 已收款总金额 | ${result.fields.received_amount as string | number} |`
    );
  if (result.derived?.unpaid_formatted)
    lines.push(`| 已开票未收款 | ${result.derived.unpaid_formatted} |`);
  lines.push('');

  // 核对结果
  lines.push('## 自动核对结果');
  lines.push('');

  const statusEmojis: Record<string, string> = {
    通过: '✅',
    警告: '⚠️',
    失败: '❌',
    需人工核对: '⏸️',
    需确认: '⏸️',
    信息: 'ℹ️',
  };

  for (const key of CHECK_ORDER) {
    const check = result.checks[key];
    if (!check) continue;
    const emoji = statusEmojis[check.status] || '❓';
    lines.push(`### ${emoji} ${check.point}`);
    lines.push('');
    lines.push(`- **状态**: ${check.status}`);
    lines.push(`- **说明**: ${check.message}`);
    if (check.action_needed) {
      lines.push(`- **需处理**: ${check.action_needed}`);
    }
    lines.push('');
  }

  // 统计
  lines.push('## 核对统计');
  lines.push('');
  lines.push(`- 通过: ${result.stats?.passed ?? 0} 项`);
  lines.push(`- 警告: ${result.stats?.warning ?? 0} 项`);
  lines.push(`- 失败: ${result.stats?.failed ?? 0} 项`);
  lines.push(`- 需人工核对: ${result.stats?.manual ?? 0} 项`);
  lines.push('');

  // 结论
  lines.push('## 审核结论');
  lines.push('');
  if (result.stats?.failed > 0) {
    lines.push('**有失败项，需处理后提交**');
  } else if (result.stats?.warning > 0 || result.stats?.manual > 0) {
    lines.push('**有警告/需确认项，处理后可提交**');
  } else {
    lines.push('**全部通过，可提交**');
  }
  lines.push('');
  lines.push(`*审核时间: ${result.timestamp}*`);

  return lines.join('\n');
}
