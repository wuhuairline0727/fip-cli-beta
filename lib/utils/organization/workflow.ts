/**
 * 高阶业务流程模块
 * 职责：完整的切换流程、自动选择、获取当前信息
 */

import { evaluate } from '../../browser';
import { debug } from '../../logger';
import {
  addOrganizationRecord,
  findOrganization,
  getCacheStats,
  type OrganizationRecord,
} from '../organization-cache';
import { clickSystemConfirm } from './system';
import { openSwitchOrgDialog, closeSwitchOrgDialog } from './dialog';
import {
  queryAndSelectInPopup,
  selectFirstDepartment,
  clickRefreshButton,
} from './popup';
import type {
  DialogValue,
  SwitchOrganizationOptions,
  SwitchOrganizationResult,
  AutoSelectResult,
  HeaderResult,
} from './types';

/**
 * 获取当前组织机构信息
 */
export async function getCurrentOrganization(): Promise<{
  organization: string;
  fromDialog?: boolean;
}> {
  debug('getCurrentOrganization');

  const fromHeader = await evaluate(`
    (function() {
      var orgEls = document.querySelectorAll('[class*="org"], [class*="company"], [class*="dept"]');
      for (var i = 0; i < orgEls.length; i++) {
        var text = (orgEls[i].textContent || '').trim();
        if (text && text.length > 5 && text.length < 100) {
          return { found: true, source: 'header', organization: text };
        }
      }
      return { found: false };
    })()
  `);

  const headerValue = (fromHeader as HeaderResult).data?.value;
  if (headerValue?.found) {
    return { organization: headerValue.organization || '' };
  }

  let dialog: DialogValue;
  try {
    dialog = await openSwitchOrgDialog();
  } catch (e) {
    throw new Error('无法获取当前组织机构信息：' + (e as Error).message, {
      cause: e,
    });
  }
  if (dialog.ok && dialog.fields && dialog.fields['组织机构']) {
    const org = dialog.fields['组织机构'].value;
    await closeSwitchOrgDialog('cancel');
    return { organization: org, fromDialog: true };
  }

  throw new Error('无法获取当前组织机构信息');
}

/**
 * 切换组织机构（完整流程）
 * @param options - 配置选项
 * @param options.organization - 目标组织机构名称
 * @param options.project - 目标项目名称
 * @param options.department - 目标部门名称
 * @param options.fromCache - 是否仅从缓存查找
 * @param options.autoSelect - 是否尝试自动选择（需要 CDP）
 */
export async function switchOrganization(
  options: SwitchOrganizationOptions = {}
): Promise<SwitchOrganizationResult> {
  debug('switchOrganization: options=', JSON.stringify(options));

  if (options.fromCache) {
    const matches = findOrganization({
      organization: options.organization,
      project: options.project,
      department: options.department,
    });
    return {
      success: true,
      mode: 'cache_query',
      matches: matches,
      matchCount: matches.length,
    };
  }

  // 打开对话框
  const dialog = await openSwitchOrgDialog();
  if (!dialog.ok) {
    throw new Error(dialog.error || '打开切换组织机构对话框失败');
  }

  try {
    // 读取当前信息
    const currentInfo: OrganizationRecord = {
      organization: dialog.fields?.['组织机构']?.value || '',
      project: dialog.fields?.['项目名称']?.value || '',
      department: dialog.fields?.['部门名称']?.value || '',
      plateCode: dialog.fields?.['板块编号']?.value,
      plateName: dialog.fields?.['板块名称']?.value,
      profitCenter: dialog.fields?.['利润中心']?.value,
    };

    // 自动记录到缓存
    const isNewRecord = addOrganizationRecord(currentInfo);
    debug('switchOrganization: cache record added, isNew=', isNewRecord);

    // 如果提供了目标值且启用了自动选择，尝试使用 CDP 选择
    let selectionResult:
      | AutoSelectResult
      | { error: string; partial: AutoSelectResult }
      | null = null;
    if (options.autoSelect) {
      selectionResult = await tryAutoSelect(dialog.fields || {}, options);

      // 自动选择完成后，点击对话框"确定"完成切换
      if (selectionResult && !('error' in selectionResult)) {
        await closeSwitchOrgDialog('confirm');

        // 点击系统提示"切换成功"的确定按钮
        await clickSystemConfirm();
      } else {
        await closeSwitchOrgDialog('cancel');
      }
    } else {
      // 查询模式，点击"取消"
      await closeSwitchOrgDialog('cancel');
    }

    const cacheStats = getCacheStats();

    return {
      success: true,
      mode: selectionResult ? 'auto_select' : 'query',
      current: currentInfo,
      selection: selectionResult,
      cache: {
        isNewRecord: isNewRecord,
        totalRecords: cacheStats.totalRecords,
        uniqueOrganizations: cacheStats.uniqueOrganizations,
      },
    };
  } catch (e) {
    // 出错时取消对话框和弹窗
    await closeSwitchOrgDialog('cancel');
    throw e;
  }
}

/**
 * 尝试自动选择组织机构/项目/部门
 * @param fields - 当前对话框字段
 * @param options - 目标值
 */
export async function tryAutoSelect(
  fields:
    | Record<string, { id: string; value: string; placeholder: string }>
    | undefined,
  options: SwitchOrganizationOptions
): Promise<AutoSelectResult | { error: string; partial: AutoSelectResult }> {
  debug('tryAutoSelect');

  const result: AutoSelectResult = {
    organization: null,
    project: null,
    department: null,
  };

  try {
    // 1. 选择组织机构
    if (options.organization) {
      await queryAndSelectInPopup(
        '组织机构',
        options.organization,
        'DataSetFieldComboBox1-input'
      );
      result.organization = { selected: true, name: options.organization };
    }

    // 2. 选择项目
    if (options.project) {
      await queryAndSelectInPopup(
        '项目名称',
        options.project,
        'DataSetFieldComboBox3-input'
      );
      result.project = { selected: true, name: options.project };
    }

    // 3. 点击刷新按钮（刷新部门列表）
    await clickRefreshButton();

    // 4. 选择部门（必填字段）
    if (options.department) {
      await queryAndSelectInPopup(
        '部门名称',
        options.department,
        'DataSetFieldComboBox2-input'
      );
      result.department = { selected: true, name: options.department };
    } else {
      // 如果没有指定部门，尝试选择第一个可用部门
      debug(
        'tryAutoSelect: no department specified, attempting to select first available'
      );
      try {
        const firstDept = await selectFirstDepartment();
        if (firstDept) {
          result.department = { selected: true, name: firstDept };
        }
      } catch (e) {
        debug(
          'tryAutoSelect: failed to auto-select department:',
          (e as Error).message
        );
      }
    }

    return result;
  } catch (e) {
    debug('tryAutoSelect failed:', (e as Error).message);
    return { error: (e as Error).message, partial: result };
  }
}
