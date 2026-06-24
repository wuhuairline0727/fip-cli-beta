import { evaluate } from '../browser';

/**
 * 从 FIP 开票单详情页提取所有字段
 * 包含：基本信息、合同信息、开票信息、开票明细、销方信息、收票信息、附件列表
 * @returns 提取的完整字段字典
 */
export async function extractInvoiceFields(): Promise<Record<string, unknown>> {
  // 注意：此代码字符串会被嵌入模板字符串，所有反斜杠需要双重转义
  // 例如要写 \\\\d 才能在浏览器中得到 \\d（有效的正则转义）
  const code = `
    (function() {
      const result = {};
      const pageText = document.body.innerText || '';

      // === 方法1: innerText 正则匹配（基础字段）===
      const textPatterns = {
        invoice_no: /申请单号[：:][\\s\\n]*(KP[0-9]{17,20})/,
        invoice_date: /提单日期[：:][\\s\\n]*([0-9]{4}-[0-9]{2}-[0-9]{2})/,
        submitter: /提单人[：:][\\s\\n]*([^\\n\\r]+)/,
        voucher_attachments: /凭证附件张数[：:][\\s\\n]*([0-9]+)/,
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
        note: 'SW_STO_KPSQDF_NOTE1-input',
        apply_unit: 'SW_STO_KPSQDF_LRDWMC1-input',
        billing_unit: 'SW_STO_KPSQDF_YWDWBH7-input',
        invoice_date: 'FormDateField1-input',
        invoice_date_input: 'FormDateField1-input',
        invoice_end_date: 'FormDateField2-input',
        voucher_attachments: 'FormIntegerField1-input',
        voucher_count: 'FormIntegerField1-input',

        // 项目属性
        is_external: 'SW_STO_KPSQDF_SFYDXM6-input',
        no_prepay_reason: 'SW_STO_KPSQDF_WYJYY1-input',
        is_own_tax_subject: 'SW_STO_KPSQDF_SFZYNSSD6-input',
        invoice_type: 'SW_STO_KPSQDF_KPHXLX6-input',
        billing_point: 'SW_STO_KPSQDF_KPDMC1-input',
        cross_city_flag: 'SW_STO_KPSQDF_KDSBS6-input',
        external_cert_no_input: 'SW_STO_KPSQDF_KQBGBH30-input',
        is_tax_bureau_issue: 'SW_STO_KPSQDF_SFZYNSSD6-input',
        show_seller_bank: 'SW_STO_KPSQDF_KDSBS6-input',

        // 购买方信息
        buyer_name: 'SW_STO_KPSQDF_GFMC30-input',
        buyer_tax_no: 'SW_STO_KPSQDF_GFSH1-input',
        buyer_address: 'SW_STO_KPSQDF_GFDZ1-input',
        buyer_phone: 'SW_STO_KPSQDF_GFDH1-input',
        buyer_bank: 'SW_STO_KPSQDF_GFYH1-input',
        buyer_account: 'SW_STO_KPSQDF_GFZH1-input',
        // buyer_nature 单独处理（见下方）
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
        // unified_remark: 页面上无独立input，为空
        invoice_remark_input: 'SW_STO_KPSQDF_KPBZ8-input',

        // 销售方信息
        seller_name: 'FormTextInput5-input',
        seller_tax_no: 'FormTextInput6-input',
        seller_tax_type: 'HelpComboBox6-input',
        seller_address_phone: 'FormTextInput7-input',
        seller_bank_account: 'DataSetFieldComboBox3-input',

        // 收票人信息
        payee: 'FormTextInput9-input',
        reviewer: 'FormTextInput10-input',

        // 收票信息
        recipient_name: 'SW_STO_KPSQDF_SJRXM1-input',
        recipient_phone: 'SW_STO_KPSQDF_LXDH1-input',
        recipient_address: 'SW_STO_KPSQDF_YJDZ1-input',
        recipient_postcode: 'SW_STO_KPSQDF_YB1-input',

        // 其他
        show_reviewer: 'FormComboBox7-input',
        calculation_method: 'FormComboBox8-input',
      };

      for (const [key, inputId] of Object.entries(inputMapping)) {
        let input = document.getElementById(inputId);
        if (input) {
          const allInputs = document.querySelectorAll('#' + inputId);
          for (const inp of allInputs) {
            if (inp.offsetParent !== null) {
              input = inp;
              break;
            }
          }
        }
        if (input && input.value !== undefined && input.value !== null) {
          result[key] = input.value.trim();
        }
      }

      // 专门处理 buyer_nature（购买方性质）：通过label查找相邻input
      const buyerNatureLabel = Array.from(document.querySelectorAll('label')).find(
        lbl => lbl.textContent.trim() === '购买方性质：'
      );
      if (buyerNatureLabel) {
        let parent = buyerNatureLabel.parentElement;
        for (let i = 0; i < 5; i++) {
          if (!parent) break;
          const inputs = parent.querySelectorAll('input[type="text"]');
          for (const inp of inputs) {
            if (inp.value && inp.value.trim()) {
              result.buyer_nature = inp.value.trim();
              break;
            }
          }
          if (result.buyer_nature) break;
          parent = parent.parentElement;
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

      function parseAmount(str) {
        if (!str) return null;
        const cleaned = str.replace(/,/g, '').replace(/[\s￥¥]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? str : num;
      }

      let contractTableFound = false;
      let contractColMap = {};
      let invoiceDetails = [];
      let prepayInfo = [];

      for (const row of visibleRows) {
        const cells = row.querySelectorAll('td');
        if (cells.length < 5) continue;

        const cellTexts = Array.from(cells).map(c => c.textContent.trim());
        const firstCell = cellTexts[0];

        // 合同信息表：通过任意单元格包含"合同编号"来识别表头
        if (!contractTableFound && cellTexts.some(t => t === '合同编号')) {
          contractTableFound = true;
          cellTexts.forEach((text, idx) => {
            if (text) contractColMap[text] = idx;
          });
          continue;
        }

        // 合同信息数据行
        if (contractTableFound && (
          cellTexts.some(t => t.startsWith('某建筑')) ||
          cellTexts.some(t => t.match(/^某建筑[0-9]+$/))
        )) {
          const get = (header) => cellTexts[contractColMap[header]] || null;
          result.contract_no = get('合同编号');
          result.contract_name = get('合同名称');
          result.contract_amount = parseAmount(get('合同总金额'));
          result.contract_entry_amount = parseAmount(get('合同分录金额'));
          result.invoiced_amount = parseAmount(get('已开票总金额'));
          result.unpaid_amount = parseAmount(get('已申请未开票金额'));
          result.remaining_amount = parseAmount(get('剩余可开发票金额'));
          result.current_amount = parseAmount(get('*本次开票金额'));
          result.received_amount = parseAmount(get('已收款总金额'));
          result.settled_amount = parseAmount(get('已结算总金额'));
          result.settled_uninvoiced = parseAmount(get('已结算未开票金额'));
          result.contract_date = get('合同签订日期');
          result.counterparty = get('往来单位');
          result.contract_entry_no = get('合同分录编号');
          result.prepay_balance = parseAmount(get('预收余额'));
          result.unreceived_amount = parseAmount(get('已开票未收款金额'));
          continue;
        }

        // 预缴信息表识别：表头含"引用预缴单号"
        if (cellTexts.some(t => t === '引用预缴单号')) {
          continue;
        }

        // 预缴信息数据行：通过引用预缴单号格式识别（WSYJ开头）
        if (cellTexts.some(t => t.match(/^WSYJ[0-9]+$/))) {
          const prepayRow = {};
          cellTexts.forEach((text, idx) => {
            if (text.match(/^WSYJ[0-9]+$/)) prepayRow['引用预缴单号'] = text;
            if (text.match(/^[0-9,]+\.[0-9]{2}$/)) {
              if (!prepayRow['预缴申请金额']) prepayRow['预缴申请金额'] = parseAmount(text);
              else if (!prepayRow['已开票金额']) prepayRow['已开票金额'] = parseAmount(text);
              else if (!prepayRow['已申请未开票金额']) prepayRow['已申请未开票金额'] = parseAmount(text);
              else if (!prepayRow['剩余可开发票金额']) prepayRow['剩余可开发票金额'] = parseAmount(text);
            }
            if (text.match(/^[0-9]{8}$/)) prepayRow['报告有效期'] = text;
            if (text.match(/京丰|税跨报/)) prepayRow['跨区域涉税事项报告'] = text;
          });
          if (Object.keys(prepayRow).length > 0) prepayInfo.push(prepayRow);
          continue;
        }

        // 开票明细表
        const isRowNumber = /^[0-9]+$/.test(firstCell);
        const hasTaxRate = cells[7] && cells[7].textContent.trim().match(/^[0-9]+(\.[0-9]+)?%?$/);
        const hasAmount = cells[8] && cells[8].textContent.trim().match(/[0-9,.]+/);

        if (isRowNumber && hasTaxRate && hasAmount && cells.length >= 12) {
          invoiceDetails.push({
            row_no: parseInt(firstCell, 10),
            invoice_group: cells[2]?.textContent?.trim(),
            project_name_detail: cells[3]?.textContent?.trim(),
            service_location: cells[4]?.textContent?.trim(),
            service_location_detail: cells[5]?.textContent?.trim(),
            building_project_name: cells[6]?.textContent?.trim(),
            tax_rate: cells[7]?.textContent?.trim(),
            total_amount: parseAmount(cells[8]?.textContent),
            amount_without_tax: parseAmount(cells[9]?.textContent),
            tax_amount: parseAmount(cells[10]?.textContent),
            tax_classification_code: cells[11]?.textContent?.trim(),
            tax_classification_name: cells[12]?.textContent?.trim(),
            special_element: cells[13]?.textContent?.trim(),
            tax_preference: cells[14]?.textContent?.trim(),
            preference_type: cells[15]?.textContent?.trim(),
            invoice_remark: cells[16]?.textContent?.trim() || ''
          });
        }
      }

      if (prepayInfo.length > 0) {
        result.prepay_info = prepayInfo;
        // 同步报告有效期到 external_cert_valid
        const firstPrepay = prepayInfo[0];
        if (firstPrepay['报告有效期'] && !result.external_cert_valid) {
          result.external_cert_valid = firstPrepay['报告有效期'];
        }
      }

      if (invoiceDetails.length > 0) {
        result.invoice_details = invoiceDetails;
        const firstDetail = invoiceDetails[0];
        result.invoice_group = firstDetail.invoice_group;
        result.project_name_detail = firstDetail.project_name_detail;
        result.service_location = firstDetail.service_location;
        result.service_location_detail = firstDetail.service_location_detail;
        result.building_project_name = firstDetail.building_project_name;
        result.tax_rate = firstDetail.tax_rate;
        result.total_amount = firstDetail.total_amount;
        result.amount_without_tax = firstDetail.amount_without_tax;
        result.tax_amount = firstDetail.tax_amount;
        result.tax_classification_code = firstDetail.tax_classification_code;
        result.tax_classification_name = firstDetail.tax_classification_name;
        result.special_element = firstDetail.special_element;
        result.tax_preference = firstDetail.tax_preference;
        result.preference_type = firstDetail.preference_type;
        result.invoice_remark = firstDetail.invoice_remark;
      }

      // === 方法4: 提取附件列表 ===
      const attachments = [];
      const seen = new Set();

      let attachmentSummary = null;
      const allEls = document.querySelectorAll('*');
      for (let i = allEls.length - 1; i >= 0; i--) {
        const text = allEls[i].textContent || '';
        if (text.indexOf('说明附件') >= 0 && text.indexOf('流程打印下载') >= 0 && text.length < 50) {
          attachmentSummary = allEls[i];
          break;
        }
      }
      if (attachmentSummary) {
        const t = attachmentSummary.textContent.trim();
        const idx = t.indexOf('附件');
        if (idx >= 0) {
          const match = t.substring(idx + 2).match(/[0-9]+/);
          if (match) {
            const num = parseInt(match[0], 10);
            if (!isNaN(num)) {
              result.attachment_count_from_ui = num;
            }
          }
        }
      }

      const linkElements = document.querySelectorAll('a[href*="."], a[download]');
      for (const el of linkElements) {
        const text = el.textContent || '';
        const href = el.getAttribute('href') || '';
        const match = href.match(/[^\\s\\/\\n\\t\\r\\\\]+\.(pdf|png|jpg|jpeg|doc|docx|xls|xlsx|zip|rar)/i) ||
                      text.match(/[^\\s\\/\\n\\t\\r\\\\]+\.(pdf|png|jpg|jpeg|doc|docx|xls|xlsx|zip|rar)/i);
        if (match && !seen.has(match[0])) {
          seen.add(match[0]);
          attachments.push({
            name: match[0],
            url: href,
            size: text.match(/[\\d\\.]+\\s*[KM]B/i)?.[0] || ''
          });
        }
      }

      if (attachments.length === 0) {
        const allElements = document.querySelectorAll('span, div, td, a');
        for (const el of allElements) {
          const text = el.textContent || '';
          if (text.length > 150 || text.length < 4) continue;
          const match = text.match(/(?:^|[\\s\"'（\\[(])((?:[a-zA-Z0-9_\\-\\u4e00-\\u9fa5+]+[_\\-])*[a-zA-Z0-9_\\-\\u4e00-\\u9fa5+]+\.(?:pdf|png|jpg|jpeg|doc|docx|xls|xlsx|zip|rar))(?=$|[\\s\"'）\\],])/i);
          if (match && !seen.has(match[1])) {
            seen.add(match[1]);
            attachments.push({
              name: match[1],
              url: el.closest('a')?.getAttribute('href') || '',
              size: text.match(/[\\d\\.]+\\s*[KM]B/i)?.[0] || ''
            });
          }
        }
      }

      if (attachments.length === 0 && result.attachment_count_from_ui > 0) {
        const looseMatches = pageText.match(/[a-zA-Z0-9_\\-\\u4e00-\\u9fa5+]+\.(?:pdf|png|jpg|jpeg|doc|docx|xls|xlsx|zip|rar)/gi);
        if (looseMatches) {
          for (const name of looseMatches) {
            if (!seen.has(name)) {
              seen.add(name);
              attachments.push({ name, url: '', size: '' });
            }
          }
        }
      }

      result.attachments = attachments;

      // === 方法5: 标记是否异地项目 ===
      result.is_external_project = result.is_external === '是';

      // === 方法6: 提取外经证信息（如有）===
      if (result.is_external_project) {
        if (result.external_cert_no_input) {
          result.external_cert_no = result.external_cert_no_input;
          delete result.external_cert_no_input;
        } else {
          const extMatch = pageText.match(/跨区域涉税事项报告管理编号[：:]\\s*([A-Za-z0-9\\-]+)/);
          if (extMatch) result.external_cert_no = extMatch[1].trim();
        }
        const validMatch = pageText.match(/报告有效期[：:]\\s*([0-9]{4}-[0-9]{2}-[0-9]{2}\\s*至\\s*[0-9]{4}-[0-9]{2}-[0-9]{2})/);
        if (validMatch) result.external_cert_valid = validMatch[1].trim();
      }

      // === 方法7: 提取审批人信息 ===
      const approverMatch = pageText.match(/税务主管[：:]\\s*([^\\n\\r]+)/);
      if (approverMatch) result.tax_approver = approverMatch[1].trim();

      // === 方法8: 提取流程状态 ===
      const statusMatch = pageText.match(/流程(结束|进行中|待审批)/);
      if (statusMatch) result.flow_status = statusMatch[0];

      // === 方法9: 提取系统警告 ===
      const warningMatch = pageText.match(/当前单据所选合同中[\\s\\S]*？！/);
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

      result._raw_text_length = pageText.length;

      return result;
    })()
  `;

  const result = await evaluate(code);
  return (
    (result.data as { value?: Record<string, unknown> } | undefined)?.value ||
    {}
  );
}

export async function extractFromInputs(): Promise<Record<string, unknown>> {
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
  return (
    (result.data as { value?: Record<string, unknown> } | undefined)?.value ||
    {}
  );
}
