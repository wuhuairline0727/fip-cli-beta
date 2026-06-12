import chai from 'chai';
import {
  openSwitchOrgDialog,
  closeSwitchOrgDialog,
  switchOrganization,
  queryAndSelectInPopup,
  readDialogFields,
} from '../../lib/utils/organization';
import { navigate } from '../../lib/browser';

chai.should();

describe('organization auto-select integration', function () {
  this.timeout(120000);

  beforeEach(async function () {
    // 确保在首页
    await navigate('https://fip.cscec.com/OSPPortal/CSCPortal.jsp#/dashboard');
    await new Promise((r) => setTimeout(r, 2000));
  });

  it('should auto-select organization, project and department', async function () {
    const result = await switchOrganization({
      autoSelect: true,
      organization: '中建一局集团第五建筑有限公司总部',
      project: '中建一局五公司-本部项目',
      department: '财务资金部',
    });

    console.log('切换结果:', JSON.stringify(result, null, 2));

    // 验证结果
    (result as any).should.have.property('success', true);
    (result as any).should.have.property('mode', 'auto_select');
    (result as any).should.have.property('selection');
    (result.selection as any)!.should.have.property('organization');
    (result.selection as any)!.organization.should.have.property(
      'selected',
      true
    );
    (result.selection as any)!.should.have.property('project');
    (result.selection as any)!.project.should.have.property('selected', true);
    (result.selection as any)!.should.have.property('department');
    (result.selection as any)!.department.should.have.property(
      'selected',
      true
    );
  });

  it('should read dialog fields correctly', async function () {
    const dialog = await openSwitchOrgDialog();
    console.log('对话框字段:', JSON.stringify(dialog.fields, null, 2));

    (dialog as any).should.have.property('ok', true);
    (dialog as any).should.have.property('title', '切换组织机构');
    (dialog.fields as any)!.should.have.property('组织机构');
    (dialog.fields as any)!.should.have.property('项目名称');
    (dialog.fields as any)!.should.have.property('部门名称');

    // 关闭对话框
    await closeSwitchOrgDialog('cancel');
  });
});
