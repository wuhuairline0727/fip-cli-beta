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

type UtilsModule = {
  [K in keyof (typeof common &
    typeof navigation &
    typeof form &
    typeof picker &
    typeof bill &
    typeof cdp &
    typeof table &
    typeof attachment &
    typeof dialog &
    typeof organization)]: (typeof common &
    typeof navigation &
    typeof form &
    typeof picker &
    typeof bill &
    typeof cdp &
    typeof table &
    typeof attachment &
    typeof dialog &
    typeof organization)[K] & {
    _source?: string;
  };
};

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

const _exported: UtilsModule = exported as unknown as UtilsModule;
export = _exported;
