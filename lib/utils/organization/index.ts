/**
 * 组织机构模块统一导出（Barrel）
 * 保持外部 import 路径兼容：import { switchOrganization } from './organization'
 */

// 类型定义
export type {
  DialogField,
  DialogValue,
  PopupItemsResult,
  SwitchOrganizationOptions,
  SwitchOrganizationResult,
  AutoSelectResult,
  CDPBtnResult,
} from './types';

// 对话框生命周期
export {
  closeAllOrgDialogs,
  openSwitchOrgDialog,
  readDialogFields,
  closeSwitchOrgDialog,
} from './dialog';

// 弹窗操作
export {
  queryAndSelectInPopup,
  selectFirstDepartment,
  readPickerPopupItems,
  closePickerPopup,
  clickRefreshButton,
} from './popup';

// 系统提示
export { clickSystemConfirm } from './system';

// 高阶业务流程
export {
  getCurrentOrganization,
  switchOrganization,
  tryAutoSelect,
} from './workflow';

// 超时工具（可选导出）
export { waitForDomStable, pollForCondition } from './wait-utils';
