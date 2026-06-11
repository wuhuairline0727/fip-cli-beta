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

export interface WebBridgeResponse<T = unknown> {
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
