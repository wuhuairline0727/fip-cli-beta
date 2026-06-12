/**
 * 组织机构-项目-部门 三级数据轮询抓取脚本
 * 遍历所有组合并记录到 ~/.fip-orgs.json 缓存
 *
 * 使用方式：
 *   node scripts/build-org-cache.js [--max-orgs N] [--debug]
 *
 * 流程：
 *   1. 打开切换组织机构对话框
 *   2. 获取组织机构列表
 *   3. 对每个组织机构：
 *      a. 选择该组织机构
 *      b. 获取项目列表
 *      c. 对每个项目：
 *         i.  选择该项目
 *         ii. 获取部门列表
 *         iii. 记录 组织+项目+部门 完整组合
 */

const { ensureConnection } = require('../lib/browser');
const {
  openSwitchOrgDialog,
  closeSwitchOrgDialog,
  openPickerPopup,
  readPickerPopupItems,
  selectPickerItem,
  closePickerPopup,
  readDialogFields,
} = require('../lib/utils/organization');
const {
  addOrganizationRecord,
  getCacheStats,
} = require('../lib/utils/organization-cache');

// 解析命令行参数
const args = process.argv.slice(2);
const maxOrgs = parseInt(
  args.find((a) => a.startsWith('--max-orgs='))?.split('=')[1] || '0',
  10
);
const debugMode = args.includes('--debug');

/**
 * 延迟等待
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 记录日志
 * @param {...any} args
 */
function log(...args) {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.log(`[${now}]`, ...args);
}

/**
 * 记录错误
 * @param {...any} args
 */
function error(...args) {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.error(`[${now}] ERROR`, ...args);
}

/**
 * 主轮询流程
 */
async function buildOrgCache() {
  log('========================================');
  log('开始构建组织机构-项目-部门 三级缓存');
  log('========================================');

  // 检查浏览器连接
  try {
    await ensureConnection();
    log('浏览器连接正常');
  } catch {
    process.exit(1);
  }

  let totalRecords = 0;
  let orgCount = 0;
  let errorCount = 0;

  try {
    // 第1步：打开对话框
    log('\n第1步：打开切换组织机构对话框');
    const dialog = await openSwitchOrgDialog();
    log('对话框已打开，当前值:', JSON.stringify(dialog.fields));

    // 第2步：获取组织机构列表
    log('\n第2步：获取组织机构列表');
    await openPickerPopup(dialog.fields['组织机构'].id);
    const orgList = await readPickerPopupItems();
    log(`找到 ${orgList.itemCount} 个组织机构`);

    if (debugMode) {
      log('组织机构列表:', JSON.stringify(orgList.items, null, 2));
    }

    // 关闭组织机构选择弹窗
    await closePickerPopup();
    await sleep(500);

    // 确定要遍历的组织机构数量
    const orgsToProcess =
      maxOrgs > 0 ? orgList.items.slice(0, maxOrgs) : orgList.items;
    log(`将处理 ${orgsToProcess.length} 个组织机构`);

    // 第3步：遍历每个组织机构
    for (const org of orgsToProcess) {
      orgCount++;
      log(`\n----------------------------------------`);
      log(
        `[${orgCount}/${orgsToProcess.length}] 处理组织机构: ${org.name} (${org.code})`
      );

      try {
        // 选择组织机构
        await openPickerPopup(dialog.fields['组织机构'].id);
        await selectPickerItem(org.name);
        await sleep(1000);

        // 刷新对话框字段（选择组织后项目/部门会变化）
        const updatedDialog = await readDialogFields();
        if (debugMode) {
          log('选择组织后:', JSON.stringify(updatedDialog.fields));
        }

        // 获取项目列表
        let projectList;
        try {
          await openPickerPopup(updatedDialog.fields['项目名称'].id);
          projectList = await readPickerPopupItems();
          log(`  找到 ${projectList.itemCount} 个项目`);
          await closePickerPopup();
          await sleep(500);
        } catch (e) {
          log(`  该项目下无项目列表或获取失败: ${e.message}`);
          projectList = { items: [] };
        }

        // 遍历每个项目
        for (const project of projectList.items) {
          log(`  处理项目: ${project.name}`);

          try {
            // 选择项目
            await openPickerPopup(updatedDialog.fields['项目名称'].id);
            await selectPickerItem(project.name);
            await sleep(1000);

            // 刷新对话框字段
            const projectDialog = await readDialogFields();
            if (debugMode) {
              log('  选择项目后:', JSON.stringify(projectDialog.fields));
            }

            // 获取部门列表
            let deptList;
            try {
              await openPickerPopup(projectDialog.fields['部门名称'].id);
              deptList = await readPickerPopupItems();
              log(`    找到 ${deptList.itemCount} 个部门`);
              await closePickerPopup();
              await sleep(500);
            } catch (e) {
              log(`    该项目下无部门列表或获取失败: ${e.message}`);
              deptList = { items: [] };
            }

            // 记录每个部门组合
            if (deptList.items.length === 0) {
              // 没有部门，只记录组织+项目
              const record = {
                organization: org.name,
                orgCode: org.code,
                project: project.name,
                projectCode: project.code || '',
                department: projectDialog.fields['部门名称']?.value || '',
                deptCode: '',
                plateCode: projectDialog.fields['板块编号']?.value || '',
                plateName: projectDialog.fields['板块名称']?.value || '',
                profitCenter: projectDialog.fields['利润中心']?.value || '',
              };
              const isNew = addOrganizationRecord(record);
              totalRecords++;
              if (debugMode || isNew) {
                log(
                  `    记录: ${org.name} → ${project.name} → ${record.department || '(空)'} ${isNew ? '[新]' : '[已存在]'}`
                );
              }
            } else {
              for (const dept of deptList.items) {
                const record = {
                  organization: org.name,
                  orgCode: org.code,
                  project: project.name,
                  projectCode: project.code || '',
                  department: dept.name,
                  deptCode: dept.code || '',
                  plateCode: projectDialog.fields['板块编号']?.value || '',
                  plateName: projectDialog.fields['板块名称']?.value || '',
                  profitCenter: projectDialog.fields['利润中心']?.value || '',
                };
                const isNew = addOrganizationRecord(record);
                totalRecords++;
                if (debugMode || isNew) {
                  log(
                    `    记录: ${org.name} → ${project.name} → ${dept.name} ${isNew ? '[新]' : '[已存在]'}`
                  );
                }
              }
            }
          } catch (e) {
            error(`  处理项目 ${project.name} 失败:`, e.message);
            errorCount++;
            await closePickerPopup();
          }
        }
      } catch (e) {
        error(`处理组织机构 ${org.name} 失败:`, e.message);
        errorCount++;
        await closePickerPopup();
      }
    }

    // 关闭对话框
    log('\n========================================');
    log('关闭切换组织机构对话框');
    await closeSwitchOrgDialog('cancel');

    // 统计
    const stats = getCacheStats();
    log('\n========================================');
    log('轮询完成！');
    log('========================================');
    log(`处理组织机构: ${orgCount} 个`);
    log(`总记录数: ${totalRecords} 条`);
    log(`新增记录: 见缓存文件`);
    log(`错误次数: ${errorCount} 次`);
    log(`缓存文件: ~/.fip-orgs.json`);
    log(`唯一组织机构: ${stats.uniqueOrganizations.length} 个`);
    log(`缓存最后更新: ${stats.lastUpdated}`);
    log('========================================');
  } catch (e) {
    error('轮询过程发生错误:', e.message);
    error(e.stack);
    await closePickerPopup();
    await closeSwitchOrgDialog('cancel');
    process.exit(1);
  }
}

// 执行
buildOrgCache().catch((e) => {
  error('脚本执行失败:', e.message);
  process.exit(1);
});
