const { evaluate } = require('../browser');

/**
 * 从 FIP 开票单详情页提取字段
 * 结合 innerText 正则匹配和 input 元素值提取
 * @returns {Promise<Object>} 提取的字段字典
 */
async function extractInvoiceFields() {
  const code = `
    (function() {
      const result = {};
      const pageText = document.body.innerText || '';

      // === 方法1: innerText 正则匹配（基础字段）===
      // 注意：innerText 中标签和值之间可能有换行符
      const textPatterns = {
        invoice_no: /申请单号[：:][\\s\\n]*(KP\\d{17,20})/,
        invoice_date: /提单日期[：:][\\s\\n]*(\\d{4}-\\d{2}-\\d{2})/,
        submitter: /提单人[：:][\\s\\n]*([^\\n\\r]+)/,
      };

      for (const [key, pattern] of Object.entries(textPatterns)) {
        const match = pageText.match(pattern);
        if (match) result[key] = match[1].trim();
      }

      // === 方法2: input 元素值提取（核心字段）===
      const inputMapping = {
        // 利润中心
        profit_center: 'SW_STO_KPSQDPRCTR1-input',
        // 项目名称
        project_name: 'SW_STO_KPSQDF_XMBH7-input',
        // 申请事由/备注
        note: 'SW_STO_KPSQDF_NOTE1-input',
        // 购买方名称
        buyer_name: 'SW_STO_KPSQDF_GFMC30-input',
        // 纳税人识别号
        buyer_tax_no: 'SW_STO_KPSQDF_GFSH1-input',
        // 购买方地址
        buyer_address: 'SW_STO_KPSQDF_GFDZ1-input',
        // 购买方电话
        buyer_phone: 'SW_STO_KPSQDF_GFDH1-input',
        // 购买方开户行
        buyer_bank: 'SW_STO_KPSQDF_GFYH1-input',
        // 购买方账号
        buyer_account: 'SW_STO_KPSQDF_GFZH1-input',
        // 开票单位
        billing_unit: 'SW_STO_KPSQDF_YWDWBH7-input',
        // 申请单位
        apply_unit: 'SW_STO_KPSQDF_LRDWMC1-input',
        // 提单日期
        invoice_date_input: 'FormDateField1-input',
        // 是否异地项目
        is_external: 'SW_STO_KPSQDF_SFYDXM6-input',
        // 未预缴原因
        no_prepay_reason: 'SW_STO_KPSQDF_WYJYY1-input',
        // 计税方式
        tax_method: 'HelpComboBox1-input',
        // 客户纳税人类型
        buyer_tax_type: 'HelpComboBox6-input',
        // 发票种类/开票类型
        invoice_type: 'FormComboBox5-input',
        // 开票点名称
        billing_point: 'SW_STO_KPSQDF_KPDMC1-input',
        // 交付邮箱
        delivery_email: 'SW_STO_KPSQDF_DZFPMAIL1-input',
        // 交付电话
        delivery_phone: 'SW_STO_KPSQDF_DZFPTEL1-input',
        // 统一备注
        unified_remark: 'SW_STO_KPSQDF_NOTE1-input',
      };

      for (const [key, inputId] of Object.entries(inputMapping)) {
        const input = document.getElementById(inputId);
        if (input && input.value) {
          result[key] = input.value.trim();
        }
      }

      // === 方法3: 表格数据提取（金额信息）===
      // GWT 表格行通常有 FD26IYC 前缀的 class
      const allRows = document.querySelectorAll('tr[class*="FD26IYC"]');
      const visibleRows = [];
      for (const row of allRows) {
        const rect = row.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && rect.top > 200) {
          visibleRows.push(row);
        }
      }

      for (const row of visibleRows) {
        const cells = row.querySelectorAll('td');
        if (cells.length < 5) continue;

        const firstCell = cells[0].textContent.trim();
        const secondCell = cells[2] ? cells[2].textContent.trim() : '';

        // 合同信息表（第3列是"合同编号"或包含合同编号格式）
        if (secondCell && secondCell.startsWith('中建一局')) {
          result.contract_no = cells[2].textContent.trim();
          result.contract_name = cells[3].textContent.trim();
          result.contract_amount = cells[4].textContent.trim();
          result.contract_entry_amount = cells[5].textContent.trim();
          result.invoiced_amount = cells[6].textContent.trim();
          result.unpaid_amount = cells[7].textContent.trim();
          result.remaining_amount = cells[8].textContent.trim();
          result.current_amount = cells[9].textContent.trim();
          result.received_amount = cells[10].textContent.trim();
          result.settled_amount = cells[11].textContent.trim();
          result.settled_uninvoiced = cells[12].textContent.trim();
          result.contract_date = cells[13].textContent.trim();
          result.counterparty = cells[14].textContent.trim();
          result.contract_entry_no = cells[15].textContent.trim();
          result.prepay_balance = cells[16].textContent.trim();
          result.unreceived_amount = cells[17].textContent.trim();
        }

        // 开票明细表（第3列是"发票分组"或数字）
        if (firstCell === '1' && cells.length >= 15 && cells[4].textContent.trim().includes('市')) {
          result.invoice_group = cells[2].textContent.trim();
          result.project_name_detail = cells[3].textContent.trim();
          result.service_location = cells[4].textContent.trim();
          result.service_location_detail = cells[5].textContent.trim();
          result.building_project_name = cells[6].textContent.trim();
          result.tax_rate = cells[7].textContent.trim();
          result.total_amount = cells[8].textContent.trim();
          result.amount_without_tax = cells[9].textContent.trim();
          result.tax_amount = cells[10].textContent.trim();
          result.tax_classification_code = cells[11].textContent.trim();
          result.tax_classification_name = cells[12].textContent.trim();
          result.special_element = cells[13].textContent.trim();
          result.tax_preference = cells[14].textContent.trim();
          result.preference_type = cells[15].textContent.trim();
          result.invoice_remark = cells[16] ? cells[16].textContent.trim() : '';
        }
      }

      // === 方法4: 提取附件列表 ===
      const attachments = [];
      const allElements = document.querySelectorAll('*');
      const seen = new Set();
      for (const el of allElements) {
        const text = el.textContent || '';
        const match = text.match(/[^\\/\\n]+\\.(pdf|png|jpg|jpeg|doc|docx)/i);
        if (match && !seen.has(match[0])) {
          seen.add(match[0]);
          attachments.push(match[0]);
        }
      }
      result.attachments = attachments;

      // === 方法5: 标记是否异地项目 ===
      result.is_external_project = result.is_external === '是' ||
                                    pageText.includes('跨区域涉税事项报告') ||
                                    pageText.includes('外经证');

      // === 方法6: 提取外经证信息（如有）===
      if (result.is_external_project) {
        const extMatch = pageText.match(/跨区域涉税事项报告管理编号[：:]\\s*(.+?)(?:\\n|\\r|  +|$)/);
        if (extMatch) result.external_cert_no = extMatch[1].trim();
        const validMatch = pageText.match(/报告有效期[：:]\\s*(.+?)(?:\\n|\\r|  +|$)/);
        if (validMatch) result.external_cert_valid = validMatch[1].trim();
      }

      // === 方法7: 提取审批人信息 ===
      const approverMatch = pageText.match(/税务主管[：:]\\s*([^\\n\\r]+)/);
      if (approverMatch) result.tax_approver = approverMatch[1].trim();

      // 原始文本长度（用于调试）
      result._raw_text_length = pageText.length;

      return result;
    })()
  `;

  const result = await evaluate(code);
  return result.data?.value || {};
}

/**
 * 从 input 元素提取字段（备用方法）
 */
async function extractFromInputs() {
  const code = `
    (function() {
      const result = {};
      const inputs = document.querySelectorAll('input[type="text"], input:not([type])');
      for (const input of inputs) {
        if (input.value && input.value.trim()) {
          let label = '';
          if (input.id) {
            const lbl = document.querySelector('label[for="' + input.id + '"]');
            if (lbl) label = lbl.textContent.trim();
          }
          if (!label && input.parentElement) {
            const prev = input.parentElement.querySelector('label, .ant-form-item-label');
            if (prev) label = prev.textContent.trim();
          }
          result[label || input.id || 'unnamed'] = input.value;
        }
      }
      return result;
    })()
  `;
  const result = await evaluate(code);
  return result.data?.value || {};
}

module.exports = { extractInvoiceFields, extractFromInputs };
