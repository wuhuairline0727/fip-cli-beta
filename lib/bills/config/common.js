/**
 * 所有单据类型共有的基础字段配置
 * 用于 innerText 正则匹配和 input 元素提取
 */

// === innerText 正则模式（基础字段）===
const COMMON_BASE_PATTERNS = {
  bill_no: /单据编号[：:]\s*([A-Z]{2,4}\d{10,20})/,
  submitter: /提单人[：:]\s*([^\n\r]+)/,
  bill_date: /提单日期[：:]\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/,
  status: /状态[：:]\s*([^\n\r]+)/,
  attachment_count: /附件个数[：:]\s*([0-9]+)/,
};

// === input 字段映射（通用字段）===
const COMMON_INPUT_FIELDS = {
  note: 'SW_STO_NOTE-input',
  currency: 'SW_STO_CURRENCY-input',
  organization: 'SW_STO_ORG-input',
  business_department: 'SW_STO_DEPT-input',
  project_name: 'SW_STO_PROJECT-input',
  expense_attribute: 'SW_STO_EXPENSE_ATTR-input',
  tax_method: 'SW_STO_TAX_METHOD-input',
  has_original_paper: 'SW_STO_HAS_PAPER-input',
};

module.exports = {
  COMMON_BASE_PATTERNS,
  COMMON_INPUT_FIELDS,
};
