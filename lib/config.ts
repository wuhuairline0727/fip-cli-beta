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

const DEFAULTS: ConfigDefaults = {
  companyCode: '1000200020040011',
  taxCode: '91110000101638302P',
  voidStatus: '未作废',
  docStatus: '流程结束',
  docType: '预缴计算单',
  sellerCode: '91110000101638302P',
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
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function get(key?: string): unknown {
  const config = loadConfig();
  if (key) {
    return config[key];
  }
  return {
    ...config,
    _validation: { errors: validateConfig(config) },
  };
}

export function set(key: string, value: unknown): FipConfig {
  const error = validateConfigValue(key, value);
  if (error) {
    throw new Error(`配置验证失败: ${error}`);
  }
  const config = loadConfig();
  config[key] = value;
  saveConfig(config);
  return config;
}
