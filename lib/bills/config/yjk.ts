/**
 * 预缴计算单 (YJK) 特定配置
 * 税务模块 - 增值税及附加税费预缴
 */

// === innerText 正则模式（基础字段）===
// 注意：YJK 页面中字段和值之间以换行分隔，格式为 "字段：\n值" 或 "字段：值"
// 使用 [^\n\r]* 允许空值，使用 [^\n\r]+ 要求非空值
export const basePatterns: Record<string, RegExp> = {
  // 基础信息通过 innerText 正则提取
  apply_reason: /申请事由[：:]([^\n\r]*)/,
  prepayment_type: /预缴类型[：:]([^\n\r]*)/,
  company_name: /公司名称[：:]([^\n\r]*)/,
  tax_id: /纳税人识别号[：:]([^\n\r]*)/,
  project_name: /项目名称[：:]([^\n\r]+)/,
  tax_mode: /计税方式[：:]([^\n\r]+)/,
  prepayment_category: /预缴分类[：:]([^\n\r]*)/,
  tax_report: /涉税事项报告[：:]([^\n\r]*)/,
  tax_report_expiry: /涉税报告到期时间[：:]([^\n\r]*)/,
};

// === input 字段映射（通过 ID 前缀提取，GWT 框架下 ID 后缀不稳定）===
export const inputFields: Record<
  string,
  { byIdPrefix?: string; byLabel?: string }
> = {
  // 基础信息
  apply_reason_input: { byIdPrefix: 'SW_STO_YJKF_NOTE' },
  prepayment_type_input: { byIdPrefix: 'SW_STO_YJKF_YJLX' },
  company_name_input: { byIdPrefix: 'SW_STO_YJKF_GSMC' },
  tax_id_input: { byIdPrefix: 'SW_STO_YJKF_NSRSBH' },
  project_name_input: { byIdPrefix: 'SW_STO_YJKF_XMMC' },
  tax_mode_input: { byIdPrefix: 'SW_STO_YJKF_ZSFS' },
  prepayment_category_input: { byIdPrefix: 'SW_STO_YJKF_YJFL' },
  tax_report_input: { byIdPrefix: 'SW_STO_YJKF_SSSXBG' },
  tax_report_expiry_input: { byIdPrefix: 'SW_STO_YJKF_BGDQSJ' },
  bill_date: { byLabel: '提单日期' },

  // 增值税预缴信息
  total_prepayment_tax: { byIdPrefix: 'SW_STO_YJKF_HJSJ' },
  tax_authority: { byIdPrefix: 'SW_STO_YJKF_YJSWJG' },
  prepayment_period: { byIdPrefix: 'SW_STO_YJKF_YJQJ' },
  invoice_amount_1: { byIdPrefix: 'SW_STO_YJKF_XSE' },
  subcontract_invoice_deduction_2: { byIdPrefix: 'SW_STO_YJKF_KJFBJP' },
  taxable_sales_3: { byIdPrefix: 'SW_STO_YJKF_YYJX' },
  prepayment_tax_rate_4: { byIdPrefix: 'SW_STO_YJKF_YJSL' },
  levy_rate_5: { byIdPrefix: 'SW_STO_YJKF_YZLFZ' },
  vat_prepayment_6: { byIdPrefix: 'SW_STO_YJKF_YJZZS' },
  calculated_vat_prepayment: { byIdPrefix: 'SW_STO_YJKF_JSYJ' },

  // 所得税预缴信息
  is_income_tax_prepayment: { byIdPrefix: 'FormComboBoxSFSDS' },
  corporate_income_tax: { byIdPrefix: 'SW_STO_YJKF_QYSDS' },
  individual_income_tax: { byIdPrefix: 'SW_STO_YJKF_GRSDS' },
};

// === 子表配置 ===
export const tables: Array<{
  name: string;
  identifyBy: { headerText: string };
  columns: Array<{ header: string; field: string; type?: string }>;
}> = [
  {
    name: 'surcharge_prepayment',
    // 表头行包含这些文本（GWT 框架下表头和数据可能分离）
    identifyBy: { headerText: '城市维护建设税' },
    columns: [
      { header: '序号', field: 'seq_no' },
      {
        header: '城市维护建设税',
        field: 'urban_maintenance_tax',
        type: 'amount',
      },
      { header: '教育费及附加', field: 'education_surcharge', type: 'amount' },
      {
        header: '地方教育费及附加',
        field: 'local_education_surcharge',
        type: 'amount',
      },
      { header: '合计', field: 'total_surcharge', type: 'amount' },
      { header: '说明', field: 'remark' },
    ],
  },
  {
    name: 'subcontract_invoices',
    identifyBy: { headerText: '发票代码' },
    columns: [
      { header: '操作', field: '_action' },
      { header: '发票代码', field: 'invoice_code' },
      { header: '发票号码', field: 'invoice_number' },
      { header: '客商编号', field: 'vendor_code' },
      { header: '客商名称', field: 'vendor_name' },
      {
        header: '发票金额（含税）',
        field: 'invoice_amount_with_tax',
        type: 'amount',
      },
      {
        header: '前期累计扣减分包发票金额',
        field: 'accumulated_deduction',
        type: 'amount',
      },
      { header: '在途金额', field: 'in_transit_amount', type: 'amount' },
      {
        header: '本次可扣减发票金额',
        field: 'available_deduction',
        type: 'amount',
      },
      { header: '本次扣减金额', field: 'current_deduction', type: 'amount' },
      { header: '销方名称', field: 'seller_name' },
      { header: '说明', field: 'remark' },
    ],
  },
];
