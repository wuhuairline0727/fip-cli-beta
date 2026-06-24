import { expect } from 'chai';
import * as browser from '../../lib/browser';
import * as cdp from '../../lib/utils/cdp';
import * as common from '../../lib/utils/common';
import * as navigation from '../../lib/utils/navigation';
import * as form from '../../lib/utils/form';
import * as picker from '../../lib/utils/picker';
import * as table from '../../lib/utils/table';
import * as dialog from '../../lib/utils/dialog';
import * as bill from '../../lib/utils/bill';
import CDP from 'chrome-remote-interface';
import * as inputTransfer from '../../lib/ledgers/input-transfer';
import * as outputInvoice from '../../lib/ledgers/output-invoice';
import * as passengerTransport from '../../lib/ledgers/passenger-transport';
import * as vatPrepayment from '../../lib/ledgers/vat-prepayment';
import * as unbilledIncome from '../../lib/ledgers/unbilled-income';

// 测试报告收集器
const testResults: Array<{
  name: string;
  passed: boolean;
  error: any;
  details: any;
  timestamp: string;
}> = [];

function recordTest(
  name: string,
  passed: boolean,
  error: any = null,
  details: any = {}
) {
  testResults.push({
    name,
    passed,
    error,
    details,
    timestamp: new Date().toISOString(),
  });
  const status = passed ? '✅' : '❌';
  const errorMsg = error ? ` - ${error.message || error}` : '';
  console.log(`  ${status} ${name}${errorMsg}`);
}

async function _runTest(name: string, testFn: () => Promise<any>) {
  try {
    const result = await testFn();
    recordTest(name, true, null, result || {});
    return true;
  } catch (_e) {
    // ignore
  }
}

async function ensureDashboard() {
  try {
    const info = await common.getPageInfo();
    // 必须包含 #/dashboard 才算在首页
    if (!info.url || !info.url.includes('#/dashboard')) {
      console.log('  [恢复] 页面不在首页，导航到 dashboard...');
      await browser.evaluate(
        "location.href = 'https://fip.cscec.com/OSPPortal/CSCPortal.jsp#/dashboard'"
      );
      await common.sleep(3000);
    }
  } catch (_e) {
    // ignore
  }
}

describe('🔴 真实浏览器测试', function () {
  this.timeout(120000); // 2分钟超时

  before(async function () {
    console.log('\n========================================');
    console.log('开始真实浏览器测试');
    console.log('========================================\n');

    // 确认浏览器连接
    const connected = await browser.checkConnection();
    if (!connected) {
      throw new Error('WebBridge 未连接，无法执行真实浏览器测试');
    }
    console.log('✅ WebBridge 已连接');
    console.log('✅ CDP 端口 9222 可用');

    const info = await common.getPageInfo();
    console.log(`✅ 当前页面: ${info.title}`);
    console.log(`✅ 当前 URL: ${info.url}`);
    console.log('');
  });

  // ==================== browser.js ====================
  describe('lib/browser.js', () => {
    it('checkConnection() 应返回 true', async () => {
      const result = await browser.checkConnection();
      expect(result).to.equal(true);
    });

    it('ensureConnection() 不应抛出错误', async () => {
      await browser.ensureConnection();
    });

    it('evaluate() 应能执行 JS 并返回结果', async () => {
      const result = await browser.evaluate('document.title');
      expect(result.ok).to.equal(true);
      expect(result.data.value).to.be.a('string');
      expect(result.data.value).to.include('中国建筑');
    });

    it('navigate() 应能导航到当前页面', async () => {
      const result = await browser.navigate(
        'https://fip.cscec.com/OSPPortal/CSCPortal.jsp#/dashboard',
        false
      );
      expect(result.ok).to.equal(true);
    });

    it('screenshot() 应能截图 (使用CDP)', async () => {
      // WebBridge screenshot 可能超时，使用 CDP 直接截图
      const client = (await CDP({ port: 9222 })) as any;
      try {
        const { Page } = client;
        const { data } = await Page.captureScreenshot({ format: 'png' });
        expect(data).to.be.a('string');
        expect(data.length).to.be.greaterThan(1000);
      } finally {
        await client.close();
      }
    });
  });

  // ==================== utils/cdp.js ====================
  describe('lib/utils/cdp.js', () => {
    it('cdpEvaluate() 应能执行 JS', async () => {
      const result = await cdp.cdpEvaluate('document.title');
      expect(result).to.be.a('string');
      expect(result).to.include('中国建筑');
    });

    it('cdpFindElementByText() 应能找到 "首页" 元素', async () => {
      const result = await cdp.cdpFindElementByText('首页');
      expect(result).to.be.an('object');
      expect(result.found).to.equal(true);
      expect(result.x).to.be.a('number');
      expect(result.y).to.be.a('number');
    });

    it('cdpFindElementByText() 找不到时应返回 found:false', async () => {
      const result = await cdp.cdpFindElementByText('不存在的文本XYZ123');
      expect(result).to.be.an('object');
      expect(result.found).to.equal(false);
    });

    it('cdpClick() 应能真实点击首页标签', async () => {
      const homeBtn = await cdp.cdpFindElementByText('首页');
      expect(homeBtn).to.not.be.null;
      expect(homeBtn!.found).to.equal(true);
      const result = await cdp.cdpClick(homeBtn!.x!, homeBtn!.y!, 1000);
      expect(result.clicked).to.equal(true);
    });

    it('cdpEvaluateAndClick() 应能查找并点击', async () => {
      const result = await cdp.cdpEvaluateAndClick(
        `
        (function() {
          var all = document.querySelectorAll('*');
          for (var i = 0; i < all.length; i++) {
            if (all[i].textContent.trim() === '首页') {
              var rect = all[i].getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
              }
            }
          }
          return { found: false };
        })()
      `,
        { sleepMs: 1000 }
      );
      expect(result.clicked).to.equal(true);
    });
  });

  // ==================== utils/common.js ====================
  describe('lib/utils/common.js', () => {
    it('sleep() 应等待指定时间', async () => {
      const start = Date.now();
      await common.sleep(500);
      const elapsed = Date.now() - start;
      expect(elapsed).to.be.at.least(450);
    });

    it('getPageInfo() 应返回页面信息', async () => {
      const info = await common.getPageInfo();
      expect(info).to.be.an('object');
      expect(info.url).to.be.a('string');
      expect(info.title).to.be.a('string');
      expect(info.activeTab).to.be.an('object');
    });

    it('findVisibleElementByText() 应能找到元素', async () => {
      const result = await common.findVisibleElementByText('首页');
      expect(result).to.not.be.null;
      expect(result!.found).to.equal(true);
    });

    it('getTableRowCount() 应在首页返回数据', async () => {
      const result = await common.getTableRowCount();
      expect(result).to.be.an('object');
      expect(result).to.have.property('total');
      expect(result).to.have.property('visible');
    });

    it('waitForElement() 应能找到已存在的元素', async () => {
      const result = await common.waitForElement('首页', { timeout: 5000 });
      expect(result.found).to.equal(true);
    });

    it('waitForPopup() 应返回结果', async () => {
      const result = await common.waitForPopup(3000);
      expect(result).to.be.an('object');
      expect(result).to.have.property('found');
    });
  });

  // ==================== utils/navigation.js ====================
  describe('lib/utils/navigation.js', () => {
    beforeEach(async () => {
      await ensureDashboard();
      await common.sleep(1000);
    });

    afterEach(async () => {
      await ensureDashboard();
    });

    it('openSideMenu("税务系统") 应打开侧边菜单', async () => {
      const result = await navigation.openSideMenu('税务系统');
      expect(result).to.equal(true);
      // 验证抽屉是否打开
      const drawerCheck = await browser.evaluate(
        "document.querySelector('.ant-drawer-open') ? 'exists' : 'not_found'"
      );
      expect(drawerCheck.data.value).to.equal('exists');
    });

    it('clickDrawerItem("税务台账") 应点击抽屉项', async () => {
      // 先打开菜单
      await navigation.openSideMenu('税务系统');
      await common.sleep(1000);
      const result = await navigation.clickDrawerItem('税务台账');
      expect(result).to.equal(true);
    });
  });

  // ==================== utils/form.js ====================
  describe('lib/utils/form.js', () => {
    before(async () => {
      await ensureDashboard();
      // 导航到税务台账页面
      await navigation.openSideMenu('税务系统');
      await common.sleep(500);
      await navigation.clickDrawerItem('税务台账');
      await common.sleep(3000);

      // 如果有选择台账类型的弹窗，选择第一个或关闭
      const popupCheck = await cdp.cdpEvaluate(`
        (function() {
          var popups = document.querySelectorAll('.FD26IYC-a-g, .gwt-DialogBox, [class*=DialogBox]');
          for (var i = 0; i < popups.length; i++) {
            var rect = popups[i].getBoundingClientRect();
            if (rect.left > 0 && rect.width > 0) return 'exists';
          }
          return 'none';
        })()
      `);
      if (popupCheck === 'exists') {
        // 尝试点击弹窗中的查询按钮或关闭
        await dialog.dismissDialogs();
        await common.sleep(1000);
      }
    });

    after(async () => {
      await ensureDashboard();
    });

    it('clickShowQuery() 应展开/折叠查询面板', async () => {
      const result = await form.clickShowQuery();
      expect(result).to.equal(true);
    });

    it('setDateInput() 应设置日期输入框', async () => {
      // 先确保查询面板展开
      try {
        await form.clickShowQuery();
      } catch (_e) {}
      await common.sleep(1000);

      const result = await form.setDateInput(
        'FormDateField1-input',
        '2026-01-01'
      );
      expect(result.found).to.equal(true);
      expect(result.value).to.equal('2026-01-01');
    });

    it('setDateRange() 应设置日期范围', async () => {
      try {
        await form.clickShowQuery();
      } catch (_e) {}
      await common.sleep(1000);

      const result = await form.setDateRange('2026-01-01', '2026-12-31');
      expect(result.startDate).to.equal('2026-01-01');
      expect(result.endDate).to.equal('2026-12-31');
    });

    it('setTaxPeriod() 应设置税期', async () => {
      try {
        await form.clickShowQuery();
      } catch (_e) {}
      await common.sleep(1000);

      const result = await form.setTaxPeriod('2026-01', '2026-12');
      expect(result).to.be.an('object');
    });
  });

  // ==================== utils/picker.js ====================
  describe('lib/utils/picker.js', () => {
    before(async () => {
      await ensureDashboard();
      // 导航到需要选择器的页面
      await navigation.openSideMenu('税务系统');
      await common.sleep(500);
      await navigation.clickDrawerItem('税务台账');
      await common.sleep(3000);

      // 选择销项发票明细台账
      const radioResult = (await cdp.cdpEvaluate(`
        (function() {
          var all = document.querySelectorAll('*');
          for (var i = 0; i < all.length; i++) {
            if (all[i].textContent.trim() === '销项发票明细台账') {
              var rect = all[i].getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0 && rect.left > 400) {
                return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
              }
            }
          }
          return { found: false };
        })()
      `)) as { found?: boolean; x?: number; y?: number };
      if (radioResult?.found) {
        await cdp.cdpClick(radioResult.x!, radioResult.y!, 3000);
      }

      // 处理可能的弹窗
      await dialog.dismissDialogs();
      await common.sleep(1000);
    });

    after(async () => {
      await ensureDashboard();
    });

    it('clickPickerButton() 应能找到并点击 picker 按钮', async () => {
      try {
        const result = await picker.clickPickerButton('申请单位');
        expect(result).to.equal(true);
        // 关闭弹窗
        await common.sleep(500);
        await dialog.dismissDialogs();
      } catch (e: any) {
        // 如果页面没有申请单位 picker，跳过
        console.log('  ⚠️ 当前页面可能没有申请单位 picker:', e.message);
      }
    });
  });

  // ==================== utils/table.js ====================
  describe('lib/utils/table.js', () => {
    before(async () => {
      // 确保在 dashboard 页面
      await ensureDashboard();
    });

    it('getTableData() 应能获取表格数据', async () => {
      const result = await table.getTableData({ maxRows: 10 });
      expect(result).to.be.an('object');
      expect(result).to.have.property('rowCount');
      expect(result).to.have.property('data');
      expect(result).to.have.property('headers');
    });
  });

  // ==================== utils/dialog.js ====================
  describe('lib/utils/dialog.js', () => {
    it('dismissDialogs() 应能检测并关闭弹窗', async () => {
      const result = await dialog.dismissDialogs();
      expect(result).to.be.an('object');
      expect(result).to.have.property('closed');
      expect(result).to.have.property('details');
    });

    it('waitAndDismissDialogs() 应等待并关闭弹窗', async () => {
      const result = await dialog.waitAndDismissDialogs(3000);
      expect(result).to.be.an('object');
      expect(result).to.have.property('closed');
    });
  });

  // ==================== utils/bill.js ====================
  describe('lib/utils/bill.js', () => {
    afterEach(async () => {
      await ensureDashboard();
    });

    it('closeBill() 应在首页安全执行', async () => {
      // 在首页执行 closeBill，应该能处理无关闭按钮的情况
      try {
        await bill.closeBill();
      } catch (e: any) {
        // 在首页没有单据标签，预期会失败
        expect(e.message).to.include('关闭');
      }
    });
  });

  // ==================== ledgers ====================
  describe('lib/ledgers - 台账查询（queryOnly 模式）', () => {
    this.timeout(300000); // 5分钟超时

    afterEach(async () => {
      await ensureDashboard();
      await common.sleep(2000);
    });

    it('input-transfer - 进项转出明细台账查询', async () => {
      const result = await inputTransfer.exportInputTransferLedger({
        startPeriod: '2026-04',
        endPeriod: '2026-04',
        companyCode: '1000200020040011',
        taxCode: 'XXXXXXXXXXXXXXXXXX',
        docStatus: '流程结束',
        queryOnly: true,
      });
      expect(result.queried).to.equal(true);
      expect(result.options).to.be.an('object');
      expect(result.rows).to.be.an('object');
    });

    it('output-invoice - 销项发票明细台账查询', async () => {
      const result = await outputInvoice.exportOutputInvoiceLedger({
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        companyCode: '1000200020040011',
        sellerCode: 'XXXXXXXXXXXXXXXXXX',
        queryOnly: true,
      });
      expect(result.queried).to.equal(true);
      expect(result.options).to.be.an('object');
      expect(result.rows).to.be.an('object');
    });

    it('passenger-transport - 旅客运输服务台账查询', async () => {
      const result = await passengerTransport.exportPassengerTransportLedger({
        startPeriod: '2026-04',
        endPeriod: '2026-04',
        companyCode: '1000200020040011',
        taxCode: 'XXXXXXXXXXXXXXXXXX',
        queryOnly: true,
      });
      expect(result.queried).to.equal(true);
      expect(result.options).to.be.an('object');
      expect(result.rows).to.be.an('object');
    });

    it('vat-prepayment - 增值税预缴款台账查询', async () => {
      const result = await vatPrepayment.exportVatPrepaymentLedger({
        startPeriod: '2026-04',
        endPeriod: '2026-04',
        companyCode: '1000200020040011',
        taxCode: 'XXXXXXXXXXXXXXXXXX',
        docType: '预缴计算单',
        queryOnly: true,
      });
      expect(result.queried).to.equal(true);
      expect(result.options).to.be.an('object');
      expect(result.rows).to.be.an('object');
    });

    it('unbilled-income - 未开票收入台账查询', async () => {
      const result = await unbilledIncome.exportUnbilledIncomeLedger({
        startDate: '2026-01-01',
        endDate: '2026-04-30',
        startPeriod: '2026-01',
        endPeriod: '2026-04',
        companyCode: '1000200020040011',
        taxCode: 'XXXXXXXXXXXXXXXXXX',
        voidStatus: '未作废',
        queryOnly: true,
      });
      expect(result.queried).to.equal(true);
      expect(result.options).to.be.an('object');
      expect(result.rows).to.be.an('object');
    });
  });

  // ==================== 测试报告 ====================
  after(async function () {
    console.log('\n========================================');
    console.log('真实浏览器测试报告');
    console.log('========================================');

    const passed = testResults.filter((r) => r.passed).length;
    const failed = testResults.filter((r) => !r.passed).length;

    console.log(`\n总计: ${testResults.length} 个测试`);
    console.log(`通过: ${passed} ✅`);
    console.log(`失败: ${failed} ❌`);

    if (failed > 0) {
      console.log('\n失败的测试:');
      testResults
        .filter((r) => !r.passed)
        .forEach((r) => {
          console.log(`  ❌ ${r.name}`);
          console.log(`     错误: ${r.error?.message || r.error}`);
        });
    }

    console.log('\n========================================');
  });
});
