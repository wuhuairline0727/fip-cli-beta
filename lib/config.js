const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_FILE = path.join(os.homedir(), '.fiprc.json');
const LOCAL_CONFIG = path.join(process.cwd(), 'fip.config.json');

const DEFAULTS = {
  companyCode: '1000200020040011',
  taxCode: '91110000101107173B',
  startDate: '2026-04-01',
  endDate: '2026-04-30',
  startPeriod: '2026-04',
  endPeriod: '2026-04',
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
