/**
 * Config 模块类型声明
 * 补充 lib/config.ts 运行时动态导出的静态类型声明
 */

export interface LastMonthRange {
  startDate: string;
  endDate: string;
  startPeriod: string;
  endPeriod: string;
}

export interface ConfigDefaults {
  companyCode: string;
  taxCode: string;
  voidStatus: string;
  docStatus: string;
  docType: string;
  sellerCode: string;
}

export interface FipConfig extends ConfigDefaults, LastMonthRange {
  [key: string]: unknown;
}

export declare const CONFIG_FILE: string;

export declare function loadConfig(): FipConfig;
export declare function saveConfig(config: Record<string, unknown>): void;
export declare function get(key?: string): unknown;
export declare function set(key: string, value: unknown): FipConfig;
