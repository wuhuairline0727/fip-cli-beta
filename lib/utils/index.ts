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
const exported: Record<string, any> = {};

for (let i = 0; i < modules.length; i++) {
  const mod = modules[i];
  const name = moduleNames[i];
  for (const key of Object.keys(mod)) {
    if (Object.prototype.hasOwnProperty.call(exported, key)) {
      console.warn(
        `[fip-cli] 命名空间冲突: "${key}" 已存在于 ${exported[key]._source}，被 ${name} 覆盖`
      );
    }
    exported[key] = (mod as any)[key];
    exported[key]._source = name;
  }
}

export = exported;
