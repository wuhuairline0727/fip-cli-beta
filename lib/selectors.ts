/**
 * DOM 选择器常量集中管理
 * 所有 GWT 类名、FIP ID 前缀、Ant Design 组件类名统一在此维护
 * FIP 前端升级时只需修改此文件即可适配新的类名前缀
 */

// === GWT 框架编译类名（随机前缀，升级可能变化）===
export const GWT = {
  /** GWT 类名前缀 */
  PREFIX: 'FD26IYC',
  /** 表格行 */
  TABLE_ROW: 'tr[class*="FD26IYC"]',
  /** 下拉选项 */
  DROPDOWN_ITEM: '.FD26IYC-S-a',
  /** Picker 按钮（蓝色小按钮） */
  PICKER_BTN: 'div.FD26IYC-w-l',
  /** 弹窗容器 */
  POPUP: '.FD26IYC-a-g',
  /** 按钮样式 - 主按钮 */
  BUTTON_PRIMARY: 'FD26IYC-D-d',
  /** 按钮样式 - 次按钮 */
  BUTTON_SECONDARY: 'FD26IYC-D-o',
  /** GWT 对话框 */
  DIALOG_BOX: '.gwt-DialogBox',
  /** 对话框内容（模糊匹配） */
  DIALOG_BOX_FUZZY: '[class*=DialogBox]',
} as const;

// === FIP 业务模块 ID 前缀 ===
export const FIP_ID = {
  /** 开票申请单 */
  KP: {
    PREFIX: 'SW_STO_KPSQDF',
  },
  /** 预缴计算单 */
  YJK: {
    PREFIX: 'SW_STO_YJKF',
  },
  /** 通用表单组件 */
  FORM: {
    COMBO_BOX: 'FormComboBox',
    TEXT_INPUT: 'FormTextInput',
    DATE_FIELD: 'FormDateField',
    DATE_FIELD_YM: 'FormDateFieldYM',
    INTEGER_FIELD: 'FormIntegerField',
  },
  /** 帮助下拉框 */
  HELP_COMBO_BOX: 'HelpComboBox',
  /** 数据集下拉框 */
  DATA_SET_COMBO_BOX: 'DataSetFieldComboBox',
} as const;

// === Ant Design 组件类名（相对稳定）===
export const ANT = {
  /** 模态框外层 */
  MODAL_WRAP: '.ant-modal-wrap',
  /** 模态框 */
  MODAL: '.ant-modal',
  /** 模态框内容 */
  MODAL_CONTENT: '.ant-modal-content',
  /** 模态框关闭按钮 */
  MODAL_CLOSE: '.ant-modal-close',
  /** 模态框标题 */
  MODAL_TITLE: '.ant-modal-title',
  /** 行布局 */
  ROW: '.ant-row',
  /** 表单项 */
  FORM_ITEM: '.ant-form-item',
  /** 表单项标签 */
  FORM_ITEM_LABEL: '.ant-form-item-label',
  /** 标签页关闭按钮 */
  TABS_TAB_REMOVE: '.ant-tabs-tab-remove',
  /** 消息提示 */
  MESSAGE: '.ant-message',
  /** 通知 */
  NOTIFICATION: '.ant-notification',
  /** 按钮 */
  BTN: '.ant-btn',
  /** 标签页 */
  TABS_TAB: '.ant-tabs-tab',
} as const;

// === 页面元素选择器 ===
export const PAGE = {
  /** 切换组织机构图片 */
  SWITCH_ORG_IMG: 'img[src*="qhzz"]',
  /** 单据编号输入框 */
  BILL_NO_INPUT: 'FormTextInputDJBH-input',
} as const;

// === 弹窗/对话框关闭按钮文本 ===
export const DIALOG_CLOSE_TEXTS = [
  '确定',
  '确认',
  '关闭',
  '知道了',
  '取消',
] as const;
