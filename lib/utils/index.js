const common = require('./common');
const navigation = require('./navigation');
const form = require('./form');
const picker = require('./picker');
const bill = require('./bill');
const cdp = require('./cdp');

module.exports = {
  ...common,
  ...navigation,
  ...form,
  ...picker,
  ...bill,
  ...cdp
};
