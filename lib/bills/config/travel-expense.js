/**
 * 差旅费报销 (CBX) 特定配置
 */

const basePatterns = {
  travel_category: /差旅类别[：:]\s*([^\n\r]+)/,
  budget_category: /预算类别[：:]\s*([^\n\r]+)/,
  pre_apply_amount: /事前申请金额[：:]\s*([0-9,]+\.?[0-9]*)/,
};

const inputFields = {
  travel_category: { byLabel: '差旅类别' },
  budget_category: { byLabel: '预算类别' },
  pre_apply_amount: { byLabel: '事前申请金额' },
};

const tables = [
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

module.exports = {
  basePatterns,
  inputFields,
  tables,
};
