import { expect } from 'chai';
import sinon from 'sinon';

// 由于 organization.js 依赖 browser.js 的 evaluate/click，
// 我们使用 require.cache 注入 fake browser 模块来测试
const fakeBrowser = {
  evaluate: sinon.stub(),
  click: sinon.stub(),
};

const fakeCDP = {
  cdpEvaluate: sinon.stub().resolves({ ok: true }),
  cdpClick: sinon.stub().resolves({ ok: true }),
  cdpEvaluateAndClick: sinon.stub().resolves({ ok: true, clicked: true }),
  cdpFindPickerButtonByInputId: sinon
    .stub()
    .resolves({ found: true, x: 100, y: 100 }),
  cdpFindPopupElementByText: sinon
    .stub()
    .resolves({ found: true, x: 100, y: 100 }),
  cdpFindElementByText: sinon.stub().resolves({ found: true, x: 100, y: 100 }),
  cdpFindDropdownOption: sinon.stub().resolves({ found: true, x: 100, y: 100 }),
};

const fakeLogger = {
  debug: sinon.stub(),
};

// 注入 fake 模块
const browserPath = require.resolve('../../../lib/browser');
const cdpPath = require.resolve('../../../lib/utils/cdp');
const loggerPath = require.resolve('../../../lib/logger');

// 清除所有相关模块缓存，确保重新加载时获取注入的 fake 模块
[
  browserPath,
  cdpPath,
  loggerPath,
  require.resolve('../../../lib/utils/organization'),
  require.resolve('../../../lib/utils/organization/index'),
  require.resolve('../../../lib/utils/organization/dialog'),
  require.resolve('../../../lib/utils/organization/workflow'),
  require.resolve('../../../lib/utils/organization/system'),
  require.resolve('../../../lib/utils/organization/popup'),
  require.resolve('../../../lib/utils/organization/types'),
  require.resolve('../../../lib/utils/organization/wait-utils'),
  require.resolve('../../../lib/utils/organization-cache'),
  require.resolve('../../../lib/selectors'),
  require.resolve('../../../lib/utils/common'),
].forEach((p) => {
  delete require.cache[p];
});

require.cache[browserPath] = {
  id: browserPath,
  filename: browserPath,
  loaded: true,
  exports: fakeBrowser,
} as any;

require.cache[cdpPath] = {
  id: cdpPath,
  filename: cdpPath,
  loaded: true,
  exports: fakeCDP,
} as any;

require.cache[loggerPath] = {
  id: loggerPath,
  filename: loggerPath,
  loaded: true,
  exports: fakeLogger,
} as any;

// 清除之前的缓存，确保加载新模块
delete require.cache[require.resolve('../../../lib/utils/organization')];

const {
  openSwitchOrgDialog,
  closeSwitchOrgDialog,
  getCurrentOrganization,
  switchOrganization,
} = require('../../../lib/utils/organization');

describe('utils/organization', () => {
  beforeEach(() => {
    fakeBrowser.evaluate.reset();
    fakeBrowser.click.reset();
    fakeLogger.debug.reset();
    // 重置所有 fakeCDP stubs
    Object.values(fakeCDP).forEach((stub: any) => {
      if (typeof stub.reset === 'function') stub.reset();
      if (typeof stub.resetBehavior === 'function') stub.resetBehavior();
      if (typeof stub.resolves === 'function') stub.resolves({ ok: true });
    });
  });

  describe('openSwitchOrgDialog()', () => {
    it('should click switch org button and return dialog info', async () => {
      // closeAllOrgDialogs 第一次调用（关闭对话框）
      fakeBrowser.evaluate
        .onFirstCall()
        .resolves({ data: { value: { closed: false } } });

      // closeAllOrgDialogs 第二次调用（关闭弹窗）
      fakeBrowser.evaluate
        .onSecondCall()
        .resolves({ data: { value: { closed: 0 } } });

      // 模拟点击成功
      fakeBrowser.evaluate
        .onThirdCall()
        .resolves({ data: { value: { ok: true } } });

      // 模拟对话框内容
      fakeBrowser.evaluate.onCall(3).resolves({
        data: {
          value: {
            ok: true,
            title: '切换组织机构',
            fields: {
              组织机构: {
                id: 'DataSetFieldComboBox1-input',
                value: '测试公司',
              },
              项目名称: {
                id: 'DataSetFieldComboBox3-input',
                value: '测试项目',
              },
              部门名称: {
                id: 'DataSetFieldComboBox2-input',
                value: '测试部门',
              },
              板块编号: { id: 'FormTextInput2-input', value: '0101' },
              板块名称: { id: 'FormTextInput3-input', value: '住宅' },
              利润中心: { id: 'FormTextInput1-input', value: '测试项目' },
            },
            buttons: ['刷新', '确定', '取消'],
          },
        },
      });

      const result = await openSwitchOrgDialog();

      expect(fakeBrowser.evaluate.callCount).to.equal(4);
      expect(result.ok).to.be.true;
      expect(result.title).to.equal('切换组织机构');
      expect(result.fields['组织机构'].value).to.equal('测试公司');
      expect(result.fields['项目名称'].value).to.equal('测试项目');
      expect(result.fields['部门名称'].value).to.equal('测试部门');
      expect(result.fields['板块编号'].value).to.equal('0101');
      expect(result.fields['板块名称'].value).to.equal('住宅');
      expect(result.fields['利润中心'].value).to.equal('测试项目');
      expect(result.buttons).to.deep.equal(['刷新', '确定', '取消']);
    });

    it('should throw error when switch org button not found', async () => {
      // closeAllOrgDialogs 调用
      fakeBrowser.evaluate
        .onFirstCall()
        .resolves({ data: { value: { closed: false } } });
      fakeBrowser.evaluate
        .onSecondCall()
        .resolves({ data: { value: { closed: 0 } } });

      // 模拟点击失败
      fakeBrowser.evaluate.onThirdCall().resolves({
        data: { value: { ok: false, error: '切换组织机构按钮未找到' } },
      });

      try {
        await openSwitchOrgDialog();
        expect.fail('应该抛出错误');
      } catch (e: any) {
        expect(e.message).to.include('切换组织机构按钮未找到');
      }
    });

    it('should throw error when dialog does not appear', async () => {
      // closeAllOrgDialogs 调用
      fakeBrowser.evaluate
        .onFirstCall()
        .resolves({ data: { value: { closed: false } } });
      fakeBrowser.evaluate
        .onSecondCall()
        .resolves({ data: { value: { closed: 0 } } });

      // 模拟点击成功
      fakeBrowser.evaluate
        .onThirdCall()
        .resolves({ data: { value: { ok: true } } });

      // 模拟对话框未弹出
      fakeBrowser.evaluate.onCall(3).resolves({
        data: { value: { ok: false, error: '切换组织机构对话框未弹出' } },
      });

      try {
        await openSwitchOrgDialog();
        expect.fail('应该抛出错误');
      } catch (e: any) {
        expect(e.message).to.include('切换组织机构对话框未弹出');
      }
    });
  });

  describe('closeSwitchOrgDialog()', () => {
    it('should close dialog with cancel action', async () => {
      fakeBrowser.evaluate.resolves({
        data: { value: { ok: true, closed: true, clicked: '取消' } },
      });

      const result = await closeSwitchOrgDialog('cancel');
      expect(result).to.be.true;
    });

    it('should close dialog with confirm action', async () => {
      fakeBrowser.evaluate.resolves({
        data: { value: { ok: true, closed: true, clicked: '确定' } },
      });

      const result = await closeSwitchOrgDialog('confirm');
      expect(result).to.be.true;
    });

    it('should return true when dialog already closed', async () => {
      fakeBrowser.evaluate.resolves({
        data: { value: { ok: true, closed: true, reason: '对话框已关闭' } },
      });

      const result = await closeSwitchOrgDialog('cancel');
      expect(result).to.be.true;
    });

    it('should fallback to remove when close button not found', async () => {
      fakeBrowser.evaluate.resolves({
        data: { value: { ok: true, closed: true, method: 'remove' } },
      });

      const result = await closeSwitchOrgDialog('cancel');
      expect(result).to.be.true;
    });
  });

  describe('getCurrentOrganization()', () => {
    it('should return organization from page header if available', async () => {
      fakeBrowser.evaluate.resolves({
        data: {
          value: {
            found: true,
            source: 'header',
            organization: '某建筑公司总部',
          },
        },
      });

      const result = await getCurrentOrganization();
      expect(result.organization).to.equal('某建筑公司总部');
      expect(result.fromDialog).to.be.undefined;
    });

    it('should open dialog and return organization when header not found', async () => {
      // 需要6次 evaluate：header检查 + closeAllOrgDialogs(2次) + openDialog点击 + readDialog + closeDialog
      fakeBrowser.evaluate
        .onCall(0)
        .resolves({ data: { value: { found: false } } })
        .onCall(1)
        .resolves({ data: { value: { closed: false } } })
        .onCall(2)
        .resolves({ data: { value: { closed: 0 } } })
        .onCall(3)
        .resolves({ data: { value: { ok: true } } })
        .onCall(4)
        .resolves({
          data: {
            value: {
              ok: true,
              title: '切换组织机构',
              fields: {
                组织机构: {
                  id: 'DataSetFieldComboBox1-input',
                  value: '某建筑公司山东分公司',
                },
              },
            },
          },
        })
        .onCall(5)
        .resolves({
          data: { value: { ok: true, closed: true } },
        });

      const result = await getCurrentOrganization();
      expect(result.organization).to.equal('某建筑公司山东分公司');
      expect(result.fromDialog).to.be.true;
    });

    it('should throw error when cannot get organization info', async () => {
      // 需要5次 evaluate：header检查 + closeAllOrgDialogs(2次) + openDialog点击 + readDialog
      fakeBrowser.evaluate
        .onCall(0)
        .resolves({ data: { value: { found: false } } })
        .onCall(1)
        .resolves({ data: { value: { closed: false } } })
        .onCall(2)
        .resolves({ data: { value: { closed: 0 } } })
        .onCall(3)
        .resolves({ data: { value: { ok: true } } })
        .onCall(4)
        .resolves({
          data: { value: { ok: false, error: '切换组织机构对话框未弹出' } },
        });

      try {
        await getCurrentOrganization();
        expect.fail('应该抛出错误');
      } catch (e: any) {
        expect(e.message).to.include('无法获取当前组织机构信息');
      }
    });
  });

  describe('switchOrganization()', () => {
    it('should query current org info in query mode', async () => {
      // 需要5次 evaluate：closeAllOrgDialogs(2次) + openDialog点击 + readDialog + closeDialog
      fakeBrowser.evaluate
        .onCall(0)
        .resolves({ data: { value: { closed: false } } })
        .onCall(1)
        .resolves({ data: { value: { closed: 0 } } })
        .onCall(2)
        .resolves({ data: { value: { ok: true } } })
        .onCall(3)
        .resolves({
          data: {
            value: {
              ok: true,
              title: '切换组织机构',
              fields: {
                组织机构: {
                  id: 'DataSetFieldComboBox1-input',
                  value: '旧公司',
                },
                项目名称: {
                  id: 'DataSetFieldComboBox3-input',
                  value: '旧项目',
                },
                部门名称: {
                  id: 'DataSetFieldComboBox2-input',
                  value: '旧部门',
                },
              },
            },
          },
        })
        .onCall(4)
        .resolves({
          data: { value: { ok: true, closed: true } },
        });

      const result = await switchOrganization({
        organization: '新公司',
        project: '新项目',
        department: '新部门',
      });

      expect(result.success).to.be.true;
      expect(result.mode).to.equal('query');
      expect(result.current.organization).to.equal('旧公司');
      expect(result.current.project).to.equal('旧项目');
      expect(result.current.department).to.equal('旧部门');
      // 新结构：缓存相关信息
      expect(result.cache).to.be.an('object');
      expect(result.cache.isNewRecord).to.be.a('boolean');
      expect(result.cache.totalRecords).to.be.a('number');
      expect(result.cache.uniqueOrganizations).to.be.an('array');
    });

    it('should query from cache only when fromCache is true', async () => {
      const result = await switchOrganization({
        organization: '测试',
        fromCache: true,
      });

      expect(result.success).to.be.true;
      expect(result.mode).to.equal('cache_query');
      expect(result.matches).to.be.an('array');
      expect(result.matchCount).to.be.a('number');
    });

    it('should throw error when dialog fails to open', async () => {
      // closeAllOrgDialogs(2次) + openDialog点击失败
      fakeBrowser.evaluate
        .onCall(0)
        .resolves({ data: { value: { closed: false } } })
        .onCall(1)
        .resolves({ data: { value: { closed: 0 } } })
        .onCall(2)
        .resolves({ data: { value: { ok: false, error: '按钮未找到' } } });

      try {
        await switchOrganization({ organization: '新公司' });
        expect.fail('应该抛出错误');
      } catch (e: any) {
        expect(e.message).to.include('按钮未找到');
      }
    });
  });
});
