/**
 * 开票申请单 (KP) 特定配置
 */

export const basePatterns: Record<string, RegExp> = {
  invoice_type: /发票类型[\uff1a:]\s*([^\n\r]+)/,
  tax_rate: /税率[\uff1a:]\s*([^\n\r]+)/,
  invoice_amount: /开票金额[\uff1a:]\s*([0-9,]+\.?[0-9]*)/,
  buyer_name: /购方名称[\uff1a:]\s*([^\n\r]+)/,
  seller_name: /销方名称[\uff1a:]\s*([^\n\r]+)/,
  project_code: /项目编码[\uff1a:]\s*([^\n\r]+)/,
  contract_no: /合同编号[\uff1a:]\s*([^\n\r]+)/,
};

export const inputFields: Record<string, { byLabel: string }> = {
  invoice_type: { byLabel: '发票类型' },
  tax_rate: { byLabel: '税率' },
  invoice_amount: { byLabel: '开票金额' },
  buyer_name: { byLabel: '购方名称' },
  seller_name: { byLabel: '销方名称' },
  project_code: { byLabel: '项目编码' },
  contract_no: { byLabel: '合同编号' },
  invoice_remark: { byLabel: '发票备注' },
  apply_reason: { byLabel: '申请事由' },
};

export const tables: Array<{
  name: string;
  identifyBy: { headerText: string };
  columns: Array<{ header: string; field: string; type?: string }>;
}> = [
  {
    name: 'invoice_details',
    identifyBy: { headerText: '货物或应税劳务名称' },
    columns: [
      { header: '', field: '_empty' },
      { header: '操作', field: '_action' },
      { header: '货物或应税劳务名称', field: 'item_name' },
      { header: '规格型号', field: 'spec_model' },
      { header: '单位', field: 'unit' },
      { header: '数量', field: 'quantity' },
      { header: '单价', field: 'unit_price', type: 'amount' },
      { header: '金额', field: 'amount', type: 'amount' },
      { header: '税率', field: 'tax_rate' },
      { header: '税额', field: 'tax_amount', type: 'amount' },
      { header: '价税合计', field: 'total_amount', type: 'amount' },
      { header: '备注', field: '_remark' },
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
      {
        header: '预算金额（含税）',
        field: 'budget_amount_with_tax',
        type: 'amount',
      },
    ],
  },
];
