const common = require('./common');
const navigation = require('./navigation');
const form = require('./form');
const picker = require('./picker');
const bill = require('./bill');
const cdp = require('./cdp');
const table = require('./table');
const attachment = require('./attachment');

module.exports = {
  ...common,
  ...navigation,
  ...form,
  ...picker,
  ...bill,
  ...cdp,
  ...table,
  ...attachment
};
