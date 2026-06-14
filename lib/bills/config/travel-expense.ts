/**
 * 差旅费报销 (CBX) 特定配置
 */

export const basePatterns: Record<string, RegExp> = {
  travel_category: /差旅类别[：:]\s*([^\n\r]+)/,
  budget_category: /预算类别[：:]\s*([^\n\r]+)/,
  pre_apply_amount: /事前申请金额[：:]\s*([0-9,]+\.?[0-9]*)/,
};

export const inputFields: Record<string, { byLabel: string }> = {
  travel_category: { byLabel: '差旅类别' },
  budget_category: { byLabel: '预算类别' },
  pre_apply_amount: { byLabel: '事前申请金额' },
};

export const tables: Array<{
  name: string;
  identifyBy: { headerText: string };
  columns: Array<{ header: string; field: string; type?: string }>;
}> = [
  {
    name: 'expense_summary',
    identifyBy: { headerText: '实际应支付金额' },
    columns: [
      { header: '', field: '_empty' },
      { header: '姓名', field: 'name' },
      { header: '所属部门', field: 'department' },
      { header: '城市间交通费', field: 'transport_amount', type: 'amount' },
      { header: '住宿费', field: 'accommodation_amount', type: 'amount' },
      { header: '补助费', field: 'subsidy_amount', type: 'amount' },
      { header: '其他费用', field: 'other_amount', type: 'amount' },
      { header: '费用明细(价税合计）', field: 'total_amount', type: 'amount' },
      { header: '核减金额', field: 'deduction_amount', type: 'amount' },
      { header: '代扣税金', field: 'withholding_tax', type: 'amount' },
      { header: '冲抵借款金额', field: 'offset_loan', type: 'amount' },
      { header: '实际应支付金额', field: 'actual_pay_amount', type: 'amount' },
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
