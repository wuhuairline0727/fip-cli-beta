import { expect } from 'chai';
import sinon from 'sinon';
import proxyquire from 'proxyquire';

const utilsPath = require.resolve('../../../lib/utils/index');
const configPath = require.resolve('../../../lib/config');

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
  };
}

describe('ledgers/input-transfer', () => {
  let ledger: any;
  let configGetCalled: boolean;
  let fakeUtils: any;

  beforeEach(() => {
    configGetCalled = false;
    fakeUtils = createFakeUtils(sinon);

    // 使用 proxyquire 模拟 config 和 utils
    ledger = proxyquire('../../../lib/ledgers/input-transfer', {
      '../config': {
        get: () => {
          configGetCalled = true;
          return {
            startPeriod: '2026-05',
            endPeriod: '2026-05',
            companyCode: '9999999999999999',
            taxCode: '91110000101107173B',
            docStatus: '审批中',
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

  it('should export exportInputTransferLedger function', () => {
    expect(ledger.exportInputTransferLedger).to.be.a('function');
  });

  it('should use config defaults when no options provided', async () => {
    const result = await ledger.exportInputTransferLedger({ queryOnly: true });
    expect(configGetCalled).to.equal(true);
    expect(result.queried).to.equal(true);
    expect(result.options.startPeriod).to.equal('2026-05');
    expect(result.options.endPeriod).to.equal('2026-05');
    expect(result.options.companyCode).to.equal('9999999999999999');
    expect(result.options.taxCode).to.equal('91110000101107173B');
    expect(result.options.docStatus).to.equal('审批中');
  });

  it('should allow options to override config defaults', async () => {
    const result = await ledger.exportInputTransferLedger({
      startPeriod: '2026-06',
      endPeriod: '2026-06',
      companyCode: '1111111111111111',
      taxCode: '91110000101638302P',
      docStatus: '流程结束',
      queryOnly: true,
    });
    expect(configGetCalled).to.equal(true);
    expect(result.queried).to.equal(true);
    expect(result.options.startPeriod).to.equal('2026-06');
    expect(result.options.endPeriod).to.equal('2026-06');
    expect(result.options.companyCode).to.equal('1111111111111111');
    expect(result.options.taxCode).to.equal('91110000101638302P');
    expect(result.options.docStatus).to.equal('流程结束');
  });
});
