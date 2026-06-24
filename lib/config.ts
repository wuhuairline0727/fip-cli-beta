import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { validateConfigValue, validateConfig } from './config-schema';

export const CONFIG_FILE: string = path.join(os.homedir(), '.fiprc.json');
const LOCAL_CONFIG: string = path.join(process.cwd(), 'fip.config.json');

export interface LastMonthRange {
  startDate: string;
  endDate: string;
  startPeriod: string;
  endPeriod: string;
}

function getLastMonthRange(): LastMonthRange {
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

export interface ConfigDefaults {
  companyCode: string;
  taxCode: string;
  voidStatus: string;
  docStatus: string;
  docType: string;
  sellerCode: string;
}

export const DEFAULTS: ConfigDefaults = {
  companyCode: '00000000000000000000',
  taxCode: 'XXXXXXXXXXXXXXXXXX',
  voidStatus: '未作废',
  docStatus: '流程结束',
  docType: '预缴计算单',
  sellerCode: 'XXXXXXXXXXXXXXXXXX',
};

export interface FipConfig extends ConfigDefaults, LastMonthRange {
  [key: string]: unknown;
}

export function loadConfig(): FipConfig {
  let config: Record<string, unknown> = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      config = {
        ...config,
        ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')),
      };
    } catch (_e) {
      console.error('Warning: Failed to parse ~/.fiprc.json');
    }
  }
  if (fs.existsSync(LOCAL_CONFIG)) {
    try {
      config = {
        ...config,
        ...JSON.parse(fs.readFileSync(LOCAL_CONFIG, 'utf8')),
      };
    } catch (_e) {
      console.error('Warning: Failed to parse fip.config.json');
    }
  }
  const lastMonth = getLastMonthRange();
  return {
    ...DEFAULTS,
    startDate: lastMonth.startDate,
    endDate: lastMonth.endDate,
    startPeriod: lastMonth.startPeriod,
    endPeriod: lastMonth.endPeriod,
    ...config,
  } as FipConfig;
}

export function saveConfig(config: Record<string, unknown>): void {
  const tmpFile = CONFIG_FILE + '.tmp';
  fs.writeFileSync(tmpFile, JSON.stringify(config, null, 2));
  fs.renameSync(tmpFile, CONFIG_FILE);
}

function _get(key?: string): unknown {
  const config = loadConfig();
  if (key) {
    return config[key];
  }
  return {
    ...config,
    _validation: { errors: validateConfig(config) },
  };
}

function _set(key: string, value: unknown): FipConfig {
  const error = validateConfigValue(key, value);
  if (error) {
    throw new Error(`配置验证失败: ${error}`);
  }
  const config = loadConfig();
  config[key] = value;
  saveConfig(config);
  return config;
}

export function get(key?: string): unknown {
  return _get(key);
}

export function set(key: string, value: unknown): FipConfig {
  return _set(key, value);
}
