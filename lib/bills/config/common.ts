import { GWT } from '../../selectors';

/**
 * 所有单据类型共有的基础字段配置
 * 用于 innerText 正则匹配和 input 元素提取
 */

export const COMMON_BASE_PATTERNS: Record<string, RegExp> = {
  bill_no: /单据编号[：:]\s*([A-Z0-9]+)/,
  submitter: /提单人[：:]\s*([^\n\r]+)/,
  // 状态徽章紧跟"自动填报"按钮之后，无"状态："前缀，
  // 在 innerText 中通常出现在标题行附近。匹配常见状态词。
  status: /(审批中|制单中|流程结束|已作废|未提交|已提交|已完成)/,
};

export const COMMON_INPUT_FIELDS: Record<
  string,
  { byId?: string; byIdPrefix?: string; byLabel?: string }
> = {
  reimbursement_reason: { byLabel: '报销事由' },
  payment_reason: { byLabel: '付款事由' },
  currency: { byLabel: '币种' },
  organization: { byLabel: '组织机构' },
  department: { byLabel: '业务部门' },
  project_name: { byLabel: '项目名称' },
  reimbursement_type: { byLabel: '报销属性' },
  budget_category: { byLabel: '预算类别' },
  tax_mode: { byLabel: '计税模式' },
  has_paper_attachment: { byLabel: '含原始纸质附件' },
  attachment_count: { byLabel: '附件个数' },
  submit_date: { byLabel: '提单日期' },
};

export const FILTER_CONFIG: Record<string, unknown> = {
  // 表头文本过滤：这些文本出现在数据行中时应视为表头行
  headerTexts: [
    '发票状态',
    '验真状态',
    '合规校验状态',
    '合规校验结果',
    '发票类型',
    '开票日期',
    '发票金额(含税)',
    '报销属性',
    '费用事项',
  ],
  // 发票状态词：name 字段为这些值且 reason 包含"发票"时，视为发票信息行
  invoiceStatusWords: ['正常', '异常', '作废'],
  // GWT 类名前缀（用于元素查找）
  gwtClassPrefix: GWT.PREFIX,
};
