const common = require('./common');
const navigation = require('./navigation');
const form = require('./form');
const picker = require('./picker');
const bill = require('./bill');
const cdp = require('./cdp');
const table = require('./table');
const attachment = require('./attachment');
const dialog = require('./dialog');

const modules = [common, navigation, form, picker, bill, cdp, table, attachment, dialog];
const moduleNames = ['common', 'navigation', 'form', 'picker', 'bill', 'cdp', 'table', 'attachment', 'dialog'];
const exported = {};

for (let i = 0; i < modules.length; i++) {
  const mod = modules[i];
  const name = moduleNames[i];
  for (const key of Object.keys(mod)) {
    if (exported.hasOwnProperty(key)) {
      console.warn(`[fip-cli] 命名空间冲突: "${key}" 已存在于 ${exported[key]._source}，被 ${name} 覆盖`);
    }
    exported[key] = mod[key];
    exported[key]._source = name;
  }
}

module.exports = exported;
