const { evaluate } = require('../browser');

/**
 * 从 FIP 开票单详情页提取所有字段
 * 包含：基本信息、合同信息、开票信息、开票明细、销方信息、收票信息、附件列表
 * @returns {Promise<Object>} 提取的完整字段字典
 */
async function extractInvoiceFields() {
  const code = `
    (function() {
      const result = {};
      const pageText = document.body.innerText || '';

      // === 方法1: innerText 正则匹配（基础字段）===
      const textPatterns = {
        invoice_no: /申请单号[：:][\\s\\n]*(KP\\d{17,20})/,
        invoice_date: /提单日期[：:][\\s\\n]*(\\d{4}-\\d{2}-\\d{2})/,
        submitter: /提单人[：:][\\s\\n]*([^\\n\\r]+)/,
        voucher_attachments: /凭证附件张数[：:][\\s\\n]*(\\d+)/,
      };

      for (const [key, pattern] of Object.entries(textPatterns)) {
        const match = pageText.match(pattern);
        if (match) result[key] = match[1].trim();
      }

      // === 方法2: input 元素值提取（所有字段）===
      const inputMapping = {
        // 基本信息
        profit_center: 'SW_STO_KPSQDPRCTR1-input',
        project_name: 'SW_STO_KPSQDF_XMBH7-input',
        project_code: 'SW_STO_KPSQDF_XMBH7-input',
        note: 'SW_STO_KPSQDF_NOTE1-input',
        apply_unit: 'SW_STO_KPSQDF_LRDWMC1-input',
        billing_unit: 'SW_STO_KPSQDF_YWDWBH7-input',
        invoice_date_input: 'FormDateField1-input',
        invoice_end_date: 'FormDateField2-input',
        voucher_count: 'FormIntegerField1-input',

        // 项目属性
        is_external: 'SW_STO_KPSQDF_SFYDXM6-input',
        no_prepay_reason: 'SW_STO_KPSQDF_WYJYY1-input',
        is_own_tax_subject: 'SW_STO_KPSQDF_SFZYNSSD6-input',
        invoice_type: 'SW_STO_KPSQDF_KPHXLX6-input',
        billing_point: 'SW_STO_KPSQDF_KPDMC1-input',
        cross_city_flag: 'SW_STO_KPSQDF_KDSBS6-input',

        // 购买方信息
        buyer_name: 'SW_STO_KPSQDF_GFMC30-input',
        buyer_tax_no: 'SW_STO_KPSQDF_GFSH1-input',
        buyer_address: 'SW_STO_KPSQDF_GFDZ1-input',
        buyer_phone: 'SW_STO_KPSQDF_GFDH1-input',
        buyer_bank: 'SW_STO_KPSQDF_GFYH1-input',
        buyer_account: 'SW_STO_KPSQDF_GFZH1-input',
        buyer_nature: 'undefined-input',
        contract_customer_name: 'SW_STO_KPSQDF_HTKSMC30-input',

        // 计税与发票信息
        tax_method: 'HelpComboBox1-input',
        buyer_tax_type: 'HelpComboBox6-input',
        invoice_category: 'FormComboBox5-input',
        invoice_form: 'FormComboBox6-input',
        show_buyer_bank: 'SW_STO_KPSQDF_KDSBS6-input',
        land_tax_project_no: 'FormTextInput3-input',

        // 交付信息
        delivery_phone: 'SW_STO_KPSQDF_DZFPTEL1-input',
        delivery_email: 'SW_STO_KPSQDF_DZFPMAIL1-input',
        delivery_method: 'SW_STO_KPSQDF_FPCDFS6-input',

        // 开票备注
        unified_remark: 'SW_STO_KPSQDF_NOTE1-input',
        invoice_remark_input: 'SW_STO_KPSQDF_KPBZ8-input',

        // 销售方信息
        seller_name: 'FormTextInput5-input',
        seller_tax_no: 'FormTextInput6-input',
        seller_address_phone: 'FormTextInput7-input',
        seller_bank_account: 'DataSetFieldComboBox3-input',

        // 收票人信息
        payee: 'FormTextInput9-input',
        reviewer: 'FormTextInput10-input',
        drawer: 'FormTextInput8-input',

        // 收票信息
        recipient_name: 'SW_STO_KPSQDF_SJRXM1-input',
        recipient_phone: 'SW_STO_KPSQDF_LXDH1-input',
        recipient_address: 'SW_STO_KPSQDF_YJDZ1-input',
        recipient_postcode: 'SW_STO_KPSQDF_YB1-input',

        // 其他
        is_tax_bureau_issue: 'SW_STO_KPSQDF_SFZYNSSD6-input',
        show_seller_bank: 'SW_STO_KPSQDF_KDSBS6-input',
        show_reviewer: 'FormComboBox7-input',
        calculation_method: 'FormComboBox8-input',
      };

      for (const [key, inputId] of Object.entries(inputMapping)) {
        const input = document.getElementById(inputId);
        if (input && input.value !== undefined && input.value !== null) {
          result[key] = input.value.trim();
        }
      }

      // === 方法3: 表格数据提取（金额信息）===
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

        // 合同信息表
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

        // 开票明细表
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
        const match = text.match(/[^\\/\\n]+\\.(pdf|png|jpg|jpeg|doc|docx|xls|xlsx|zip|rar)/i);
        if (match && !seen.has(match[0])) {
          seen.add(match[0]);
          attachments.push({
            name: match[0],
            url: el.href || '',
            size: text.includes('KB') || text.includes('MB') ? text.match(/[\\d\\.]+\\s*[KM]B/) : ''
          });
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

      // === 方法8: 提取流程状态 ===
      const statusMatch = pageText.match(/流程(结束|进行中|待审批)/);
      if (statusMatch) result.flow_status = statusMatch[0];

      // === 方法9: 提取系统警告 ===
      const warningMatch = pageText.match(/当前单据所选合同中[\s\S]*?！/);
      if (warningMatch) result.system_warning = warningMatch[0].replace(/\\s+/g, ' ');

      // === 方法10: 提取所有 label 文本（用于发现遗漏字段）===
      const labels = document.querySelectorAll('label');
      const labelTexts = [];
      for (const label of labels) {
        const text = label.textContent.trim();
        if (text && text.length > 0 && !text.includes('首页') && !text.includes('系统') && !text.includes('菜单')) {
          labelTexts.push(text);
        }
      }
      result._all_labels = [...new Set(labelTexts)];

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
