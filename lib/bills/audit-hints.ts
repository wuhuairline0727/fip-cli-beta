/**
 * 审核提示生成器
 * 基于提取的单据数据生成审核提示
 */

export interface AuditHint {
  name: string;
  description: string;
  level: 'pass' | 'warning' | 'info';
  message: string;
}

/**
 * 从费用事项字符串提取关键词
 * 处理 "管理费用\\业务招待费" 格式，按 \ 或 / 分割
 * @param expenseItem - 费用事项字符串
 * @returns 关键词数组
 */
export function extractKeywords(expenseItem: string | null | undefined): string[] {
  if (!expenseItem || typeof expenseItem !== 'string') {
    return [];
  }
  return expenseItem
    .split(/[\\/]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * 生成审核提示数组
 * @param data - 提取的单据数据
 * @param billType - 单据类型
 * @returns 审核提示数组，每项为 { name, description, level, message }
 */
export function generateAuditHints(
  data: Record<string, unknown>,
  billType: string
): AuditHint[] {
  const hints: AuditHint[] = [];

  if (!data || typeof data !== 'object') {
    return hints;
  }

  const allocation =
    Array.isArray(data.expense_allocation) && data.expense_allocation.length > 0
      ? (data.expense_allocation[0] as Record<string, unknown>)
      : null;

  // 规则 a: budget_expense_match
  // 检查预算项目与报销费用事项是否一致
  if (
    allocation &&
    allocation.budget_item !== undefined &&
    allocation.expense_item !== undefined
  ) {
    const budgetItem = (allocation.budget_item as string) || '';
    const expenseItem = (allocation.expense_item as string) || '';
    const budgetKeywords = extractKeywords(budgetItem);
    const expenseKeywords = extractKeywords(expenseItem);
    const isMatch =
      budgetKeywords.length > 0 &&
      expenseKeywords.length > 0 &&
      budgetKeywords.every((bk) => expenseKeywords.includes(bk));

    hints.push({
      name: 'budget_expense_match',
      description: '检查预算项目与报销费用事项是否一致',
      level: isMatch ? 'pass' : 'warning',
      message: isMatch
        ? '预算项目与报销费用事项一致'
        : `预算项目「${budgetItem}」与费用事项「${expenseItem}」可能不一致`,
    });
  }

  // 规则 b: reason_expense_match
  // 检查报销事由是否体现费用事项关键词
  const reason =
    (data.reimbursement_reason as string) ||
    (data.payment_reason as string) ||
    '';
  if (allocation && allocation.expense_item !== undefined && reason) {
    const keywords = extractKeywords(allocation.expense_item as string);
    const reasonText = String(reason);
    const isContained =
      keywords.length > 0 && keywords.some((kw) => reasonText.includes(kw));

    hints.push({
      name: 'reason_expense_match',
      description: '检查报销事由是否体现费用事项关键词',
      level: isContained ? 'pass' : 'info',
      message: isContained
        ? '报销事由已体现费用事项关键词'
        : `报销事由「${reasonText}」未体现费用事项「${allocation.expense_item}」关键词`,
    });
  }

  // 规则 c: budget_balance_check
  // 检查预算余额是否充足
  const amount =
    allocation && allocation.amount !== undefined
      ? allocation.amount
      : data.amount;
  if (
    allocation &&
    allocation.budget_balance !== undefined &&
    amount !== undefined
  ) {
    const budgetBalance = Number(allocation.budget_balance);
    const amountNum = Number(amount);
    const isSufficient =
      !Number.isNaN(budgetBalance) &&
      !Number.isNaN(amountNum) &&
      budgetBalance >= amountNum;

    hints.push({
      name: 'budget_balance_check',
      description: '检查预算余额是否充足',
      level: isSufficient ? 'pass' : 'warning',
      message: isSufficient
        ? '预算余额充足'
        : `预算余额 ${budgetBalance} 不足，需要 ${amountNum}`,
    });
  }

  return hints;
}
