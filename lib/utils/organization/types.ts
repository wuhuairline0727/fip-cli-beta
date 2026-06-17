/**
 * 组织机构模块类型定义
 * 从原 organization.ts 提取的所有接口
 */

export interface DialogField {
  id: string;
  value: string;
  placeholder: string;
}

export interface DialogValue {
  ok: boolean;
  error?: string;
  title?: string;
  fields?: Record<string, DialogField>;
  buttons?: string[];
}

export interface EvaluateResult {
  data?: {
    value?: DialogValue & Record<string, unknown>;
  };
}

export interface PopupItemsResult {
  ok: boolean;
  error?: string;
  title?: string;
  itemCount?: number;
  items?: Array<{ code: string; name: string; level: string }>;
  buttons?: string[];
}

export interface SwitchOrganizationOptions {
  organization?: string;
  project?: string;
  department?: string;
  fromCache?: boolean;
  autoSelect?: boolean;
}

export interface SwitchOrganizationResult {
  success: boolean;
  mode: string;
  current?: {
    organization: string;
    project: string;
    department: string;
    timestamp?: number;
  };
  selection?:
    | AutoSelectResult
    | { error: string; partial: AutoSelectResult }
    | null;
  cache?: {
    isNewRecord: boolean;
    totalRecords: number;
    uniqueOrganizations: string[];
  };
  matches?: Array<{
    organization: string;
    project: string;
    department: string;
    timestamp?: number;
  }>;
  matchCount?: number;
}

export interface AutoSelectResult {
  organization: { selected: boolean; name: string } | null;
  project: { selected: boolean; name: string } | null;
  department: { selected: boolean; name: string } | null;
}

export interface CloseResult {
  data?: {
    value?: {
      closed?: boolean;
    };
  };
}

export interface PopupCloseResult {
  data?: {
    value?: {
      closed?: number;
    };
  };
}

export interface QueryFillResult {
  data?: {
    value?: {
      found?: boolean;
      reason?: string;
      filled?: boolean;
    };
  };
}

export interface CheckResult {
  data?: {
    value?: {
      found?: boolean;
      reason?: string;
    };
  };
}

export interface PopupInfoResult {
  data?: {
    value?: {
      found?: boolean;
      reason?: string;
      departments?: string[];
      rowCount?: number;
    };
  };
}

export interface HeaderResult {
  data?: {
    value?: {
      found?: boolean;
      source?: string;
      organization?: string;
    };
  };
}

export interface CDPBtnResult {
  found?: boolean;
  reason?: string;
  x?: number;
  y?: number;
  candidate?: Record<string, unknown>;
}
