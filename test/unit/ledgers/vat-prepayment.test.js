const { expect } = require('chai');
const sinon = require('sinon');

const utilsPath = require.resolve('../../../lib/utils/index');
const configPath = require.resolve('../../../lib/config');

function createFakeUtils(sinon) {
  return {
    sleep: sinon.stub().resolves(),
    getTableRowCount: sinon.stub().resolves({ visible: 10 }),
    openSideMenu: sinon.stub().resolves(),
    clickDrawerItem: sinon.stub().resolves(),
    clickShowQuery: sinon.stub().resolves(),
    setDateRange: sinon.stub().resolves(),
    setTaxPeriod: sinon.stub().resolves(),
    clickPickerButton: sinon.stub().resolves(),
    pickFromDict: sinon.stub().resolves(),
    pickTaxSubject: sinon.stub().resolves(),
    closeBill: sinon.stub().resolves(),
    cdpEvaluateAndClick: sinon.stub().resolves({ clicked: true }),
    cdpEvaluate: sinon.stub().callsFake((code) => {
      if (code.includes("'closed'")) return Promise.resolve('closed');
      if (code.includes('hasQueryForm') || code.includes("document.getElementById('JINX_IPT_START-input')")) {
        return Promise.resolve(true);
      }
      if (code.includes('success')) return Promise.resolve({ success: true, x: 100, y: 100, tag: 'DIV' });
      if (code.includes('found')) {
        if (code.includes('radio') || code.includes('FD26IYC-w-l') || code.includes('DataSetFieldComboBox')) {
          return Promise.resolve({ found: true, x: 100, y: 100, id: 'radio1' });
        }
        if (code.includes('FormComboBoxDJZT')) return Promise.resolve({ found: true, x: 100, y: 100 });
        if (code.includes('FormTextInput1-input')) return Promise.resolve({ found: true });
        if (code.includes('FD26IYC-O-d')) return Promise.resolve({ found: true });
        // 通用 found 返回（查询按钮等）
        return Promise.resolve({ found: true, x: 100, y: 100 });
      }
      // vat-prepayment: 单据类型输入框查找
      if (code.includes('完税预缴单') || code.includes('预缴计算单')) {
        return Promise.resolve({ found: true, x: 100, y: 100, value: '预缴计算单' });
      }
      return Promise.resolve(true);
    }),
    cdpClick: sinon.stub().resolves(),
    cdpFindElementByText: sinon.stub().resolves({ found: true, x: 100, y: 100 }),
    cdpFindPickerButtonByInputId: sinon.stub().resolves({ found: true, x: 100, y: 100 }),
    cdpFindDropdownOption: sinon.stub().resolves({ found: true, x: 100, y: 100 }),
    cdpFindPopupElementByText: sinon.stub().resolves({ found: true, x: 100, y: 100 }),
    waitForPopup: sinon.stub().resolves({ found: false }),
  };
}

describe('ledgers/vat-prepayment', () => {
  let ledger;
  let configStub;
  let fakeUtils;
  let originalUtilsModule;

  beforeEach(() => {
    delete require.cache[require.resolve('../../../lib/ledgers/vat-prepayment')];
    delete require.cache[utilsPath];
    delete require.cache[configPath];

    originalUtilsModule = require.cache[utilsPath];

    fakeUtils = createFakeUtils(sinon);
    require.cache[utilsPath] = {
      id: utilsPath,
      filename: utilsPath,
      loaded: true,
      exports: fakeUtils,
    };

    const config = require('../../../lib/config');
    configStub = sinon.stub(config, 'get').returns({
      startPeriod: '2026-05',
      endPeriod: '2026-05',
      companyCode: '9999999999999999',
      taxCode: '91110000101107173B',
      docType: '预缴计算单',
    });

    ledger = require('../../../lib/ledgers/vat-prepayment');
  });

  afterEach(() => {
    sinon.restore();
    if (originalUtilsModule) {
      require.cache[utilsPath] = originalUtilsModule;
    } else {
      delete require.cache[utilsPath];
    }
    delete require.cache[configPath];
    delete require.cache[require.resolve('../../../lib/ledgers/vat-prepayment')];
  });

  it('should export exportVatPrepaymentLedger function', () => {
    expect(ledger.exportVatPrepaymentLedger).to.be.a('function');
  });

  it('should use config defaults including docType', async () => {
    const result = await ledger.exportVatPrepaymentLedger({ queryOnly: true });
    expect(configStub.called).to.equal(true);
    expect(result.queried).to.equal(true);
    expect(result.options.docType).to.equal('预缴计算单');
  });

  it('should allow docType override', async () => {
    const result = await ledger.exportVatPrepaymentLedger({
      docType: '增值税预缴',
      queryOnly: true,
    });
    expect(configStub.called).to.equal(true);
    expect(result.queried).to.equal(true);
    expect(result.options.docType).to.equal('增值税预缴');
  });
});
