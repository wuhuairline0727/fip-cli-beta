export interface ConfigSchemaEntry {
  type: string;
  pattern?: RegExp;
  message?: string;
}

export interface ConfigSchema {
  [key: string]: ConfigSchemaEntry;
}

export const CONFIG_SCHEMA: ConfigSchema = {
  companyCode: {
    type: 'string',
    pattern: /^\d+$/,
    message: '公司代码应为纯数字',
  },
  taxCode: {
    type: 'string',
    pattern: /^[A-Z0-9]{15,20}$/i,
    message: '税号应为15-20位字母数字',
  },
  startDate: {
    type: 'date',
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    message: '日期格式应为 YYYY-MM-DD',
  },
  endDate: {
    type: 'date',
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    message: '日期格式应为 YYYY-MM-DD',
  },
  startPeriod: {
    type: 'string',
    pattern: /^\d{4}-\d{2}$/,
    message: '期间格式应为 YYYY-MM',
  },
  endPeriod: {
    type: 'string',
    pattern: /^\d{4}-\d{2}$/,
    message: '期间格式应为 YYYY-MM',
  },
  docStatus: { type: 'string' },
  voidStatus: { type: 'string' },
  docType: { type: 'string' },
  sellerCode: {
    type: 'string',
    pattern: /^[A-Z0-9]{15,20}$/i,
    message: '销方税号应为15-20位字母数字',
  },
};

export function validateConfigValue(key: string, value: unknown): string | null {
  const schema = CONFIG_SCHEMA[key];
  if (!schema) return null;
  if (value === null || value === undefined || value === '') return null;

  if (schema.pattern && !schema.pattern.test(String(value))) {
    return schema.message || `${key} 格式不正确: ${value}`;
  }
  return null;
}

export function validateConfig(config: Record<string, unknown>): string[] {
  const errors: string[] = [];
  for (const [key, value] of Object.entries(config)) {
    const error = validateConfigValue(key, value);
    if (error) errors.push(error);
  }
  return errors;
}
