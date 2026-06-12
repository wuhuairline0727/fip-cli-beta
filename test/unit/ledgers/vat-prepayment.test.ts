import { expect } from 'chai';
import sinon from 'sinon';
import proxyquire from 'proxyquire';

function createFakeUtils(sinonInstance: typeof sinon) {
  return {
    sleep: sinonInstance.stub().resolves(),
    getTableRowCount: sinonInstance.stub().resolves({ visible: 10 }),
    openSideMenu: sinonInstance.stub().resolves(),
    clickDrawerItem: sinonInstance.stub().resolves(),
    clickShowQuery: sinonInstance.stub().resolves(),
    setDateRange: sinonInstance.stub().resolves(),
    setTaxPeriod: sinonInstance.stub().resolves(),
    clickPickerButton: sinonInstance.stub().resolves(),
    pickFromDict: sinonInstance.stub().resolves(),
    pickTaxSubject: sinonInstance.stub().resolves(),
    closeBill: sinonInstance.stub().resolves(),
    cdpEvaluateAndClick: sinonInstance.stub().resolves({ clicked: true }),
    cdpEvaluate: sinonInstance.stub().callsFake((code: string) => {
      if (code.includes("'closed'")) return Promise.resolve('closed');
      if (
        code.includes('hasQueryForm') ||
        code.includes("document.getElementById('JINX_IPT_START-input')")
      ) {
        return Promise.resolve(true);
      }
      if (code.includes('success'))
        return Promise.resolve({ success: true, x: 100, y: 100, tag: 'DIV' });
      if (code.includes('found')) {
        if (
          code.includes('radio') ||
          code.includes('FD26IYC-w-l') ||
          code.includes('DataSetFieldComboBox')
        ) {
          return Promise.resolve({ found: true, x: 100, y: 100, id: 'radio1' });
        }
        if (code.includes('FormComboBoxDJZT'))
          return Promise.resolve({ found: true, x: 100, y: 100 });
        if (code.includes('FormTextInput1-input'))
          return Promise.resolve({ found: true });
        if (code.includes('FD26IYC-O-d'))
          return Promise.resolve({ found: true });
        // 通用 found 返回（查询按钮等）
        return Promise.resolve({ found: true, x: 100, y: 100 });
      }
      // vat-prepayment: 单据类型输入框查找
      if (code.includes('完税预缴单') || code.includes('预缴计算单')) {
        return Promise.resolve({
          found: true,
          x: 100,
          y: 100,
          value: '预缴计算单',
        });
      }
      return Promise.resolve(true);
    }),
    cdpClick: sinonInstance.stub().resolves(),
    cdpFindElementByText: sinonInstance
      .stub()
      .resolves({ found: true, x: 100, y: 100 }),
    cdpFindPickerButtonByInputId: sinonInstance
      .stub()
      .resolves({ found: true, x: 100, y: 100 }),
    cdpFindDropdownOption: sinonInstance
      .stub()
      .resolves({ found: true, x: 100, y: 100 }),
    cdpFindPopupElementByText: sinonInstance
      .stub()
      .resolves({ found: true, x: 100, y: 100 }),
    waitForPopup: sinonInstance.stub().resolves({ found: false }),
  };
}

describe('ledgers/vat-prepayment', () => {
  let ledger: any;
  let configGetCalled: boolean;
  let fakeUtils: any;

  beforeEach(() => {
    configGetCalled = false;
    fakeUtils = createFakeUtils(sinon);

    ledger = proxyquire('../../../lib/ledgers/vat-prepayment', {
      '../config': {
        get: () => {
          configGetCalled = true;
          return {
            startPeriod: '2026-05',
            endPeriod: '2026-05',
            companyCode: '9999999999999999',
            taxCode: '91110000101107173B',
            docType: '预缴计算单',
          };
        },
        CONFIG_FILE: '/fake/.fiprc.json',
      },
      '../utils/index': fakeUtils,
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should export exportVatPrepaymentLedger function', () => {
    expect(ledger.exportVatPrepaymentLedger).to.be.a('function');
  });

  it('should use config defaults including docType', async () => {
    const result = await ledger.exportVatPrepaymentLedger({ queryOnly: true });
    expect(configGetCalled).to.equal(true);
    expect(result.queried).to.equal(true);
    expect(result.options.docType).to.equal('预缴计算单');
  });

  it('should allow docType override', async () => {
    const result = await ledger.exportVatPrepaymentLedger({
      docType: '增值税预缴',
      queryOnly: true,
    });
    expect(configGetCalled).to.equal(true);
    expect(result.queried).to.equal(true);
    expect(result.options.docType).to.equal('增值税预缴');
  });
});
