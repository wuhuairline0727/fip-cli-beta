export function formatMoney(num: unknown): string {
  if (typeof num !== 'number') return String(num);
  return num.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function truncate(str: string | null | undefined, len: number): string {
  if (!str) return '—';
  return str.length > len ? str.substring(0, len - 1) + '…' : str;
}

export interface BillInfo {
  type: string;
  no: string;
  submitter: string;
  dept: string;
  amount: number;
  reason: string;
  accountSubject: string;
  budgetProject: string;
  budgetBalance: unknown;
  hints: string;
}

export function extractBillInfo(bill: Record<string, unknown>): BillInfo {
  const alloc = (bill.expense_allocation as any[])?.[0];
  const details = (bill.expense_details as any[]) || (bill.expense_items as any[]) || [];

  let amount = bill.payment_amount as number | undefined;
  if (!amount && alloc) amount = alloc.amount || alloc.budget_amount_with_tax;
  if (!amount && details.length > 0) {
    amount = details.reduce(
      (sum: number, d: any) =>
        sum + (parseFloat(d.amount_with_tax) || parseFloat(d.amount) || 0),
      0
    );
  }

  let reason = bill.payment_reason || bill.reimbursement_reason;
  if (!reason && details.length > 0 && details[0].reason_summary)
    reason = details[0].reason_summary;
  if (!reason && details.length > 0 && details[0].reason)
    reason = details[0].reason;
  if (!reason && alloc) reason = alloc.expense_item;

  let dept = bill.department;
  if (!dept && alloc) dept = alloc.department;
  if (!dept && details.length > 0) dept = details[0].department;

  let accountSubject = '—';
  const subjects = [
    ...new Set(details.map((d: any) => d.expense_item).filter(Boolean)),
  ];
  if (subjects.length === 1) {
    accountSubject = subjects[0];
  } else if (subjects.length > 1) {
    accountSubject = subjects.join('、');
  } else if (alloc && alloc.expense_item) {
    accountSubject = alloc.expense_item;
  }

  return {
    type: (bill._meta as any)?.bill_type_name || '—',
    no: (bill.bill_no as string) || '—',
    submitter: (bill.submitter as string) || '—',
    dept: (dept as string) || '—',
    amount: (amount as number) || 0,
    reason: (reason as string) || '—',
    accountSubject,
    budgetProject: alloc
      ? alloc.budget_item || alloc.budget_project || '—'
      : '—',
    budgetBalance: alloc ? alloc.budget_balance : '—',
    hints: ((bill.audit_hints as any[]) || []).map((h) => h.message).join('; ') || '—',
  };
}

export function generateReport(bills: BillInfo[], title = '单据合并报表'): string {
  const lines: string[] = [];
  const total = bills.reduce(
    (sum, info) => sum + (typeof info.amount === 'number' ? info.amount : 0),
    0
  );

  lines.push('');
  lines.push(
    '╔══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗'
  );
  lines.push(
    '║' + title.padStart(Math.floor((166 + title.length) / 2)).padEnd(166) + '║'
  );
  lines.push(
    '╠══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╣'
  );
  lines.push(
    '║ 序号 │ 单据类型      │ 单据编号           │ 提单人  │ 部门      │ 金额(元)  │ 会计科目      │ 预算项目    │ 预算余额(元)  │ 审核状态            ║'
  );
  lines.push(
    '╠══════╪═══════════════╪════════════════════╪═════════╪═══════════╪═══════════╪═══════════════╪═════════════╪═══════════════╪═════════════════════╣'
  );

  bills.forEach((info, i) => {
    const amt = formatMoney(info.amount);
    const bal = formatMoney(info.budgetBalance);
    lines.push(
      '║  ' +
        String(i + 1).padEnd(3) +
        '│ ' +
        truncate(info.type, 13).padEnd(13) +
        ' │ ' +
        info.no.padEnd(18) +
        ' │ ' +
        info.submitter.padEnd(7) +
        ' │ ' +
        info.dept.padEnd(9) +
        ' │ ' +
        String(amt).padEnd(9) +
        ' │ ' +
        truncate(info.accountSubject, 13).padEnd(13) +
        ' │ ' +
        truncate(info.budgetProject, 11).padEnd(11) +
        ' │ ' +
        String(bal).padEnd(13) +
        ' │ ' +
        truncate(info.hints, 19).padEnd(19) +
        ' ║'
    );
  });

  lines.push(
    '╠══════╧═══════════════╧════════════════════╧═════════╧═══════════╧═══════════╧═══════════════╧═════════════╧═══════════════╧═════════════════════╣'
  );
  lines.push(
    '║ 合计金额：¥' +
      formatMoney(total) +
      ' '.repeat(154 - formatMoney(total).length) +
      '║'
  );
  lines.push(
    '╚══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╝'
  );

  lines.push('');
  lines.push('【详细事由】');
  bills.forEach((info, i) => {
    lines.push(i + 1 + '. ' + info.no + ' — ' + info.reason);
  });

  return lines.join('\n');
}
