#!/usr/bin/env node

// TypeScript 支持：tsx CJS 注册器，使 require() 能解析 .ts 文件
require('tsx/cjs');

import { program } from 'commander';
import type { FipAPI } from '../lib/types/fip';
import { navigate, screenshot } from '../lib/browser';
import { success, error, setScreenshotOptions } from '../lib/output';
import * as config from '../lib/config';
import fip from '../lib/fip';
const fipTyped = fip as FipAPI;
import * as fs from 'fs';
import { debug, verbose, setDebug, setVerbose } from '../lib/logger';
import * as organizationCache from '../lib/utils/organization-cache';
import * as doctor from '../lib/doctor';

program
  .name('fip-cli')
  .description('FIP 一体化平台自动化 CLI')
  .version('1.0.0')
  .option('--no-screenshot', '命令失败时不自动截图')
  .option('--screenshot-dir <path>', '错误截图保存目录', './screenshots')
  .option('--debug', '输出详细调试信息')
  .option('--verbose', '输出操作日志');

program.on('option:no-screenshot', () =>
  setScreenshotOptions({ screenshotOnError: false })
);
program.on('option:screenshot-dir', (dir: string) =>
  setScreenshotOptions({ screenshotDir: dir })
);
program.on('option:debug', () => setDebug(true));
program.on('option:verbose', () => setVerbose(true));

program
  .command('config [key] [value]')
  .description(
    '查看或设置配置（key: companyCode, taxCode, startDate, endDate 等）'
  )
  .action((key: string | undefined, value: string | undefined) => {
    try {
      if (!key) {
        success(config.get());
      } else if (value !== undefined) {
        config.set(key, value);
        success({
          key,
          value,
          saved: true,
          config_file: (config as Record<string, unknown>)
            .CONFIG_FILE as string,
        });
      } else {
        success({ key, value: config.get(key) });
      }
    } catch (e: any) {
      error('config_error', e.message);
    }
  });

program
  .command('login-status')
  .description('检查登录状态')
  .action(async () => {
    try {
      verbose('检查登录状态...');
      const info = await fipTyped.getPageInfo();
      const isLoggedIn = info.url && info.url.includes('fip.cscec.com');
      debug('login-status: url=', info.url, 'isLoggedIn=', isLoggedIn);
      success({ logged_in: isLoggedIn, url: info.url, title: info.title });
    } catch (e: any) {
      error('login_status_error', e.message);
    }
  });

program
  .command('navigate <url>')
  .description('导航到指定页面')
  .action(async (url: string) => {
    try {
      await navigate(url, false);
      success({ navigated: true, url });
    } catch (e: any) {
      error('navigate_error', e.message);
    }
  });

program
  .command('tab <name>')
  .description('切换 Dashboard 子页签 (我的单据/待办/已办/已办结)')
  .action(async (name: string) => {
    try {
      await fipTyped.clickDashboardTab(name);
      success({ tab: name, switched: true });
    } catch (e: any) {
      error('tab_switch_error', e.message);
    }
  });

program
  .command('query')
  .description('点击查询按钮')
  .action(async () => {
    try {
      await fipTyped.clickQueryButton();
      const rows = await fipTyped.getTableRowCount();
      success({ queried: true, rows });
    } catch (e: any) {
      error('query_error', e.message);
    }
  });

program
  .command('menu <name>')
  .description('打开侧边菜单 (如: 税务系统)')
  .action(async (name: string) => {
    try {
      await fipTyped.openSideMenu(name);
      success({ menu: name, opened: true });
    } catch (e: any) {
      error('menu_error', e.message);
    }
  });

program
  .command('drawer <name>')
  .description('点击 Drawer 子菜单项 (如: 税务台账/未开票收入台账)')
  .action(async (name: string) => {
    try {
      await fipTyped.clickDrawerItem(name);
      success({ item: name, clicked: true });
    } catch (e: any) {
      error('drawer_error', e.message);
    }
  });

program
  .command('show-query')
  .description('展开查询表单')
  .action(async () => {
    try {
      await fipTyped.clickShowQuery();
      success({ show_query: true });
    } catch (e: any) {
      error('show_query_error', e.message);
    }
  });

program
  .command('set-date <start> <end>')
  .description('设置日期范围 (格式: YYYY-MM-DD)')
  .action(async (start: string, end: string) => {
    try {
      await fipTyped.setDateRange(start, end);
      success({ start_date: start, end_date: end, set: true });
    } catch (e: any) {
      error('set_date_error', e.message);
    }
  });

program
  .command('set-tax-period <start> <end>')
  .description('设置税期 (格式: YYYY-MM)')
  .action(async (start: string, end: string) => {
    try {
      await fipTyped.setTaxPeriod(start, end);
      success({ start_period: start, end_period: end, set: true });
    } catch (e: any) {
      error('set_tax_period_error', e.message);
    }
  });

program
  .command('rows')
  .description('获取表格行数')
  .action(async () => {
    try {
      const rows = await fipTyped.getTableRowCount();
      success(rows);
    } catch (e: any) {
      error('rows_error', e.message);
    }
  });

program
  .command('table-data')
  .description('读取当前页面表格数据')
  .option('--max-rows <n>', '最大行数', '1000')
  .option('--no-headers', '不包含表头')
  .action(async (options: { maxRows: string; headers: boolean }) => {
    try {
      const result = await fipTyped.getTableData({
        maxRows: parseInt(options.maxRows),
        includeHeaders: options.headers !== false,
      });
      success(result);
    } catch (e: any) {
      error('table_data_error', e.message);
    }
  });

program
  .command('pick-company <code>')
  .description('选择申请单位 (如: 1000200020040011)')
  .action(async (code: string) => {
    try {
      await fipTyped.clickPickerButton('申请单位');
      await fipTyped.pickFromDict(code);
      success({ company_code: code, selected: true });
    } catch (e: any) {
      error('pick_company_error', e.message);
    }
  });

program
  .command('pick-tax-subject <code>')
  .description('选择纳税主体 (如: 91110000101638302P 或 91110000101107173B)')
  .action(async (code: string) => {
    try {
      await fipTyped.pickTaxSubject(code);
      success({ tax_code: code, selected: true });
    } catch (e: any) {
      error('pick_tax_subject_error', e.message);
    }
  });

program
  .command('switch-org')
  .description('打开切换组织机构对话框，显示当前组织机构信息')
  .option('--set <org>', '设置组织机构（开发中，需手动选择）')
  .option('--project <project>', '设置项目名称')
  .option('--department <dept>', '设置部门名称')
  .option('--list', '查看本地缓存的组织机构记录')
  .option('--from-cache', '仅从缓存查找，不打开浏览器')
  .action(
    async (options: {
      list?: boolean;
      set?: string;
      project?: string;
      department?: string;
      fromCache?: boolean;
    }) => {
      try {
        // 查看缓存模式
        if (options.list) {
          const records = organizationCache.listAllRecords();
          const stats = organizationCache.getCacheStats();
          success({
            cache_file: organizationCache.CACHE_FILE,
            total_records: stats.totalRecords,
            last_updated: stats.lastUpdated,
            unique_organizations: stats.uniqueOrganizations,
            records: records,
          });
          return;
        }

        if (
          options.set ||
          options.project ||
          options.department ||
          options.fromCache
        ) {
          // 切换/查询模式（支持缓存）
          const result = await fipTyped.switchOrganization({
            organization: options.set,
            project: options.project,
            department: options.department,
            fromCache: options.fromCache,
          });
          success(result);
        } else {
          // 查询模式：打开对话框读取信息，自动记录缓存
          const result = await fipTyped.switchOrganization({});
          success(result);
        }
      } catch (e: any) {
        error('switch_org_error', e.message);
      }
    }
  );

program
  .command('page-info')
  .description('获取当前页面信息（URL、标题）')
  .action(async () => {
    try {
      const info = await fipTyped.getPageInfo();
      success(info);
    } catch (e: any) {
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
  .action(
    async (
      text: string,
      options: {
        leftMin: string;
        leftMax: string;
        topMin: string;
        topMax: string;
      }
    ) => {
      try {
        const result = await fipTyped.findVisibleElementByText(text, {
          leftMin: parseInt(options.leftMin),
          leftMax: parseInt(options.leftMax),
          topMin: parseInt(options.topMin),
          topMax: parseInt(options.topMax),
        });
        success({ text, found: !!result, coordinates: result });
      } catch (e: any) {
        error('find_element_error', e.message);
      }
    }
  );

program
  .command('wait <ms>')
  .description('等待指定毫秒数')
  .action(async (ms: string) => {
    try {
      await fipTyped.sleep(parseInt(ms));
      success({ waited: parseInt(ms) });
    } catch (e: any) {
      error('wait_error', e.message);
    }
  });

program
  .command('picker-button <label>')
  .description('点击指定标签旁的 Picker 按钮（如：申请单位、纳税主体）')
  .action(async (label: string) => {
    try {
      await fipTyped.clickPickerButton(label);
      success({ label, clicked: true });
    } catch (e: any) {
      error('picker_button_error', e.message);
    }
  });

program
  .command('pick-dict <code>')
  .description('在已打开的 Picker 弹窗中查询并选择编码')
  .action(async (code: string) => {
    try {
      await fipTyped.pickFromDict(code);
      success({ code, selected: true });
    } catch (e: any) {
      error('pick_dict_error', e.message);
    }
  });

program
  .command('open-bill <billId>')
  .description('打开指定单据编号（自动搜索各标签页）')
  .option('--tab <name>', '指定标签页（我的单据/待办/已办/已办结）')
  .action(async (billId: string, options: { tab?: string }) => {
    try {
      const result = await fipTyped.openBill(billId, options.tab || null);
      success(result);
    } catch (e: any) {
      error('open_bill_error', e.message);
    }
  });

program
  .command('close-bill')
  .description('关闭当前单据详情页，返回 Dashboard')
  .action(async () => {
    try {
      const result = await fipTyped.closeBill();
      success(result);
    } catch (e: any) {
      error('close_bill_error', e.message);
    }
  });

program
  .command('list-attachments')
  .description('列出当前单据的所有附件')
  .option('--dir <path>', '下载目录', './downloads')
  .action(async (options: { dir: string }) => {
    try {
      const result = await fipTyped.listAttachments({
        downloadDir: options.dir,
      });
      success(result);
    } catch (e: any) {
      error('list_attachments_error', e.message);
    }
  });

program
  .command('download-attachments')
  .description('下载当前单据的所有附件')
  .option('--dir <path>', '保存目录', './downloads')
  .option('--chrome-dir <path>', 'Chrome下载目录（默认自动检测）')
  .action(async (options: { dir: string; chromeDir?: string }) => {
    try {
      const result = await fipTyped.downloadAttachments({
        downloadDir: options.dir,
        chromeDownloadDir: options.chromeDir,
      });
      success(result);
    } catch (e: any) {
      error('download_attachments_error', e.message);
    }
  });

program
  .command('wait-for-element <text>')
  .description('轮询等待指定文本元素出现（默认超时10秒）')
  .option('--timeout <ms>', '超时毫秒数', '10000')
  .option('--interval <ms>', '轮询间隔毫秒数', '500')
  .action(
    async (text: string, options: { timeout: string; interval: string }) => {
      try {
        const result = await fipTyped.waitForElement(text, {
          timeout: parseInt(options.timeout),
          interval: parseInt(options.interval),
        });
        success(result);
      } catch (e: any) {
        error('wait_for_element_error', e.message);
      }
    }
  );

program
  .command('wait-for-popup')
  .description('轮询等待弹窗出现（默认超时10秒）')
  .option('--timeout <ms>', '超时毫秒数', '10000')
  .action(async (options: { timeout: string }) => {
    try {
      const result = await fipTyped.waitForPopup(parseInt(options.timeout));
      success(result);
    } catch (e: any) {
      error('wait_for_popup_error', e.message);
    }
  });

program
  .command('wait-for-url <pattern>')
  .description('轮询等待 URL 匹配指定正则（如 "FLOW_"）')
  .option('--timeout <ms>', '超时毫秒数', '10000')
  .action(async (pattern: string, options: { timeout: string }) => {
    try {
      const result = await fipTyped.waitForUrl(
        pattern,
        parseInt(options.timeout)
      );
      success(result);
    } catch (e: any) {
      error('wait_for_url_error', e.message);
    }
  });

program
  .command('screenshot')
  .description('截图并保存')
  .option('-o, --output <path>', '输出路径')
  .action(async (options: { output?: string }) => {
    try {
      const result = await screenshot('png');
      if (!result.ok || !result.data) {
        error('screenshot_error', result.error?.message || 'Screenshot failed');
        return;
      }

      const outputPath =
        options.output || `D:/claude/fip-cli/screenshot_${Date.now()}.png`;

      // WebBridge 返回文件路径
      if (result.data.path && fs.existsSync(result.data.path as string)) {
        fs.copyFileSync(result.data.path as string, outputPath);
        success({
          saved: true,
          path: outputPath,
          size: (result.data as { sizeBytes?: number }).sizeBytes,
        });
        return;
      }

      // 兼容旧版 base64 返回格式
      if (result.data.data) {
        fs.writeFileSync(
          outputPath,
          Buffer.from(result.data.data as string, 'base64')
        );
        success({
          saved: true,
          path: outputPath,
          size: (result.data.data as string).length,
        });
        return;
      }

      error('screenshot_error', 'Screenshot returned empty data');
    } catch (e: any) {
      error('screenshot_error', e.message);
    }
  });

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
  .action(
    async (options: {
      startDate?: string;
      endDate?: string;
      startPeriod?: string;
      endPeriod?: string;
      companyCode?: string;
      taxCode?: string;
      voidStatus?: string;
      queryOnly: boolean;
    }) => {
      try {
        await fipTyped.ensureConnection();
        const cfg = config.get() as Record<string, string | undefined>;
        const args = {
          startDate: options.startDate || cfg.startDate,
          endDate: options.endDate || cfg.endDate,
          startPeriod: options.startPeriod || cfg.startPeriod,
          endPeriod: options.endPeriod || cfg.endPeriod,
          companyCode: options.companyCode || cfg.companyCode,
          taxCode: options.taxCode || cfg.taxCode,
          voidStatus: options.voidStatus || cfg.voidStatus,
          queryOnly: options.queryOnly,
        };
        const result = await fipTyped.exportUnbilledIncomeLedger(args);
        success(result);
      } catch (e: any) {
        error('export_unbilled_error', e.message);
      }
    }
  );

program
  .command('export-input-transfer')
  .description('进项转出明细台账查询导出（完整流程）')
  .option('--start-period <period>', '起始税期 (YYYY-MM)')
  .option('--end-period <period>', '截止税期 (YYYY-MM)')
  .option('--company-code <code>', '转出单位编码')
  .option('--tax-code <code>', '纳税主体税号')
  .option(
    '--doc-status <status>',
    '单据状态 (全部/制单中/审批中/流程结束/已作废)'
  )
  .option('--query-only', '仅查询不导出', false)
  .action(
    async (options: {
      startPeriod?: string;
      endPeriod?: string;
      companyCode?: string;
      taxCode?: string;
      docStatus?: string;
      queryOnly: boolean;
    }) => {
      try {
        const cfg = config.get() as Record<string, string | undefined>;
        const result = await fipTyped.exportInputTransferLedger({
          startPeriod: options.startPeriod || cfg.startPeriod,
          endPeriod: options.endPeriod || cfg.endPeriod,
          companyCode: options.companyCode || cfg.companyCode,
          taxCode: options.taxCode || cfg.taxCode,
          docStatus: options.docStatus || cfg.docStatus,
          queryOnly: options.queryOnly,
        });
        success(result);
      } catch (e: any) {
        error('export_input_transfer_error', e.message);
      }
    }
  );

program
  .command('export-output-invoice')
  .description('销项发票明细台账查询导出（完整流程）')
  .option('--start-date <date>', '起始日期 (YYYY-MM-DD)')
  .option('--end-date <date>', '截止日期 (YYYY-MM-DD)')
  .option('--company-code <code>', '申请单位编码')
  .option('--seller-code <code>', '销方税号')
  .option('--query-only', '仅查询不导出', false)
  .action(
    async (options: {
      startDate?: string;
      endDate?: string;
      companyCode?: string;
      sellerCode?: string;
      queryOnly: boolean;
    }) => {
      try {
        const cfg = config.get() as Record<string, string | undefined>;
        const result = await fipTyped.exportOutputInvoiceLedger({
          startDate: options.startDate || cfg.startDate,
          endDate: options.endDate || cfg.endDate,
          companyCode: options.companyCode || cfg.companyCode,
          sellerCode: options.sellerCode || cfg.sellerCode,
          queryOnly: options.queryOnly,
        });
        success(result);
      } catch (e: any) {
        error('export_output_invoice_error', e.message);
      }
    }
  );

program
  .command('export-vat-prepayment')
  .description('增值税预缴款台账查询导出（完整流程）')
  .option('--start-period <period>', '起始税期 (YYYY-MM)')
  .option('--end-period <period>', '截止税期 (YYYY-MM)')
  .option('--company-code <code>', '申请单位编码')
  .option('--tax-code <code>', '纳税主体税号')
  .option('--doc-type <type>', '单据类型 (完税预缴单/预缴计算单)')
  .option('--query-only', '仅查询不导出', false)
  .action(
    async (options: {
      startPeriod?: string;
      endPeriod?: string;
      companyCode?: string;
      taxCode?: string;
      docType?: string;
      queryOnly: boolean;
    }) => {
      try {
        const cfg = config.get() as Record<string, string | undefined>;
        const result = await fipTyped.exportVatPrepaymentLedger({
          startPeriod: options.startPeriod || cfg.startPeriod,
          endPeriod: options.endPeriod || cfg.endPeriod,
          companyCode: options.companyCode || cfg.companyCode,
          taxCode: options.taxCode || cfg.taxCode,
          docType: options.docType || cfg.docType,
          queryOnly: options.queryOnly,
        });
        success(result);
      } catch (e: any) {
        error('export_vat_prepayment_error', e.message);
      }
    }
  );

program
  .command('export-passenger-transport')
  .description('旅客运输服务台账查询导出（完整流程）')
  .option('--start-period <period>', '起始税期 (YYYY-MM)')
  .option('--end-period <period>', '截止税期 (YYYY-MM)')
  .option('--company-code <code>', '申请单位编码')
  .option('--tax-code <code>', '纳税主体税号')
  .option('--query-only', '仅查询不导出', false)
  .action(
    async (options: {
      startPeriod?: string;
      endPeriod?: string;
      companyCode?: string;
      taxCode?: string;
      queryOnly: boolean;
    }) => {
      try {
        const cfg = config.get() as Record<string, string | undefined>;
        const result = await fipTyped.exportPassengerTransportLedger({
          startPeriod: options.startPeriod || cfg.startPeriod,
          endPeriod: options.endPeriod || cfg.endPeriod,
          companyCode: options.companyCode || cfg.companyCode,
          taxCode: options.taxCode || cfg.taxCode,
          queryOnly: options.queryOnly,
        });
        success(result);
      } catch (e: any) {
        error('export_passenger_transport_error', e.message);
      }
    }
  );

program
  .command('export-all')
  .description('批量导出多个台账')
  .option('--start-period <period>', '起始税期 (YYYY-MM)')
  .option('--end-period <period>', '截止税期 (YYYY-MM)')
  .option('--start-date <date>', '起始日期 (YYYY-MM-DD)')
  .option('--end-date <date>', '截止日期 (YYYY-MM-DD)')
  .option('--company-code <code>', '申请单位编码')
  .option('--tax-code <code>', '纳税主体税号')
  .option('--seller-code <code>', '销方税号')
  .option('--void-status <status>', '作废状态')
  .option('--doc-status <status>', '单据状态')
  .option('--doc-type <type>', '单据类型')
  .option(
    '--ledgers <list>',
    '指定台账（逗号分隔）',
    'unbilled,input-transfer,output-invoice,vat-prepayment,passenger-transport'
  )
  .option('--query-only', '仅查询不导出', false)
  .action(
    async (options: {
      startPeriod?: string;
      endPeriod?: string;
      startDate?: string;
      endDate?: string;
      companyCode?: string;
      taxCode?: string;
      sellerCode?: string;
      voidStatus?: string;
      docStatus?: string;
      docType?: string;
      ledgers: string;
      queryOnly: boolean;
    }) => {
      try {
        const cfg = config.get() as Record<string, string | undefined>;
        const ledgers = options.ledgers.split(',');
        const results: Record<string, unknown> = {};
        const ledgerMap: Record<string, string> = {
          unbilled: 'exportUnbilledIncomeLedger',
          'input-transfer': 'exportInputTransferLedger',
          'output-invoice': 'exportOutputInvoiceLedger',
          'vat-prepayment': 'exportVatPrepaymentLedger',
          'passenger-transport': 'exportPassengerTransportLedger',
        };
        const validLedgers = Object.keys(ledgerMap);
        const invalidLedgers = ledgers.filter(
          (name) => !validLedgers.includes(name.trim())
        );
        if (invalidLedgers.length > 0) {
          throw new Error(
            `Invalid ledger(s): ${invalidLedgers.join(', ')}. Valid options: ${validLedgers.join(', ')}`
          );
        }
        for (const name of ledgers) {
          const fnName = ledgerMap[name.trim()];
          if (
            !fnName ||
            !(fipTyped as unknown as Record<string, unknown>)[fnName]
          ) {
            results[name] = { error: 'Unknown ledger' };
            continue;
          }
          let params: Record<string, unknown> = {
            queryOnly: options.queryOnly,
          };
          if (name.trim() === 'output-invoice') {
            params = {
              ...params,
              startDate: options.startDate || cfg.startDate,
              endDate: options.endDate || cfg.endDate,
              companyCode: options.companyCode || cfg.companyCode,
              sellerCode: options.sellerCode || cfg.sellerCode,
            };
          } else {
            params = {
              ...params,
              startPeriod: options.startPeriod || cfg.startPeriod,
              endPeriod: options.endPeriod || cfg.endPeriod,
              companyCode: options.companyCode || cfg.companyCode,
              taxCode: options.taxCode || cfg.taxCode,
            };
          }
          if (name.trim() === 'unbilled')
            params.voidStatus = options.voidStatus || cfg.voidStatus;
          if (name.trim() === 'input-transfer')
            params.docStatus = options.docStatus || cfg.docStatus;
          if (name.trim() === 'vat-prepayment')
            params.docType = options.docType || cfg.docType;
          try {
            const fn = (fipTyped as unknown as Record<string, unknown>)[fnName];
            const result = await (
              fn as (
                params: Record<string, unknown>
              ) => Promise<Record<string, unknown>>
            )(params);
            results[name] = { success: true, ...result };
          } catch (e: any) {
            results[name] = { success: false, error: e.message };
          }
          await fipTyped.sleep(2000);
        }
        success({ executed: ledgers.length, results });
      } catch (e: any) {
        error('export_all_error', e.message);
      }
    }
  );

program
  .command('examples')
  .description('显示使用示例')
  .action(() => {
    console.error(`
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
      const fields = await fipTyped.extractInvoiceFields();
      success(fields);
    } catch (e: any) {
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
  .action(
    async (
      billId: string | undefined,
      options: {
        confirmedAmount?: string;
        attachmentContract?: string;
        format: string;
        output?: string;
        keepOpen: boolean;
      }
    ) => {
      try {
        await fipTyped.ensureConnection();

        // 1. 如果提供了 billId，先打开单据
        if (billId) {
          console.log(`打开单据 ${billId}...`);
          await fipTyped.openBill(billId);
          await fipTyped.sleep(3000);
        }

        // 2. 提取字段
        console.log('提取单据字段...');
        const fields = await fipTyped.extractInvoiceFields();

        if (!fields.invoice_no) {
          throw new Error(
            '未能从页面提取到单据编号，请确认当前页面是开票单详情页'
          );
        }

        console.log(`提取成功: 单据 ${fields.invoice_no}`);

        // 3. 合并人工输入的参数（转为数字）
        if (options.confirmedAmount) {
          fields.confirmed_amount = parseFloat(options.confirmedAmount);
        }
        if (options.attachmentContract) {
          fields.attachment_contract_amount = parseFloat(
            options.attachmentContract
          );
        }

        // 4. 执行审核
        console.log('执行自动核对...');
        const result = fipTyped.auditInvoice(fields);

        // 5. 生成报告
        let report: string;
        if (options.format === 'json') {
          report = fipTyped.generateAuditJsonReport(result);
        } else if (options.format === 'md') {
          report = fipTyped.generateAuditMarkdownReport(result);
        } else {
          report = fipTyped.generateAuditTextReport(result);
        }

        // 6. 输出到文件或控制台
        if (options.output) {
          fs.writeFileSync(options.output, report, 'utf8');
          console.log(`报告已保存: ${options.output}`);
        }

        // 7. 关闭单据（除非 --keep-open）
        if (!options.keepOpen) {
          console.log('关闭单据...');
          await fipTyped.closeBill();
        }

        // 8. 返回结果
        success({
          invoice_no: result.invoice_no,
          stats: result.stats,
          report: options.output ? null : report,
          output_file: options.output || null,
          format: options.format,
        });
      } catch (e: any) {
        error('audit_invoice_error', e.message);
      }
    }
  );

program
  .command('extract-bill [billId]')
  .description('提取单据字段并生成审核提示')
  .option('--type <type>', '手动指定单据类型 (SLBX/TBX/CFK/CBX)')
  .option('--output <path>', '输出到 JSON 文件')
  .option('--current-page', '仅提取当前页面，不导航', false)
  .action(
    async (
      billId: string | undefined,
      options: {
        type?: string;
        output?: string;
        currentPage: boolean;
      }
    ) => {
      try {
        await fipTyped.ensureConnection();
        verbose('extract-bill: billId=', billId, 'type=', options.type);

        if (!options.currentPage && billId) {
          verbose(`打开单据 ${billId}...`);
          await fipTyped.openBill(billId);
          await fipTyped.sleep(3000);
          // 打开单据后关闭可能出现的弹窗（如审批提醒）
          await fipTyped.waitAndDismissDialogs(5000, { waitAfterClose: 1500 });
        }

        verbose('提取单据字段...');
        const data = await fipTyped.extractBill(
          billId || '',
          options.type || null
        );
        debug('extract-bill: extracted keys=', Object.keys(data).join(', '));

        verbose('生成审核提示...');
        const hints = fipTyped.generateBillAuditHints(
          data,
          (data as { _meta?: { bill_type?: string } })._meta?.bill_type || ''
        );
        (data as Record<string, unknown>).audit_hints = hints;

        if (options.output) {
          fs.writeFileSync(
            options.output,
            JSON.stringify(data, null, 2),
            'utf8'
          );
          console.log(`结果已保存: ${options.output}`);
        }

        // 如果之前打开了单据，提取完成后关闭
        if (!options.currentPage && billId) {
          verbose('关闭单据...');
          try {
            await fipTyped.closeBill();
          } catch (closeErr: any) {
            // 关闭失败不影响提取结果
            console.log(`关闭单据跳过: ${closeErr.message}`);
          }
        }

        success(data);
      } catch (e: any) {
        error('extract_bill_error', e.message);
      }
    }
  );

program
  .command('doctor')
  .description(
    '诊断环境状态：检查 Node.js、依赖、WebBridge、Chrome CDP、FIP 登录等'
  )
  .option('--json', '输出 JSON 格式报告')
  .action(async (options: { json?: boolean }) => {
    try {
      verbose('运行 doctor 诊断...');
      const checks = await doctor.runDiagnostics();
      debug('doctor: checks count=', checks.length);
      if (options.json) {
        console.error(
          JSON.stringify(doctor.generateJsonReport(checks), null, 2)
        );
      } else {
        console.error(doctor.generateReport(checks));
      }
      // 如果有错误，退出码非零
      const hasError = checks.some((c) => c.status === 'error');
      if (hasError) {
        process.exit(1);
      }
    } catch (e: any) {
      console.error('诊断执行失败:', e.message);
      process.exit(1);
    }
  });

program.parseAsync(process.argv).catch(async (err: Error) => {
  // 未捕获的异常
  await error('uncaught_error', err.message);
  process.exit(1);
});
