const fs = require('fs');
const path = require('path');
const os = require('os');

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
    endPeriod: `${lastMonthYear}-${mm}`
  };
}

const lastMonth = getLastMonthRange();

const DEFAULTS = {
  companyCode: '1000200020040011',
  taxCode: '91110000101107173B',
  startDate: lastMonth.startDate,
  endDate: lastMonth.endDate,
  startPeriod: lastMonth.startPeriod,
  endPeriod: lastMonth.endPeriod,
  voidStatus: '未作废',
  docStatus: '流程结束',
  docType: '预缴计算单',
  sellerCode: '91110000101107173B'
};

function loadConfig() {
  let config = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      config = { ...config, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
    } catch (e) {
      console.error('Warning: Failed to parse ~/.fiprc.json');
    }
  }
  if (fs.existsSync(LOCAL_CONFIG)) {
    try {
      config = { ...config, ...JSON.parse(fs.readFileSync(LOCAL_CONFIG, 'utf8')) };
    } catch (e) {
      console.error('Warning: Failed to parse fip.config.json');
    }
  }
  return { ...DEFAULTS, ...config };
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function get(key) {
  const config = loadConfig();
  return key ? config[key] : config;
}

function set(key, value) {
  const config = loadConfig();
  config[key] = value;
  saveConfig(config);
  return config;
}

module.exports = { loadConfig, saveConfig, get, set, CONFIG_FILE };
