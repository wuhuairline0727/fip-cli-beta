/**
 * 单据配置注册表
 * 负责类型识别、配置加载和合并
 */

import * as path from 'path';
import {
  COMMON_BASE_PATTERNS,
  COMMON_INPUT_FIELDS,
  FILTER_CONFIG,
} from './common';

interface BillTypeMeta {
  name: string;
  codePrefix: string;
  configFile: string;
}

// === 类型元数据映射 ===
export const BILL_TYPE_MAP: Record<string, BillTypeMeta> = {
  SLBX: {
    name: '境内差旅报销单',
    codePrefix: 'SLBX',
    configFile: 'domestic-travel',
  },
  TBX: {
    name: '通用报销单',
    codePrefix: 'TBX',
    configFile: 'general-expense',
  },
  CFK: {
    name: '对外成本费用付款申请',
    codePrefix: 'CFK',
    configFile: 'external-payment',
  },
  CBX: {
    name: '差旅费报销',
    codePrefix: 'CBX',
    configFile: 'travel-expense',
  },
  YJK: {
    name: '预缴计算单',
    codePrefix: 'YJK',
    configFile: 'yjk',
  },
};

// 支持的单据编号前缀列表（按长度降序，避免短前缀误匹配）
const PREFIXES: string[] = Object.keys(BILL_TYPE_MAP).sort(
  (a, b) => b.length - a.length
);

/**
 * 通过单据编号前缀识别类型
 * @param billId - 单据编号
 * @returns 单据类型代码或 null
 */
export function detectBillType(billId: string | null | undefined): string | null {
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

interface SpecificConfig {
  basePatterns?: Record<string, RegExp>;
  inputFields?: Record<string, { byLabel?: string; byId?: string; byIdPrefix?: string }>;
  tables?: Array<{
    name: string;
    identifyBy: { headerText: string };
    columns: Array<{ header: string; field: string; type?: string }>;
  }>;
}

/**
 * 加载指定类型的完整配置
 * 合并通用配置和特定类型配置
 * @param type - 单据类型代码
 * @returns 完整配置对象或 null
 */
export function getBillConfig(
  type: string | null | undefined
): Record<string, unknown> | null {
  if (!type || typeof type !== 'string') {
    return null;
  }

  const upperType = type.toUpperCase();
  const meta = BILL_TYPE_MAP[upperType];
  if (!meta) {
    return null;
  }

  // 尝试加载特定类型配置（如果存在）
  let specificConfig: SpecificConfig = {};

  try {
    const specificPath = path.join(__dirname, meta.configFile);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    specificConfig = require(specificPath) as SpecificConfig;
  } catch {
    // 特定类型配置不存在，仅使用通用配置
  }

  return {
    name: meta.name,
    codePrefix: meta.codePrefix,
    basePatterns: {
      ...COMMON_BASE_PATTERNS,
      ...(specificConfig.basePatterns || {}),
    },
    inputFields: {
      ...COMMON_INPUT_FIELDS,
      ...(specificConfig.inputFields || {}),
    },
    tables: specificConfig.tables || [],
    filterConfig: FILTER_CONFIG,
  };
}
