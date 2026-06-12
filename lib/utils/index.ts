import * as common from './common';
import * as navigation from './navigation';
import * as form from './form';
import * as picker from './picker';
import * as bill from './bill';
import * as cdp from './cdp';
import * as table from './table';
import * as attachment from './attachment';
import * as dialog from './dialog';
import * as organization from './organization';

// 重导出所有子模块的命名导出
export * from './common';
export * from './navigation';
export * from './form';
export * from './picker';
export * from './bill';
export * from './cdp';
export * from './table';
export * from './attachment';
export * from './dialog';
export * from './organization';

// 动态合并所有模块（用于默认导出和运行时检测命名冲突）
const modules = [
  common,
  navigation,
  form,
  picker,
  bill,
  cdp,
  table,
  attachment,
  dialog,
  organization,
];
const moduleNames = [
  'common',
  'navigation',
  'form',
  'picker',
  'bill',
  'cdp',
  'table',
  'attachment',
  'dialog',
  'organization',
];
const exported: Record<string, unknown> = {};

for (let i = 0; i < modules.length; i++) {
  const mod = modules[i];
  const name = moduleNames[i];
  for (const key of Object.keys(mod)) {
    if (Object.prototype.hasOwnProperty.call(exported, key)) {
      console.warn(
        `[fip-cli] 命名空间冲突: "${key}" 已存在于 ${(exported[key] as Record<string, unknown>)._source}，被 ${name} 覆盖`
      );
    }
    exported[key] = (mod as Record<string, unknown>)[key];
    (exported[key] as Record<string, unknown>)._source = name;
  }
}

export default exported as Record<string, unknown>;
