/**
 * 境内差旅报销单 (SLBX) 特定配置
 */

export const basePatterns: Record<string, RegExp> = {
  travel_category: /差旅类别[：:]\s*([^\n\r]+)/,
  budget_category: /预算类别[：:]\s*([^\n\r]+)/,
  pre_apply_no: /事前申请单号[：:]\s*([^\n\r]+)/,
  pre_apply_amount: /事前申请金额[：:]\s*([0-9,]+\.?[0-9]*)/,
};

export const inputFields: Record<string, { byLabel: string }> = {
  travel_category: { byLabel: '差旅类别' },
  budget_category: { byLabel: '预算类别' },
  pre_apply_no: { byLabel: '事前申请单号' },
  pre_apply_amount: { byLabel: '事前申请金额' },
};

export const tables: Array<{
  name: string;
  identifyBy: { headerText: string };
  columns: Array<{ header: string; field: string; type?: string }>;
}> = [
  {
    name: 'transport_expenses',
    identifyBy: { headerText: '出发日期' },
    columns: [
      { header: '', field: '_empty' },
      { header: '操作', field: '_action' },
      { header: '姓名', field: 'name' },
      { header: '出发日期', field: 'departure_date' },
      { header: '到达日期', field: 'arrival_date' },
      { header: '出发地点', field: 'departure_location' },
      { header: '到达地点', field: 'arrival_location' },
      { header: '票据类型', field: 'ticket_type' },
      { header: '交通工具', field: 'vehicle_type' },
      { header: '票面金额', field: 'ticket_amount', type: 'amount' },
      { header: '票面税额', field: 'ticket_tax', type: 'amount' },
      { header: '燃油附加费', field: 'fuel_surcharge', type: 'amount' },
      { header: '税率', field: 'tax_rate' },
      { header: '实际报销税额', field: 'reimburse_tax', type: 'amount' },
      { header: '民航发展基金', field: 'aviation_fund', type: 'amount' },
      { header: '改签费用', field: '_change_fee', type: 'amount' },
      { header: '退票费用', field: '_refund_fee', type: 'amount' },
      { header: '其他费用', field: '_other_fee', type: 'amount' },
      { header: '合计金额', field: '_total_amount', type: 'amount' },
      { header: '核减金额', field: 'deduction_amount', type: 'amount' },
      { header: '实际报销金额', field: 'reimburse_amount', type: 'amount' },
      { header: '结算类型', field: 'settlement_type' },
      { header: '企业支付金额', field: '_company_pay', type: 'amount' },
      { header: '个人垫付金额', field: '_personal_pay', type: 'amount' },
      { header: '数据说明', field: '_data_note' },
      { header: '备注', field: '_remark' },
    ],
  },
  {
    name: 'accommodation_expenses',
    identifyBy: { headerText: '入住时间' },
    columns: [
      { header: '', field: '_empty' },
      { header: '操作', field: '_action' },
      { header: '姓名', field: 'name' },
      { header: '出差地区', field: 'travel_region' },
      { header: '城市名称', field: 'city_name' },
      { header: '住宿费标准', field: 'standard_amount', type: 'amount' },
      { header: '入住时间', field: 'check_in_date' },
      { header: '离店时间', field: 'check_out_date' },
      { header: '住宿天数', field: 'stay_days' },
      { header: '住宿费', field: 'amount', type: 'amount' },
      { header: '发票类型', field: 'invoice_type' },
      { header: '税率', field: 'tax_rate' },
      { header: '税额', field: 'tax_amount', type: 'amount' },
      { header: '核减金额', field: 'deduction_amount', type: 'amount' },
      { header: '实际报销金额', field: 'reimburse_amount', type: 'amount' },
      { header: '结算类型', field: 'settlement_type' },
      { header: '企业支付金额', field: '_company_pay', type: 'amount' },
      { header: '个人垫付金额', field: '_personal_pay', type: 'amount' },
      { header: '数据说明', field: '_data_note' },
      { header: '备注', field: '_remark' },
    ],
  },
  {
    name: 'subsidy_expenses',
    identifyBy: { headerText: '补助标准' },
    columns: [
      { header: '', field: '_empty' },
      { header: '操作', field: '_action' },
      { header: '姓名', field: 'name' },
      { header: '出差地区', field: 'travel_region' },
      { header: '补助标准', field: 'subsidy_standard', type: 'amount' },
      { header: '实际出差天数', field: 'actual_days' },
      { header: '补助天数', field: 'subsidy_days' },
      { header: '补助金额', field: 'subsidy_amount', type: 'amount' },
      { header: '误餐金额', field: 'meal_amount', type: 'amount' },
      { header: '合计补助金额', field: 'total_subsidy', type: 'amount' },
      { header: '核减金额', field: 'deduction_amount', type: 'amount' },
      { header: '实际报销金额', field: 'reimburse_amount', type: 'amount' },
      { header: '结算类型', field: 'settlement_type' },
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
