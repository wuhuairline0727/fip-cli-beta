/**
 * 通用单据提取引擎
 * 负责构建并执行浏览器端提取代码
 */

const { detectBillType, getBillConfig } = require('./config');
const { evaluate } = require('../browser');

/**
 * 解析金额字符串，返回数字或 null
 * @param {string} str - 金额字符串
 * @returns {number|null}
 */
function parseAmount(str) {
  if (typeof str !== 'string') {
    return null;
  }
  const cleaned = str
    .replace(/[¥￥,\s]/g, '')
    .trim();
  if (cleaned === '' || isNaN(cleaned)) {
    return null;
  }
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

/**
 * 将正则对象序列化为可在代码字符串中使用的字面量字符串
 * @param {RegExp} regex
 * @returns {string}
 */
function regexToString(regex) {
  return regex.toString();
}

/**
 * 构建在浏览器中执行的提取代码字符串
 * @param {Object} config
 * @param {string} config.name
 * @param {string} config.codePrefix
 * @param {Object} config.basePatterns - { key: RegExp }
 * @param {Object} config.inputFields - { key: { byLabel: string } | { byId: string } }
 * @param {Array} config.tables - [{ name, identifyBy: { headerText }, columns: [{ header, field, type? }] }]
 * @param {Array} config.auditHints
 * @returns {string}
 */
function buildExtractionCode(config) {
  const {
    basePatterns = {},
    inputFields = {},
    tables = [],
    auditHints = [],
  } = config;

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
      return `    ${key}: { byLabel: ${JSON.stringify(spec.byLabel)} }`;
    })
    .join(',\n');

  // 序列化 tables（支持数组或对象格式）
  const tablesList = Array.isArray(tables) ? tables : Object.values(tables);
  const tablesArray = tablesList.map((t) => {
    const cols = (t.columns || []).map((c) => {
      const typePart = c.type ? `, type: ${JSON.stringify(c.type)}` : '';
      return `{ header: ${JSON.stringify(c.label || c.header)}, field: ${JSON.stringify(c.key || c.field)}${typePart} }`;
    }).join(', ');
    return `{ name: ${JSON.stringify(t.name)}, identifyBy: { headerText: ${JSON.stringify(t.identifyBy?.headerText)} }, columns: [${cols}] }`;
  }).join(',\n    ');

  const code = `(function() {
  const result = {};
  const pageText = document.body.innerText || '';

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
    } else if (spec.byLabel) {
      const labels = Array.from(document.querySelectorAll('label'));
      const targetLabel = labels.find(l => {
        const text = (l.textContent || '').replace(/[：:]/g, '').trim();
        return text === spec.byLabel;
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
    const rows = Array.from(document.querySelectorAll('tr[class*="FD26IYC"]'));
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
        // 使用 x 坐标对齐提取单元格值
        const cellXs = cells.map(c => c.getBoundingClientRect().x);
        const rowData = {};
        let hasData = false;
        for (const [field, meta] of Object.entries(colIndexMap)) {
          // 找到 x 坐标最接近的单元格
          let bestIdx = -1;
          let bestDiff = Infinity;
          for (let ci = 0; ci < cellXs.length; ci++) {
            const diff = Math.abs(cellXs[ci] - meta.x);
            if (diff < bestDiff) {
              bestDiff = diff;
              bestIdx = ci;
            }
          }
          const cell = bestIdx !== -1 ? cells[bestIdx] : null;
          let cellValue = cell ? (cell.innerText || '').trim() : null;
          if (cellValue !== null && cellValue !== '') {
            hasData = true;
          }
          if (meta.type === 'amount' && cellValue) {
            const cleaned = cellValue.replace(/[\\u00a5\\uFFE5,\\s]/g, '').trim();
            const num = parseFloat(cleaned);
            cellValue = Number.isFinite(num) ? num : cellValue;
          }
          rowData[field] = cellValue;
        }
        // 过滤：如果一行中所有非金额字段都为空，则视为无效行（合计行/空行）
        const hasIdentifier = Object.entries(rowData).some(([field, value]) => {
          const meta = colIndexMap[field];
          return meta?.type !== 'amount' && value !== null && value !== '';
        });
        // 额外过滤：如果 _action 为 "合计："，或 name 为空且 _action 有值，视为合计行
        const isTotalRow = rowData._action === '合计：' || (rowData.name === '' && rowData._action);
        if (hasIdentifier && !isTotalRow) {
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

          // 如果列数与表头差异过大，说明是另一个表格，停止
          if (Math.abs(cells.length - headerCellCount) > 3) {
            break;
          }

          // 如果第一列是表头文本（如"发票类型"），说明是另一个表格，停止
          const firstCellText = (cells[0]?.innerText || '').trim();
          if (firstCellText && ['发票类型', '支付方式', '操作'].includes(firstCellText)) {
            break;
          }

          // 使用 x 坐标对齐提取单元格值
          const cellXs = cells.map(c => c.getBoundingClientRect().x);
          const rowData = {};
          let hasData = false;
          for (const [field, meta] of Object.entries(colIndexMap)) {
            // 找到 x 坐标最接近的单元格
            let bestIdx = -1;
            let bestDiff = Infinity;
            for (let ci = 0; ci < cellXs.length; ci++) {
              const diff = Math.abs(cellXs[ci] - meta.x);
              if (diff < bestDiff) {
                bestDiff = diff;
                bestIdx = ci;
              }
            }
            const cell = bestIdx !== -1 ? cells[bestIdx] : null;
            let cellValue = cell ? (cell.innerText || '').trim() : null;
            if (cellValue !== null && cellValue !== '') {
              hasData = true;
            }
            if (meta.type === 'amount' && cellValue) {
              const cleaned = cellValue.replace(/[\\u00a5\\uFFE5,\\s]/g, '').trim();
              const num = parseFloat(cleaned);
              cellValue = Number.isFinite(num) ? num : cellValue;
            }
            rowData[field] = cellValue;
          }
          // 过滤：如果一行中所有非金额字段都为空，则视为无效行（合计行/空行）
          const hasIdentifier = Object.entries(rowData).some(([field, value]) => {
            const meta = colIndexMap[field];
            return meta?.type !== 'amount' && value !== null && value !== '';
          });
          // 额外过滤：如果 _action 为 "合计："，或 name 为空且 _action 有值，视为合计行
          const isTotalRow = rowData._action === '合计：' || (rowData.name === '' && rowData._action);
          if (hasIdentifier && !isTotalRow) {
            dataRows.push(rowData);
          }
        }
      }
    }

    result[tableDef.name] = dataRows;
  }

  // === 4. 附件信息 ===
  const attachments = [];
  const linkSelectors = 'a[href*="."], a[download]';
  const links = Array.from(document.querySelectorAll(linkSelectors));
  for (const link of links) {
    const href = link.getAttribute('href') || '';
    const text = (link.innerText || link.textContent || '').trim();
    if (href && text) {
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
 * @param {string} billId - 单据编号
 * @param {string} [billType] - 单据类型（可选，自动识别）
 * @returns {Promise<Object>}
 */
async function extractBill(billId, billType) {
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

  const code = buildExtractionCode(config);
  const evalResult = await evaluate(code);
  const extractedData = evalResult.data?.value || {};

  return {
    _meta: {
      bill_type: billType,
      bill_type_name: config.name,
      extracted_at: new Date().toISOString(),
    },
    ...extractedData,
  };
}

module.exports = {
  parseAmount,
  buildExtractionCode,
  extractBill,
};
