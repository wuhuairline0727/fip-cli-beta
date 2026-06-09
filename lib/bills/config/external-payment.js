/**
 * 对外成本费用付款申请 (CFK) 特定配置
 */

const basePatterns = {
  has_contract: /是否有合同[：:]\s*([^\n\r]+)/,
  counterparty: /客商名称[：:]\s*([^\n\r]+)/,
  payment_amount: /付款金额[：:]\s*([0-9,]+\.?[0-9]*)/,
};

const inputFields = {
  payment_reason: { byLabel: '付款事由' },
  has_contract: { byLabel: '是否有合同' },
  counterparty: { byLabel: '客商名称' },
  payment_amount: { byLabel: '付款金额' },
};

const tables = [
  {
    name: 'expense_details',
    identifyBy: { headerText: '费用金额' },
    columns: [
      { header: '费用金额', field: 'amount', type: 'amount' },
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

module.exports = {
  basePatterns,
  inputFields,
  tables,
};
