/**
 * 统一单据报表生成器
 * 标准格式：序号 | 单据类型 | 单据编号 | 提单人 | 部门 | 金额 | 会计科目 | 预算项目 | 预算余额 | 审核状态
 */

function formatMoney(num) {
  if (typeof num !== 'number') return String(num);
  return num.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function truncate(str, len) {
  if (!str) return '—';
  return str.length > len ? str.substring(0, len - 1) + '…' : str;
}

/**
 * 从提取后的单据数据中提取关键信息
 * @param {Object} bill - extract-bill 返回的 data 对象
 * @returns {Object} 标准化后的单据信息
 */
function extractBillInfo(bill) {
  const alloc = bill.expense_allocation && bill.expense_allocation[0];
  const details = bill.expense_details || bill.expense_items || [];

  // 金额
  let amount = bill.payment_amount;
  if (!amount && alloc) amount = alloc.amount || alloc.budget_amount_with_tax;
  if (!amount && details.length > 0) {
    amount = details.reduce(
      (sum, d) =>
        sum + (parseFloat(d.amount_with_tax) || parseFloat(d.amount) || 0),
      0
    );
  }

  // 事由
  let reason = bill.payment_reason || bill.reimbursement_reason;
  if (!reason && details.length > 0 && details[0].reason_summary)
    reason = details[0].reason_summary;
  if (!reason && details.length > 0 && details[0].reason)
    reason = details[0].reason;
  if (!reason && alloc) reason = alloc.expense_item;

  // 部门
  let dept = bill.department;
  if (!dept && alloc) dept = alloc.department;
  if (!dept && details.length > 0) dept = details[0].department;

  // 会计科目
  let accountSubject = '—';
  const subjects = [
    ...new Set(details.map((d) => d.expense_item).filter(Boolean)),
  ];
  if (subjects.length === 1) {
    accountSubject = subjects[0];
  } else if (subjects.length > 1) {
    accountSubject = subjects.join('、');
  } else if (alloc && alloc.expense_item) {
    accountSubject = alloc.expense_item;
  }

  return {
    type: bill._meta?.bill_type_name || '—',
    no: bill.bill_no || '—',
    submitter: bill.submitter || '—',
    dept: dept || '—',
    amount: amount || 0,
    reason: reason || '—',
    accountSubject,
    budgetProject: alloc
      ? alloc.budget_item || alloc.budget_project || '—'
      : '—',
    budgetBalance: alloc ? alloc.budget_balance : '—',
    hints: (bill.audit_hints || []).map((h) => h.message).join('; ') || '—',
  };
}

/**
 * 生成合并报表
 * @param {Object[]} bills - 单据信息数组（已通过 extractBillInfo 处理）
 * @param {string} title - 报表标题
 * @returns {string} 格式化后的报表文本
 */
function generateReport(bills, title = '单据合并报表') {
  const lines = [];
  const total = bills.reduce(
    (sum, info) => sum + (typeof info.amount === 'number' ? info.amount : 0),
    0
  );

  // 表头
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

  // 数据行
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

  // 合计行
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

  // 详细事由
  lines.push('');
  lines.push('【详细事由】');
  bills.forEach((info, i) => {
    lines.push(i + 1 + '. ' + info.no + ' — ' + info.reason);
  });

  return lines.join('\n');
}

module.exports = { extractBillInfo, generateReport, formatMoney };
