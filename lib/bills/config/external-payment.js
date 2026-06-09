/**
 * 对外成本费用付款申请 (CFK) 特定配置
 */

const basePatterns = {
  bill_no: /单据编码[：:]\s*([A-Z0-9]+)/,
  has_contract: /是否有合同[：:]\s*([^\n\r]+)/,
  counterparty: /客商名称[：:]\s*([^\n\r]+)/,
  payment_amount: /付款金额[：:]\s*([0-9,]+\.?[0-9]*)/,
};

const inputFields = {
  payment_reason: { byLabel: '事由' },
  has_contract: { byLabel: '是否有合同' },
  counterparty: { byLabel: '客商名称' },
  payment_amount: { byLabel: '付款金额' },
};

const tables = [
  {
    name: 'expense_details',
    identifyBy: { headerText: '成本费用事项' },
    columns: [
      { header: '', field: '_empty' },
      { header: '操作', field: '_action' },
      { header: '业务部门', field: 'department' },
      { header: '事由摘要', field: 'reason_summary' },
      { header: '成本费用属性', field: 'expense_attribute' },
      { header: '成本费用事项', field: 'expense_item' },
      { header: '发票种类', field: 'invoice_type' },
      { header: '价税合计金额（含税）', field: 'amount_with_tax', type: 'amount' },
      { header: '税率', field: 'tax_rate' },
      { header: '税额', field: 'tax_amount', type: 'amount' },
      { header: '不含税金额', field: 'amount_without_tax', type: 'amount' },
      { header: '科研经费课题', field: '_research_project' },
      { header: '资金来源', field: '_fund_source' },
      { header: '自定义选项', field: '_custom_option' },
      { header: '备注', field: '_remark' },
      { header: '计划项目', field: '_plan_project' },
      { header: '现金流项目', field: '_cashflow_project' },
      { header: '收支项目', field: '_income_expense_project' },
    ],
  },
  {
    name: 'expense_allocation',
    identifyBy: { headerText: '预算项目' },
    columns: [
      { header: '', field: '_empty' },
      { header: '业务部门', field: 'department' },
      { header: '预算类别', field: 'budget_category' },
      { header: '预算事项', field: 'budget_item' },
      { header: '预算项目', field: 'budget_project' },
      { header: '预算币种', field: '_budget_currency' },
      { header: '预算汇率', field: '_budget_rate' },
      { header: '预算余额', field: 'budget_balance', type: 'amount' },
      { header: '预算金额(含税)', field: 'budget_amount_with_tax', type: 'amount' },
      { header: '预算金额(不含税)', field: 'budget_amount_without_tax', type: 'amount' },
      { header: '科研经费课题', field: '_research_project' },
      { header: '资金来源', field: '_fund_source' },
      { header: '预算组织机构', field: '_budget_org' },
      { header: '预算部门', field: '_budget_dept' },
      { header: '总预算金额', field: '_total_budget', type: 'amount' },
      { header: '执行金额', field: '_executed_amount', type: 'amount' },
      { header: '在途占用金额', field: '_in_transit_amount', type: 'amount' },
      { header: '已用预算比例', field: '_budget_usage_ratio' },
    ],
  },
];

module.exports = {
  basePatterns,
  inputFields,
  tables,
};
