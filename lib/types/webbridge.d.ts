/**
 * Kimi WebBridge API 类型定义
 * 基于 browser.js 实际 HTTP 请求/响应验证
 * 所有字段必须与浏览器返回的 JSON 结构一致
 */

export interface WebBridgeRequest {
  action: string;
  args?: Record<string, unknown>;
  session?: string;
}

export interface WebBridgeResponseData {
  value?: unknown;
  [key: string]: unknown;
}

export interface EvaluateData extends WebBridgeResponseData {
  value?: unknown;
}

export interface ScreenshotData extends WebBridgeResponseData {
  path?: string;
  data?: string;
}

export interface ListTabsData extends WebBridgeResponseData {
  success: boolean;
  tabs: TabInfo[];
}

export interface FindTabData extends WebBridgeResponseData {
  tabId: string;
  url?: string;
  title?: string;
  active?: boolean;
}

export type WebBridgeResponseDataUnion =
  | EvaluateData
  | ScreenshotData
  | ListTabsData
  | FindTabData
  | WebBridgeResponseData;

export interface WebBridgeResponse<
  T extends WebBridgeResponseData = WebBridgeResponseData,
> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface TabInfo {
  tabId: string;
  url: string;
  title?: string;
  active?: boolean;
}

export interface NavigateOptions {
  url: string;
  newTab?: boolean;
  group_title?: string;
}

export interface ScreenshotOptions {
  format?: 'png' | 'jpeg';
}

export type WebBridgeAction =
  | 'list_tabs'
  | 'find_tab'
  | 'navigate'
  | 'evaluate'
  | 'screenshot'
  | string;
