const CONFIG_SCHEMA = {
  companyCode: { type: 'string', pattern: /^\d+$/, message: '公司代码应为纯数字' },
  taxCode: { type: 'string', pattern: /^[A-Z0-9]{15,20}$/i, message: '税号应为15-20位字母数字' },
  startDate: { type: 'date', pattern: /^\d{4}-\d{2}-\d{2}$/, message: '日期格式应为 YYYY-MM-DD' },
  endDate: { type: 'date', pattern: /^\d{4}-\d{2}-\d{2}$/, message: '日期格式应为 YYYY-MM-DD' },
  startPeriod: { type: 'string', pattern: /^\d{4}-\d{2}$/, message: '期间格式应为 YYYY-MM' },
  endPeriod: { type: 'string', pattern: /^\d{4}-\d{2}$/, message: '期间格式应为 YYYY-MM' },
  docStatus: { type: 'string' },
  voidStatus: { type: 'string' },
  docType: { type: 'string' },
  sellerCode: { type: 'string', pattern: /^[A-Z0-9]{15,20}$/i, message: '销方税号应为15-20位字母数字' },
};

function validateConfigValue(key, value) {
  const schema = CONFIG_SCHEMA[key];
  if (!schema) return null; // 未知配置项，不验证
  if (value === null || value === undefined || value === '') return null; // 空值不验证

  if (schema.pattern && !schema.pattern.test(String(value))) {
    return schema.message || `${key} 格式不正确: ${value}`;
  }
  return null;
}

function validateConfig(config) {
  const errors = [];
  for (const [key, value] of Object.entries(config)) {
    const error = validateConfigValue(key, value);
    if (error) errors.push(error);
  }
  return errors;
}

module.exports = { CONFIG_SCHEMA, validateConfigValue, validateConfig };
