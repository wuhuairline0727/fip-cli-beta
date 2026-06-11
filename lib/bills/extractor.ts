/**
 * 通用单据提取引擎
 * 负责构建并执行浏览器端提取代码
 */

import { evaluate } from '../browser';
import { debug } from '../logger';
import { dismissDialogs } from '../utils/dialog';
import { detectBillType, getBillConfig } from './config';

export interface BillConfig {
  name?: string;
  codePrefix?: string;
  basePatterns?: Record<string, RegExp>;
  inputFields?: Record<string, { byId?: string; byIdPrefix?: string; byLabel?: string }>;
  tables?: Array<{
    name: string;
    identifyBy: { headerText: string };
    columns: Array<{ label?: string; header?: string; key?: string; field?: string; type?: string }>;
  }>;
  auditHints?: unknown[];
  filterConfig?: Record<string, unknown>;
}

/**
 * YJK 单据后处理：补充税率计算
 * 如果界面已标注税率则保留，否则自动计算
 * @param data - 提取的原始数据
 * @returns 处理后数据
 */
export function postProcessYjk(data: Record<string, unknown>): Record<string, unknown> {
  const result = { ...data };

  // 获取预缴增值税⑥作为分母
  const vatPrepayment6 = parseAmount(data.vat_prepayment_6 as string | null | undefined);
  if (!vatPrepayment6 || vatPrepayment6 === 0) {
    return result;
  }

  // 安全的金额解析（支持字符串和数字）
  function safeParseAmount(value: unknown): number | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    return parseAmount(value as string | null | undefined);
  }

  // 处理附加预缴表格
  const surchargeTable = result.surcharge_prepayment;
  if (Array.isArray(surchargeTable) && surchargeTable.length > 0) {
    result.surcharge_prepayment = surchargeTable.map((row: unknown) => {
      const rowCopy = { ...(row as Record<string, unknown>) };

      // 计算各税费的税率（分母为预缴增值税⑥）
      const urbanTax = safeParseAmount(rowCopy.urban_maintenance_tax);
      const eduSurcharge = safeParseAmount(rowCopy.education_surcharge);
      const localEduSurcharge = safeParseAmount(
        rowCopy.local_education_surcharge
      );
      const totalSurcharge = safeParseAmount(rowCopy.total_surcharge);

      if (urbanTax && urbanTax > 0) {
        rowCopy.urban_maintenance_tax_rate =
          ((urbanTax / vatPrepayment6) * 100).toFixed(2) + '%';
      }
      if (eduSurcharge && eduSurcharge > 0) {
        rowCopy.education_surcharge_rate =
          ((eduSurcharge / vatPrepayment6) * 100).toFixed(2) + '%';
      }
      if (localEduSurcharge && localEduSurcharge > 0) {
        rowCopy.local_education_surcharge_rate =
          ((localEduSurcharge / vatPrepayment6) * 100).toFixed(2) + '%';
      }
      if (totalSurcharge && totalSurcharge > 0) {
        rowCopy.total_surcharge_rate =
          ((totalSurcharge / vatPrepayment6) * 100).toFixed(2) + '%';
      }

      return rowCopy;
    });

    // 补充表格级税率汇总
    result.surcharge_tax_rates = {};
    (result.surcharge_prepayment as Array<Record<string, unknown>>).forEach((row) => {
      if (row.urban_maintenance_tax_rate) {
        (result.surcharge_tax_rates as Record<string, unknown>)['城市维护建设税'] =
          row.urban_maintenance_tax_rate;
      }
      if (row.education_surcharge_rate) {
        (result.surcharge_tax_rates as Record<string, unknown>)['教育费及附加'] =
          row.education_surcharge_rate;
      }
      if (row.local_education_surcharge_rate) {
        (result.surcharge_tax_rates as Record<string, unknown>)['地方教育费及附加'] =
          row.local_education_surcharge_rate;
      }
      if (row.total_surcharge_rate) {
        (result.surcharge_tax_rates as Record<string, unknown>)['合计'] = row.total_surcharge_rate;
      }
    });
  }

  // 补充增值税预缴汇总信息
  result.vat_summary = {
    vat_prepayment_6: data.vat_prepayment_6 || null,
    prepayment_tax_rate_4: data.prepayment_tax_rate_4 || null,
    levy_rate_5: data.levy_rate_5 || null,
    invoice_amount_1: data.invoice_amount_1 || null,
    subcontract_invoice_deduction_2:
      data.subcontract_invoice_deduction_2 || null,
    taxable_sales_3: data.taxable_sales_3 || null,
  };

  // 补充所得税预缴汇总
  result.income_tax_summary = {
    is_prepayment: data.is_income_tax_prepayment || null,
    corporate_tax: data.corporate_income_tax || null,
    individual_tax: data.individual_income_tax || null,
  };

  return result;
}

/**
 * 解析金额字符串，返回数字或 null
 * @param str - 金额字符串
 * @returns 解析后的数字或 null
 */
export function parseAmount(str: string | null | undefined): number | null {
  if (typeof str !== 'string') {
    return null;
  }
  const cleaned = str.replace(/[¥￥,\s]/g, '').trim();
  if (cleaned === '' || isNaN(cleaned as unknown as number)) {
    return null;
  }
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

/**
 * 将正则对象序列化为可在代码字符串中使用的字面量字符串
 * @param regex - 正则表达式
 * @returns 序列化后的字符串
 */
function regexToString(regex: RegExp): string {
  return regex.toString();
}

/**
 * 构建在浏览器中执行的提取代码字符串
 * @param config - 单据配置
 * @returns 浏览器端执行代码字符串
 */
export function buildExtractionCode(config: BillConfig): string {
  const {
    basePatterns = {},
    inputFields = {},
    tables = [],
    auditHints = [],
    filterConfig = {},
  } = config;

  // 序列化 filterConfig 供浏览器端使用
  const filterConfigStr = JSON.stringify(filterConfig);

  // 序列化 basePatterns
  const patternsEntries = Object.entries(basePatterns)
    .map(([key, regex]) => {
      return `    ${key}: ${regexToString(regex)}`;
    })
    .join(',\n');

  // 序列化 inputFields
  const inputFieldsEntries = Object.entries(inputFields)
    .map(([key, spec]) => {
      if ('byId' in spec) {
        return `    ${key}: { byId: ${JSON.stringify(spec.byId)} }`;
      }
      if ('byIdPrefix' in spec) {
        return `    ${key}: { byIdPrefix: ${JSON.stringify(spec.byIdPrefix)} }`;
      }
      return `    ${key}: { byLabel: ${JSON.stringify(spec.byLabel)} }`;
    })
    .join(',\n');

  // 序列化 tables（支持数组或对象格式）
  const tablesList = Array.isArray(tables) ? tables : Object.values(tables);
  const tablesArray = tablesList
    .map((t) => {
      const cols = (t.columns || [])
        .map((c) => {
          const typePart = c.type ? `, type: ${JSON.stringify(c.type)}` : '';
          return `{ header: ${JSON.stringify(c.label || c.header)}, field: ${JSON.stringify(c.key || c.field)}${typePart} }`;
        })
        .join(', ');
      return `{ name: ${JSON.stringify(t.name)}, identifyBy: { headerText: ${JSON.stringify(t.identifyBy?.headerText)} }, columns: [${cols}] }`;
    })
    .join(',\n    ');

  const code = `(function() {
  const result = {};

  // === 共享工具函数 ===
  // 解析金额字符串为数字
  function parseCellAmount(cellValue) {
    const cleaned = cellValue.replace(/[\\u00a5\\uFFE5,\\s]/g, '').trim();
    const num = parseFloat(cleaned);
    return Number.isFinite(num) ? num : cellValue;
  }

  // 使用 x 坐标对齐提取单元格值
  function extractRowData(visibleCells, cellXs, colIndexMap) {
    const rowData = {};
    let hasData = false;
    for (const [field, meta] of Object.entries(colIndexMap)) {
      let bestIdx = -1;
      let bestDiff = Infinity;
      for (let ci = 0; ci < cellXs.length; ci++) {
        const diff = Math.abs(cellXs[ci] - meta.x);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestIdx = ci;
        }
      }
      const cell = bestIdx !== -1 ? visibleCells[bestIdx].element : null;
      let cellValue = cell ? (cell.innerText || '').trim() : null;
      if (cellValue !== null && cellValue !== '') {
        hasData = true;
      }
      if (meta.type === 'amount' && cellValue) {
        cellValue = parseCellAmount(cellValue);
      }
      rowData[field] = cellValue;
    }
    return { rowData, hasData };
  }

  // 过滤无效行（合计行、表头行、发票信息行）
  const _filterConfig = ${filterConfigStr};
  const HEADER_TEXTS = _filterConfig.headerTexts || [];
  const INVOICE_STATUS_WORDS = _filterConfig.invoiceStatusWords || [];
  function isValidDataRow(rowData, colIndexMap) {
    const hasIdentifier = Object.entries(rowData).some(([field, value]) => {
      const meta = colIndexMap[field];
      return meta?.type !== 'amount' && value !== null && value !== '';
    });
    const isTotalRow = rowData._action === '合计：' || (rowData.name === '' && rowData._action);
    const isHeaderRow = HEADER_TEXTS.some(ht =>
      rowData.name === ht || rowData.reason === ht || rowData.expense_item === ht
    );
    const isInvoiceRow = INVOICE_STATUS_WORDS.includes(rowData.name) &&
      (rowData.reason || '').includes('发票');
    return hasIdentifier && !isTotalRow && !isHeaderRow && !isInvoiceRow;
  }

  // 找到包含最多文本的可见容器（GWT 页面中 document.body.innerText 可能不完整）
  let pageText = document.body.innerText || '';
  if (pageText.length < 5000) {
    const gwtPrefix = _filterConfig.gwtClassPrefix || 'FD26IYC';
    const allContainers = document.querySelectorAll('[class*="' + gwtPrefix + '"]');
    let bestContainer = null;
    let bestLen = 0;
    for (const el of allContainers) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const text = el.innerText || '';
        if (text.length > bestLen) {
          bestLen = text.length;
          bestContainer = el;
        }
      }
    }
    if (bestContainer && bestLen > pageText.length) {
      pageText = bestContainer.innerText || '';
    }
  }

  // === 1. 基础字段（innerText 正则） ===
  const basePatterns = {
${patternsEntries}
  };
  for (const [key, pattern] of Object.entries(basePatterns)) {
    const match = pageText.match(pattern);
    result[key] = match ? match[1].trim() : null;
  }

  // === 2. Input 字段 ===
  const inputFields = {
${inputFieldsEntries}
  };
  for (const [key, spec] of Object.entries(inputFields)) {
    let value = null;
    if (spec.byId) {
      const el = document.getElementById(spec.byId);
      if (el) {
        value = el.value || el.textContent || null;
      }
    } else if (spec.byIdPrefix) {
      const el = document.querySelector('[id^="' + spec.byIdPrefix + '"]');
      if (el) {
        value = el.value || el.textContent || null;
      }
    } else if (spec.byLabel) {
      const labels = Array.from(document.querySelectorAll('label'));
      const targetLabel = labels.find(l => {
        const text = (l.textContent || '').replace(/[：:]/g, '').trim();
        // 兼容带 * 前缀的必填标记（如 *报销事由）
        const textWithoutStar = text.replace(/^\*/, '').trim();
        return text === spec.byLabel || textWithoutStar === spec.byLabel;
      });
      if (targetLabel) {
        let parent = targetLabel.parentElement;
        let inputEl = null;
        while (parent && !inputEl) {
          inputEl = parent.querySelector('input, textarea, select');
          if (!inputEl) {
            parent = parent.parentElement;
          }
        }
        if (inputEl) {
          value = inputEl.value || inputEl.textContent || null;
        }
      }
    }
    result[key] = value;
  }

  // === 3. 子表数据 ===
  const tables = [
    ${tablesArray}
  ];
  for (const tableDef of tables) {
    const gwtPrefix = _filterConfig.gwtClassPrefix || 'FD26IYC';
    const rows = Array.from(document.querySelectorAll('tr[class*="' + gwtPrefix + '"]'));
    let matchedRows = [];
    for (const row of rows) {
      const rect = row.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const rowText = row.innerText || '';
        if (rowText.includes(tableDef.identifyBy.headerText)) {
          matchedRows.push(row);
        }
      }
    }
    if (matchedRows.length === 0) {
      result[tableDef.name] = [];
      continue;
    }
    const headerRow = matchedRows[0];
    const headerCells = Array.from(headerRow.querySelectorAll('th, td'));
    const headerTexts = headerCells.map(c => (c.innerText || '').trim());
    const headerXs = headerCells.map(c => c.getBoundingClientRect().x);
    const colIndexMap = {};
    for (const colDef of tableDef.columns) {
      const idx = headerTexts.findIndex(h => h.includes(colDef.header));
      if (idx !== -1) {
        colIndexMap[colDef.field] = { index: idx, type: colDef.type || 'string', x: headerXs[idx] };
      }
    }
    const dataRows = [];

    // 方法1: 尝试 nextElementSibling（同一 table 内）
    let sibling = headerRow.nextElementSibling;
    while (sibling && sibling.tagName === 'TR') {
      const rect = sibling.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const cells = Array.from(sibling.querySelectorAll('td'));
        // 跳过嵌套表头行
        const rowText = sibling.innerText || '';
        // 检测1: 行内包含配置的表头文本（通用）
        const isNestedHeader1 = cells.length > 0 && cells.length < headerCells.length &&
          tableDef.columns.some(col => rowText.includes(col.header) && col.header !== '');
        // 检测2: CBX 费用摘要的嵌套表头行（城市间交通费 | 住宿费 | 补助费 | 其他费用 | 合计）
        const isNestedHeader2 = rowText.includes('城市间交通费') && rowText.includes('住宿费') && rowText.includes('合计');
        if (isNestedHeader1 || isNestedHeader2) {
          // 如果是 CBX 嵌套表头，更新 total_amount 的 x 坐标为"合计"列的 x 坐标
          if (isNestedHeader2 && colIndexMap.total_amount) {
            const nestedCells = Array.from(sibling.querySelectorAll('th, td'));
            for (const nc of nestedCells) {
              if ((nc.innerText || '').trim() === '合计') {
                colIndexMap.total_amount.x = nc.getBoundingClientRect().x;
                break;
              }
            }
          }
          sibling = sibling.nextElementSibling;
          continue;
        }
        // 使用 x 坐标对齐提取单元格值（过滤 width=0 的隐藏单元格）
        const visibleCells = cells.map((c, i) => ({
          index: i,
          x: c.getBoundingClientRect().x,
          width: c.getBoundingClientRect().width,
          element: c
        })).filter(c => c.width > 0);
        const cellXs = visibleCells.map(c => c.x);
        const { rowData, hasData } = extractRowData(visibleCells, cellXs, colIndexMap);
        if (hasData && isValidDataRow(rowData, colIndexMap)) {
          dataRows.push(rowData);
        }
      }
      sibling = sibling.nextElementSibling;
    }

    // 方法2: 如果方法1没找到数据，尝试在后续所有可见 tr 中查找（分离的 table 结构）
    if (dataRows.length === 0) {
      const headerCellCount = headerCells.length;
      const allVisibleRows = Array.from(document.querySelectorAll('tr')).filter(r => {
        const rect = r.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });

      // 找到表头行在列表中的位置
      const headerIndex = allVisibleRows.findIndex(r => r === headerRow);
      if (headerIndex !== -1) {
        // 遍历表头之后的行
        for (let i = headerIndex + 1; i < allVisibleRows.length; i++) {
          const row = allVisibleRows[i];
          const rowText = row.innerText || '';

          // 如果这一行包含表头文本，说明是另一个表的表头，停止
          if (rowText.includes(tableDef.identifyBy.headerText)) {
            break;
          }

          // 检查这一行是否有数据单元格
          const cells = Array.from(row.querySelectorAll('td'));
          if (cells.length === 0) continue;

          // 如果可见列数与表头差异过大，说明是另一个表格，停止
          // 阈值设为 8：CBX 数据行可能比表头多 4 个单元格（嵌套列展开）
          const visibleCellCount = cells.filter(c => c.getBoundingClientRect().width > 0).length;
          if (Math.abs(visibleCellCount - headerCellCount) > 8) {
            break;
          }

          // 跳过嵌套表头行
          const visibleCellTexts = cells.filter(c => c.getBoundingClientRect().width > 0).map(c => (c.innerText || '').trim());
          // 检测1: 行内包含配置的表头文本（通用）
          const isNestedHeader1 = visibleCellTexts.length > 0 && visibleCellTexts.length < headerCellCount &&
            tableDef.columns.some(col => visibleCellTexts.some(text => text === col.header));
          // 检测2: CBX 费用摘要的嵌套表头行
          const isNestedHeader2 = rowText.includes('城市间交通费') && rowText.includes('住宿费') && rowText.includes('合计');
          if (isNestedHeader1 || isNestedHeader2) {
            continue;
          }

          // 如果第一列是表头文本（如"发票类型"），说明是另一个表格，停止
          const firstCellText = (cells[0]?.innerText || '').trim();
          if (firstCellText && ['发票类型', '支付方式', '操作'].includes(firstCellText)) {
            break;
          }

          // 检测3: 如果行内包含"发票代码"和"发票号码"，说明是分包发票表头，停止
          const isSubcontractHeader = rowText.includes('发票代码') && rowText.includes('发票号码');
          if (isSubcontractHeader) {
            break;
          }

          // 使用 x 坐标对齐提取单元格值（过滤 width=0 的隐藏单元格）
          const visibleCells = cells.map((c, i) => ({
            index: i,
            x: c.getBoundingClientRect().x,
            width: c.getBoundingClientRect().width,
            element: c
          })).filter(c => c.width > 0);
          const cellXs = visibleCells.map(c => c.x);
          const { rowData, hasData } = extractRowData(visibleCells, cellXs, colIndexMap);
          if (hasData && isValidDataRow(rowData, colIndexMap)) {
            dataRows.push(rowData);
          }
        }
      }
    }

    result[tableDef.name] = dataRows;
  }

  // === 4. 附件信息 ===
  const attachments = [];
  const seen = new Set();
  const links = Array.from(document.querySelectorAll('a'));
  for (const link of links) {
    const href = link.getAttribute('href') || '';
    const text = (link.innerText || link.textContent || '').trim();
    // 只收集有下载属性或看起来像文件链接的
    const isDownload = link.hasAttribute('download');
    const isFileLink = /\.(pdf|doc|docx|xls|xlsx|zip|rar|png|jpg|jpeg)$/i.test(href);
    if (href && text && (isDownload || isFileLink)) {
      attachments.push({ name: text, url: href });
    }
  }
  result.attachments = attachments;

  // === 5. UI 附件数量 ===
  const uiAttachmentLabel = Array.from(document.querySelectorAll('*')).find(el => {
    const text = (el.innerText || el.textContent || '').trim();
    return text === '说明附件';
  });
  if (uiAttachmentLabel) {
    const parent = uiAttachmentLabel.closest('.ant-row, .ant-form-item, [class*="row"], div');
    if (parent) {
      const countMatch = (parent.innerText || '').match(/\\d+/);
      result.ui_attachment_count = countMatch ? parseInt(countMatch[0], 10) : null;
    } else {
      result.ui_attachment_count = null;
    }
  } else {
    result.ui_attachment_count = null;
  }

  return result;
})()`;

  return code;
}

/**
 * 提取单据数据（主入口）
 * @param billId - 单据编号
 * @param billType - 单据类型（可选，自动识别）
 * @returns 提取的单据数据
 */
export async function extractBill(
  billId: string,
  billType?: string | null
): Promise<Record<string, unknown>> {
  if (!billType) {
    billType = detectBillType(billId);
  }
  if (!billType) {
    throw new Error(`无法识别单据类型: ${billId}`);
  }

  const config = getBillConfig(billType);
  if (!config) {
    throw new Error(`未找到单据配置: ${billType}`);
  }

  debug(
    'extractBill: billId=',
    billId,
    'billType=',
    billType,
    'config=',
    config.name
  );

  // 提取前先关闭可能存在的弹窗
  await dismissDialogs();

  const code = buildExtractionCode(config);
  const evalResult = await evaluate(code);
  let extractedData = (evalResult.data as { value?: Record<string, unknown> } | undefined)?.value || {};

  debug('extractBill: extracted keys=', Object.keys(extractedData).join(', '));

  // YJK 单据后处理：税率计算与汇总
  if (billType === 'YJK') {
    extractedData = postProcessYjk(extractedData);
  }

  const result = {
    _meta: {
      bill_type: billType,
      bill_type_name: config.name,
      extracted_at: new Date().toISOString(),
    },
    ...extractedData,
  };

  debug('extractBill: result keys=', Object.keys(result).join(', '));
  return result;
}
