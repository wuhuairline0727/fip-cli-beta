#!/usr/bin/env node

const { program } = require('commander');
const { navigate, evaluate } = require('../lib/browser');
const { success, error, setScreenshotOptions } = require('../lib/output');
const config = require('../lib/config');
const fip = require('../lib/fip');

program
  .name('fip-cli')
  .description('FIP 一体化平台自动化 CLI')
  .version('1.0.0')
  .option('--no-screenshot', '命令失败时不自动截图')
  .option('--screenshot-dir <path>', '错误截图保存目录', './screenshots');

program.on('option:no-screenshot', () => setScreenshotOptions({ screenshotOnError: false }));
program.on('option:screenshot-dir', (dir) => setScreenshotOptions({ screenshotDir: dir }));

program
  .command('config [key] [value]')
  .description('查看或设置配置（key: companyCode, taxCode, startDate, endDate 等）')
  .action((key, value) => {
    try {
      if (!key) {
        success(config.get());
      } else if (value !== undefined) {
        config.set(key, value);
        success({ key, value, saved: true, config_file: config.CONFIG_FILE });
      } else {
        success({ key, value: config.get(key) });
      }
    } catch (e) {
      error('config_error', e.message);
    }
  });

program
  .command('login-status')
  .description('检查登录状态')
  .action(async () => {
    try {
      const info = await fip.getPageInfo();
      const isLoggedIn = info.url && info.url.includes('fip.cscec.com');
      success({ logged_in: isLoggedIn, url: info.url, title: info.title });
    } catch (e) {
      error('login_status_error', e.message);
    }
  });

program
  .command('navigate <url>')
  .description('导航到指定页面')
  .action(async (url) => {
    try {
      const result = await navigate(url, false);
      success({ navigated: true, url });
    } catch (e) {
      error('navigate_error', e.message);
    }
  });

program
  .command('tab <name>')
  .description('切换 Dashboard 子页签 (我的单据/待办/已办/已办结)')
  .action(async (name) => {
    try {
      await fip.clickDashboardTab(name);
      success({ tab: name, switched: true });
    } catch (e) {
      error('tab_switch_error', e.message);
    }
  });

program
  .command('query')
  .description('点击查询按钮')
  .action(async () => {
    try {
      await fip.clickQueryButton();
      const rows = await fip.getTableRowCount();
      success({ queried: true, rows });
    } catch (e) {
      error('query_error', e.message);
    }
  });

program
  .command('menu <name>')
  .description('打开侧边菜单 (如: 税务系统)')
  .action(async (name) => {
    try {
      await fip.openSideMenu(name);
      success({ menu: name, opened: true });
    } catch (e) {
      error('menu_error', e.message);
    }
  });

program
  .command('drawer <name>')
  .description('点击 Drawer 子菜单项 (如: 税务台账/未开票收入台账)')
  .action(async (name) => {
    try {
      await fip.clickDrawerItem(name);
      success({ item: name, clicked: true });
    } catch (e) {
      error('drawer_error', e.message);
    }
  });

program
  .command('show-query')
  .description('展开查询表单')
  .action(async () => {
    try {
      await fip.clickShowQuery();
      success({ show_query: true });
    } catch (e) {
      error('show_query_error', e.message);
    }
  });

program
  .command('set-date <start> <end>')
  .description('设置日期范围 (格式: YYYY-MM-DD)')
  .action(async (start, end) => {
    try {
      await fip.setDateRange(start, end);
      success({ start_date: start, end_date: end, set: true });
    } catch (e) {
      error('set_date_error', e.message);
    }
  });

program
  .command('set-tax-period <start> <end>')
  .description('设置税期 (格式: YYYY-MM)')
  .action(async (start, end) => {
    try {
      await fip.setTaxPeriod(start, end);
      success({ start_period: start, end_period: end, set: true });
    } catch (e) {
      error('set_tax_period_error', e.message);
    }
  });

program
  .command('rows')
  .description('获取表格行数')
  .action(async () => {
    try {
      const rows = await fip.getTableRowCount();
      success(rows);
    } catch (e) {
      error('rows_error', e.message);
    }
  });

program
  .command('table-data')
  .description('读取当前页面表格数据')
  .option('--max-rows <n>', '最大行数', '1000')
  .option('--no-headers', '不包含表头')
  .action(async (options) => {
    try {
      const result = await fip.getTableData({
        maxRows: parseInt(options.maxRows),
        includeHeaders: options.headers !== false
      });
      success(result);
    } catch (e) {
      error('table_data_error', e.message);
    }
  });

program
  .command('pick-company <code>')
  .description('选择申请单位 (如: 1000200020040011)')
  .action(async (code) => {
    try {
      await fip.clickPickerButton('申请单位');
      await fip.pickFromDict(code);
      success({ company_code: code, selected: true });
    } catch (e) {
      error('pick_company_error', e.message);
    }
  });

program
  .command('pick-tax-subject <code>')
  .description('选择纳税主体 (如: 91110000101638302P 或 91110000101107173B)')
  .action(async (code) => {
    try {
      await fip.pickTaxSubject(code);
      success({ tax_code: code, selected: true });
    } catch (e) {
      error('pick_tax_subject_error', e.message);
    }
  });

program
  .command('page-info')
  .description('获取当前页面信息（URL、标题）')
  .action(async () => {
    try {
      const info = await fip.getPageInfo();
      success(info);
    } catch (e) {
      error('page_info_error', e.message);
    }
  });

program
  .command('find-element <text>')
  .description('查找页面上指定文本的可见元素坐标（调试用）')
  .option('--left-min <n>', '最小 left 坐标', '0')
  .option('--left-max <n>', '最大 left 坐标', '9999')
  .option('--top-min <n>', '最小 top 坐标', '0')
  .option('--top-max <n>', '最大 top 坐标', '9999')
  .action(async (text, options) => {
    try {
      const result = await fip.findVisibleElementByText(text, {
        leftMin: parseInt(options.leftMin),
        leftMax: parseInt(options.leftMax),
        topMin: parseInt(options.topMin),
        topMax: parseInt(options.topMax)
      });
      success({ text, found: !!result, coordinates: result });
    } catch (e) {
      error('find_element_error', e.message);
    }
  });

program
  .command('wait <ms>')
  .description('等待指定毫秒数')
  .action(async (ms) => {
    try {
      await fip.sleep(parseInt(ms));
      success({ waited: parseInt(ms) });
    } catch (e) {
      error('wait_error', e.message);
    }
  });

program
  .command('picker-button <label>')
  .description('点击指定标签旁的 Picker 按钮（如：申请单位、纳税主体）')
  .action(async (label) => {
    try {
      await fip.clickPickerButton(label);
      success({ label, clicked: true });
    } catch (e) {
      error('picker_button_error', e.message);
    }
  });

program
  .command('pick-dict <code>')
  .description('在已打开的 Picker 弹窗中查询并选择编码')
  .action(async (code) => {
    try {
      await fip.pickFromDict(code);
      success({ code, selected: true });
    } catch (e) {
      error('pick_dict_error', e.message);
    }
  });

program
  .command('open-bill <billId>')
  .description('打开指定单据编号（自动搜索各标签页）')
  .option('--tab <name>', '指定标签页（我的单据/待办/已办/已办结）')
  .action(async (billId, options) => {
    try {
      const result = await fip.openBill(billId, options.tab || null);
      success(result);
    } catch (e) {
      error('open_bill_error', e.message);
    }
  });

program
  .command('close-bill')
  .description('关闭当前单据详情页，返回 Dashboard')
  .action(async () => {
    try {
      const result = await fip.closeBill();
      success(result);
    } catch (e) {
      error('close_bill_error', e.message);
    }
  });

program
  .command('list-attachments')
  .description('列出当前单据的所有附件')
  .option('--dir <path>', '下载目录', './downloads')
  .action(async (options) => {
    try {
      const result = await fip.listAttachments({ downloadDir: options.dir });
      success(result);
    } catch (e) {
      error('list_attachments_error', e.message);
    }
  });

program
  .command('download-attachments')
  .description('下载当前单据的所有附件')
  .option('--dir <path>', '保存目录', './downloads')
  .option('--chrome-dir <path>', 'Chrome下载目录（默认自动检测）')
  .action(async (options) => {
    try {
      const result = await fip.downloadAttachments({
        downloadDir: options.dir,
        chromeDownloadDir: options.chromeDir
      });
      success(result);
    } catch (e) {
      error('download_attachments_error', e.message);
    }
  });

program
  .command('wait-for-element <text>')
  .description('轮询等待指定文本元素出现（默认超时10秒）')
  .option('--timeout <ms>', '超时毫秒数', '10000')
  .option('--interval <ms>', '轮询间隔毫秒数', '500')
  .action(async (text, options) => {
    try {
      const result = await fip.waitForElement(text, {
        timeout: parseInt(options.timeout),
        interval: parseInt(options.interval)
      });
      success(result);
    } catch (e) {
      error('wait_for_element_error', e.message);
    }
  });

program
  .command('wait-for-popup')
  .description('轮询等待弹窗出现（默认超时10秒）')
  .option('--timeout <ms>', '超时毫秒数', '10000')
  .action(async (options) => {
    try {
      const result = await fip.waitForPopup(parseInt(options.timeout));
      success(result);
    } catch (e) {
      error('wait_for_popup_error', e.message);
    }
  });

program
  .command('wait-for-url <pattern>')
  .description('轮询等待 URL 匹配指定正则（如 "FLOW_"）')
  .option('--timeout <ms>', '超时毫秒数', '10000')
  .action(async (pattern, options) => {
    try {
      const result = await fip.waitForUrl(pattern, parseInt(options.timeout));
      success(result);
    } catch (e) {
      error('wait_for_url_error', e.message);
    }
  });

program
  .command('screenshot')
  .description('截图并保存')
  .option('-o, --output <path>', '输出路径')
  .action(async (options) => {
    try {
      const { screenshot } = require('../lib/browser');
      const fs = require('fs');
      const result = await screenshot('png');
      if (!result.ok || !result.data) {
        error('screenshot_error', result.error?.message || 'Screenshot failed');
        return;
      }

      const outputPath = options.output || `D:/claude/fip-cli/screenshot_${Date.now()}.png`;

      // WebBridge 返回文件路径
      if (result.data.path && fs.existsSync(result.data.path)) {
        fs.copyFileSync(result.data.path, outputPath);
        success({ saved: true, path: outputPath, size: result.data.sizeBytes });
        return;
      }

      // 兼容旧版 base64 返回格式
      if (result.data.data) {
        fs.writeFileSync(outputPath, Buffer.from(result.data.data, 'base64'));
        success({ saved: true, path: outputPath, size: result.data.data.length });
        return;
      }

      error('screenshot_error', 'Screenshot returned empty data');
    } catch (e) {
      error('screenshot_error', e.message);
    }
  });

const cfg = config.get();

program
  .command('export-unbilled')
  .description('未开票收入台账查询导出（完整流程）')
  .option('--start-date <date>', '起始日期 (YYYY-MM-DD)')
  .option('--end-date <date>', '截止日期 (YYYY-MM-DD)')
  .option('--start-period <period>', '起始税期 (YYYY-MM)')
  .option('--end-period <period>', '截止税期 (YYYY-MM)')
  .option('--company-code <code>', '申请单位编码')
  .option('--tax-code <code>', '纳税主体税号')
  .option('--void-status <status>', '作废状态 (全部/未作废/已作废)')
  .option('--query-only', '仅查询不导出', false)
  .action(async (options) => {
    try {
      await fip.ensureConnection();
      const args = Object.fromEntries(
        Object.entries({
          startDate: options.startDate,
          endDate: options.endDate,
          startPeriod: options.startPeriod,
          endPeriod: options.endPeriod,
          companyCode: options.companyCode,
          taxCode: options.taxCode,
          voidStatus: options.voidStatus,
          queryOnly: options.queryOnly
        }).filter(([_, v]) => v !== undefined)
      );
      const result = await fip.exportUnbilledIncomeLedger(args);
      success(result);
    } catch (e) {
      error('export_unbilled_error', e.message);
    }
  });

program
  .command('export-input-transfer')
  .description('进项转出明细台账查询导出（完整流程）')
  .option('--start-period <period>', '起始税期 (YYYY-MM)', cfg.startPeriod)
  .option('--end-period <period>', '截止税期 (YYYY-MM)', cfg.endPeriod)
  .option('--company-code <code>', '转出单位编码', cfg.companyCode)
  .option('--tax-code <code>', '纳税主体税号', cfg.taxCode)
  .option('--doc-status <status>', '单据状态 (全部/制单中/审批中/流程结束/已作废)', cfg.docStatus)
  .option('--query-only', '仅查询不导出', false)
  .action(async (options) => {
    try {
      const result = await fip.exportInputTransferLedger({
        startPeriod: options.startPeriod,
        endPeriod: options.endPeriod,
        companyCode: options.companyCode,
        taxCode: options.taxCode,
        docStatus: options.docStatus,
        queryOnly: options.queryOnly
      });
      success(result);
    } catch (e) {
      error('export_input_transfer_error', e.message);
    }
  });

program
  .command('export-output-invoice')
  .description('销项发票明细台账查询导出（完整流程）')
  .option('--start-date <date>', '起始日期 (YYYY-MM-DD)', cfg.startDate)
  .option('--end-date <date>', '截止日期 (YYYY-MM-DD)', cfg.endDate)
  .option('--company-code <code>', '申请单位编码', cfg.companyCode)
  .option('--seller-code <code>', '销方税号', cfg.sellerCode)
  .option('--query-only', '仅查询不导出', false)
  .action(async (options) => {
    try {
      const result = await fip.exportOutputInvoiceLedger({
        startDate: options.startDate,
        endDate: options.endDate,
        companyCode: options.companyCode,
        sellerCode: options.sellerCode,
        queryOnly: options.queryOnly
      });
      success(result);
    } catch (e) {
      error('export_output_invoice_error', e.message);
    }
  });

program
  .command('export-vat-prepayment')
  .description('增值税预缴款台账查询导出（完整流程）')
  .option('--start-period <period>', '起始税期 (YYYY-MM)', cfg.startPeriod)
  .option('--end-period <period>', '截止税期 (YYYY-MM)', cfg.endPeriod)
  .option('--company-code <code>', '申请单位编码', cfg.companyCode)
  .option('--tax-code <code>', '纳税主体税号', cfg.taxCode)
  .option('--doc-type <type>', '单据类型 (完税预缴单/预缴计算单)', cfg.docType)
  .option('--query-only', '仅查询不导出', false)
  .action(async (options) => {
    try {
      const result = await fip.exportVatPrepaymentLedger({
        startPeriod: options.startPeriod,
        endPeriod: options.endPeriod,
        companyCode: options.companyCode,
        taxCode: options.taxCode,
        docType: options.docType,
        queryOnly: options.queryOnly
      });
      success(result);
    } catch (e) {
      error('export_vat_prepayment_error', e.message);
    }
  });

program
  .command('export-passenger-transport')
  .description('旅客运输服务台账查询导出（完整流程）')
  .option('--start-period <period>', '起始税期 (YYYY-MM)', cfg.startPeriod)
  .option('--end-period <period>', '截止税期 (YYYY-MM)', cfg.endPeriod)
  .option('--company-code <code>', '申请单位编码', cfg.companyCode)
  .option('--tax-code <code>', '纳税主体税号', cfg.taxCode)
  .option('--query-only', '仅查询不导出', false)
  .action(async (options) => {
    try {
      const result = await fip.exportPassengerTransportLedger({
        startPeriod: options.startPeriod,
        endPeriod: options.endPeriod,
        companyCode: options.companyCode,
        taxCode: options.taxCode,
        queryOnly: options.queryOnly
      });
      success(result);
    } catch (e) {
      error('export_passenger_transport_error', e.message);
    }
  });

program
  .command('export-all')
  .description('批量导出多个台账')
  .option('--start-period <period>', '起始税期 (YYYY-MM)', cfg.startPeriod)
  .option('--end-period <period>', '截止税期 (YYYY-MM)', cfg.endPeriod)
  .option('--start-date <date>', '起始日期 (YYYY-MM-DD)', cfg.startDate)
  .option('--end-date <date>', '截止日期 (YYYY-MM-DD)', cfg.endDate)
  .option('--company-code <code>', '申请单位编码', cfg.companyCode)
  .option('--tax-code <code>', '纳税主体税号', cfg.taxCode)
  .option('--seller-code <code>', '销方税号', cfg.sellerCode)
  .option('--void-status <status>', '作废状态', cfg.voidStatus)
  .option('--doc-status <status>', '单据状态', cfg.docStatus)
  .option('--doc-type <type>', '单据类型', cfg.docType)
  .option('--ledgers <list>', '指定台账（逗号分隔）', 'unbilled,input-transfer,output-invoice,vat-prepayment,passenger-transport')
  .option('--query-only', '仅查询不导出', false)
  .action(async (options) => {
    try {
      const ledgers = options.ledgers.split(',');
      const results = {};
      const ledgerMap = {
        'unbilled': 'exportUnbilledIncomeLedger',
        'input-transfer': 'exportInputTransferLedger',
        'output-invoice': 'exportOutputInvoiceLedger',
        'vat-prepayment': 'exportVatPrepaymentLedger',
        'passenger-transport': 'exportPassengerTransportLedger'
      };
      for (const name of ledgers) {
        const fnName = ledgerMap[name.trim()];
        if (!fnName || !fip[fnName]) {
          results[name] = { error: 'Unknown ledger' };
          continue;
        }
        let params = { queryOnly: options.queryOnly };
        if (name.trim() === 'output-invoice') {
          params = { ...params, startDate: options.startDate, endDate: options.endDate, companyCode: options.companyCode, sellerCode: options.sellerCode };
        } else {
          params = { ...params, startPeriod: options.startPeriod, endPeriod: options.endPeriod, companyCode: options.companyCode, taxCode: options.taxCode };
        }
        if (name.trim() === 'unbilled') params.voidStatus = options.voidStatus;
        if (name.trim() === 'input-transfer') params.docStatus = options.docStatus;
        if (name.trim() === 'vat-prepayment') params.docType = options.docType;
        try {
          const result = await fip[fnName](params);
          results[name] = { success: true, ...result };
        } catch (e) {
          results[name] = { success: false, error: e.message };
        }
        await fip.sleep(2000);
      }
      success({ executed: ledgers.length, results });
    } catch (e) {
      error('export_all_error', e.message);
    }
  });

program
  .command('examples')
  .description('显示使用示例')
  .action(() => {
    console.log(`
FIP CLI 使用示例
================

1. 检查登录状态
   fip-cli login-status

2. 导航到指定页面
   fip-cli navigate "https://fip.cscec.com/OSPPortal/CSCPortal.jsp#/gwt/00010004000400070001"

3. 查询未开票收入台账（仅查询）
   fip-cli export-unbilled --query-only

4. 导出未开票收入台账（默认参数）
   fip-cli export-unbilled

5. 导出进项转出明细台账（指定税期）
   fip-cli export-input-transfer --start-period 2026-04 --end-period 2026-04

6. 导出销项发票明细台账
   fip-cli export-output-invoice --start-date 2026-04-01 --end-date 2026-04-30

7. 导出增值税预缴款台账
   fip-cli export-vat-prepayment --start-period 2026-04 --end-period 2026-04

8. 导出旅客运输服务台账
   fip-cli export-passenger-transport --start-period 2026-04 --end-period 2026-04

9. 选择申请单位
   fip-cli pick-company 1000200020040011

10. 选择纳税主体
    fip-cli pick-tax-subject 91110000101107173B
`);
    process.exit(0);
  });

program
  .command('extract-invoice')
  .description('从当前开票单页面提取字段（调试用）')
  .action(async () => {
    try {
      const fields = await fip.extractInvoiceFields();
      success(fields);
    } catch (e) {
      error('extract_invoice_error', e.message);
    }
  });

program
  .command('audit-invoice [billId]')
  .description('智能审核开票单（自动提取字段+核对+生成报告）')
  .option('--confirmed-amount <amount>', '累计确权额（人工提供，如 50000000）')
  .option('--attachment-contract <amount>', '附件合同金额（用于核对）')
  .option('--format <type>', '报告格式 (text/json/md)', 'text')
  .option('--output <path>', '报告输出文件路径')
  .option('--keep-open', '审核后不关闭单据', false)
  .action(async (billId, options) => {
    try {
      await fip.ensureConnection();

      // 1. 如果提供了 billId，先打开单据
      if (billId) {
        console.log(`打开单据 ${billId}...`);
        await fip.openBill(billId);
        await fip.sleep(3000);
      }

      // 2. 提取字段
      console.log('提取单据字段...');
      const fields = await fip.extractInvoiceFields();

      if (!fields.invoice_no) {
        throw new Error('未能从页面提取到单据编号，请确认当前页面是开票单详情页');
      }

      console.log(`提取成功: 单据 ${fields.invoice_no}`);

      // 3. 合并人工输入的参数（转为数字）
      if (options.confirmedAmount) {
        fields.confirmed_amount = parseFloat(options.confirmedAmount);
      }
      if (options.attachmentContract) {
        fields.attachment_contract_amount = parseFloat(options.attachmentContract);
      }

      // 4. 执行审核
      console.log('执行自动核对...');
      const result = fip.auditInvoice(fields);

      // 5. 生成报告
      let report;
      if (options.format === 'json') {
        report = fip.generateAuditJsonReport(result);
      } else if (options.format === 'md') {
        report = fip.generateAuditMarkdownReport(result);
      } else {
        report = fip.generateAuditTextReport(result);
      }

      // 6. 输出到文件或控制台
      if (options.output) {
        const fs = require('fs');
        fs.writeFileSync(options.output, report, 'utf8');
        console.log(`报告已保存: ${options.output}`);
      }

      // 7. 关闭单据（除非 --keep-open）
      if (!options.keepOpen) {
        console.log('关闭单据...');
        await fip.closeBill();
      }

      // 8. 返回结果
      success({
        invoice_no: result.invoice_no,
        stats: result.stats,
        report: options.output ? null : report,
        output_file: options.output || null,
        format: options.format
      });
    } catch (e) {
      error('audit_invoice_error', e.message);
    }
  });

program
  .command('extract-bill [billId]')
  .description('提取单据字段并生成审核提示')
  .option('--type <type>', '手动指定单据类型 (SLBX/TBX/CFK/CBX)')
  .option('--output <path>', '输出到 JSON 文件')
  .option('--current-page', '仅提取当前页面，不导航', false)
  .action(async (billId, options) => {
    try {
      await fip.ensureConnection();

      if (!options.currentPage && billId) {
        console.log(`打开单据 ${billId}...`);
        await fip.openBill(billId);
        await fip.sleep(3000);
        // 打开单据后关闭可能出现的弹窗（如审批提醒）
        await fip.waitAndDismissDialogs(5000, { waitAfterClose: 1500 });
      }

      console.log('提取单据字段...');
      const data = await fip.extractBill(billId, options.type || null);

      console.log('生成审核提示...');
      const hints = fip.generateBillAuditHints(data, data._meta.bill_type);
      data.audit_hints = hints;

      if (options.output) {
        const fs = require('fs');
        fs.writeFileSync(options.output, JSON.stringify(data, null, 2), 'utf8');
        console.log(`结果已保存: ${options.output}`);
      }

      // 如果之前打开了单据，提取完成后关闭
      if (!options.currentPage && billId) {
        console.log('关闭单据...');
        try {
          await fip.closeBill();
        } catch (closeErr) {
          // 关闭失败不影响提取结果
          console.log(`关闭单据跳过: ${closeErr.message}`);
        }
      }

      success(data);
    } catch (e) {
      error('extract_bill_error', e.message);
    }
  });

program
  .command('doctor')
  .description('诊断环境状态：检查 Node.js、依赖、WebBridge、Chrome CDP、FIP 登录等')
  .option('--json', '输出 JSON 格式报告')
  .action(async (options) => {
    const doctor = require('../lib/doctor');
    try {
      const checks = await doctor.runDiagnostics();
      if (options.json) {
        console.log(JSON.stringify(doctor.generateJsonReport(checks), null, 2));
      } else {
        console.log(doctor.generateReport(checks));
      }
      // 如果有错误，退出码非零
      const hasError = checks.some(c => c.status === 'error');
      if (hasError) {
        process.exit(1);
      }
    } catch (e) {
      console.error('诊断执行失败:', e.message);
      process.exit(1);
    }
  });

program.parseAsync(process.argv).catch(async (err) => {
  // 未捕获的异常
  await error('uncaught_error', err.message);
  process.exit(1);
});
