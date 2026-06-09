/**
 * 单据配置注册表
 * 负责类型识别、配置加载和合并
 */

const path = require('path');
const { COMMON_BASE_PATTERNS, COMMON_INPUT_FIELDS } = require('./common');

// === 类型元数据映射 ===
const BILL_TYPE_MAP = {
  SLBX: {
    name: '差旅报销单',
    codePrefix: 'SLBX',
  },
  TBX: {
    name: '通用报销单',
    codePrefix: 'TBX',
  },
  CFK: {
    name: '差旅借款单',
    codePrefix: 'CFK',
  },
  CBX: {
    name: '成本报销单',
    codePrefix: 'CBX',
  },
};

// 支持的单据编号前缀列表（按长度降序，避免短前缀误匹配）
const PREFIXES = Object.keys(BILL_TYPE_MAP).sort((a, b) => b.length - a.length);

/**
 * 通过单据编号前缀识别类型
 * @param {string} billId - 单据编号
 * @returns {string|null} 单据类型代码或 null
 */
function detectBillType(billId) {
  if (!billId || typeof billId !== 'string') {
    return null;
  }
  for (const prefix of PREFIXES) {
    if (billId.startsWith(prefix)) {
      return prefix;
    }
  }
  return null;
}

/**
 * 加载指定类型的完整配置
 * 合并通用配置和特定类型配置
 * @param {string} type - 单据类型代码
 * @returns {Object|null} 完整配置对象或 null
 */
function getBillConfig(type) {
  if (!type || typeof type !== 'string') {
    return null;
  }

  const upperType = type.toUpperCase();
  const meta = BILL_TYPE_MAP[upperType];
  if (!meta) {
    return null;
  }

  // 尝试加载特定类型配置（如果存在）
  let specificPatterns = {};
  let specificInputs = {};

  try {
    const specificPath = path.join(__dirname, `${upperType.toLowerCase()}.js`);
    const specific = require(specificPath);
    if (specific && specific.SPECIFIC_BASE_PATTERNS) {
      specificPatterns = specific.SPECIFIC_BASE_PATTERNS;
    }
    if (specific && specific.SPECIFIC_INPUT_FIELDS) {
      specificInputs = specific.SPECIFIC_INPUT_FIELDS;
    }
  } catch (e) {
    // 特定类型配置不存在，仅使用通用配置
  }

  return {
    name: meta.name,
    codePrefix: meta.codePrefix,
    basePatterns: {
      ...COMMON_BASE_PATTERNS,
      ...specificPatterns,
    },
    inputFields: {
      ...COMMON_INPUT_FIELDS,
      ...specificInputs,
    },
  };
}

module.exports = {
  detectBillType,
  getBillConfig,
  BILL_TYPE_MAP,
};
