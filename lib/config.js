const fs = require('fs');
const path = require('path');
const os = require('os');
const { validateConfigValue, validateConfig } = require('./config-schema');

const CONFIG_FILE = path.join(os.homedir(), '.fiprc.json');
const LOCAL_CONFIG = path.join(process.cwd(), 'fip.config.json');

function getLastMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11
  const lastMonth = month === 0 ? 12 : month;
  const lastMonthYear = month === 0 ? year - 1 : year;
  const mm = String(lastMonth).padStart(2, '0');
  const lastDay = new Date(lastMonthYear, lastMonth, 0).getDate();
  return {
    startDate: `${lastMonthYear}-${mm}-01`,
    endDate: `${lastMonthYear}-${mm}-${String(lastDay).padStart(2, '0')}`,
    startPeriod: `${lastMonthYear}-${mm}`,
    endPeriod: `${lastMonthYear}-${mm}`,
  };
}

// 移除模块加载时计算的 lastMonth，改为 loadConfig 中动态计算
// const lastMonth = getLastMonthRange();

const DEFAULTS = {
  companyCode: '1000200020040011',
  // 91110000101638302P — 中国建筑一局（集团）有限公司（日常使用税号）
  // 91110000101107173B — 另一纳税主体
  taxCode: '91110000101638302P',
  voidStatus: '未作废',
  docStatus: '流程结束',
  docType: '预缴计算单',
  // sellerCode 默认与 taxCode 保持一致
  sellerCode: '91110000101638302P',
};

function loadConfig() {
  let config = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      config = {
        ...config,
        ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')),
      };
    } catch (e) {
      console.error('Warning: Failed to parse ~/.fiprc.json');
    }
  }
  if (fs.existsSync(LOCAL_CONFIG)) {
    try {
      config = {
        ...config,
        ...JSON.parse(fs.readFileSync(LOCAL_CONFIG, 'utf8')),
      };
    } catch (e) {
      console.error('Warning: Failed to parse fip.config.json');
    }
  }
  // 日期字段每次动态计算，避免长驻进程跨月不刷新
  const lastMonth = getLastMonthRange();
  return {
    ...DEFAULTS,
    startDate: lastMonth.startDate,
    endDate: lastMonth.endDate,
    startPeriod: lastMonth.startPeriod,
    endPeriod: lastMonth.endPeriod,
    ...config,
  };
}

function saveConfig(config) {
  const tmpFile = CONFIG_FILE + '.tmp';
  fs.writeFileSync(tmpFile, JSON.stringify(config, null, 2));
  fs.renameSync(tmpFile, CONFIG_FILE);
}

function get(key) {
  const config = loadConfig();
  if (key) {
    return config[key];
  }
  return {
    ...config,
    _validation: { errors: validateConfig(config) },
  };
}

function set(key, value) {
  const error = validateConfigValue(key, value);
  if (error) {
    throw new Error(`配置验证失败: ${error}`);
  }
  const config = loadConfig();
  config[key] = value;
  saveConfig(config);
  return config;
}

module.exports = { loadConfig, saveConfig, get, set, CONFIG_FILE };
