/**
 * 通用报销单 (TBX) 特定配置
 */

export const basePatterns: Record<string, RegExp> = {
  domestic_foreign: /境内境外[：:]\s*([^\n\r]+)/,
};

export const inputFields: Record<
  string,
  { byId?: string; byIdPrefix?: string; byLabel?: string }
> = {
  domestic_foreign: { byLabel: '境内境外' },
  // TBX 基本信息中没有"预算类别"字段，排除通用配置
  budget_category: {},
};

export const tables: Array<{
  name: string;
  identifyBy: { headerText: string };
  columns: Array<{ header: string; field: string; type?: string }>;
}> = [
  {
    name: 'expense_items',
    identifyBy: { headerText: '报销费用事项' },
    columns: [
      { header: '事由', field: 'reason' },
      { header: '姓名', field: 'name' },
      { header: '报销属性', field: 'reimbursement_type' },
      { header: '报销费用事项', field: 'expense_item' },
      { header: '费用金额', field: 'expense_amount', type: 'amount' },
      { header: '核减金额', field: 'deduction_amount', type: 'amount' },
      { header: '实际报销金额', field: 'reimburse_amount', type: 'amount' },
    ],
  },
  {
    name: 'expense_allocation',
    identifyBy: { headerText: '承担部门' },
    columns: [
      { header: '承担部门', field: 'department' },
      { header: '报销费用事项', field: 'expense_item' },
      { header: '承担金额', field: 'amount', type: 'amount' },
      { header: '预算项目', field: 'budget_item' },
      { header: '预算余额', field: 'budget_balance', type: 'amount' },
    ],
  },
];
