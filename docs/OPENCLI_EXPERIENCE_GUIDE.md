# FIP-CSCEC 一体化 CLI 保姆级操作指引

> 本文档基于 OpenCLI 1.7.22+ 和 GWT 框架的实际踩坑经验编写，覆盖从登录到单据操作的全流程。
>
> 最后更新：2026-05-20
>
> **v3.6 重要变更：** 修复"打开空白页"问题。`bind-fip.sh` 手动保存 targetId 修复 OpenCLI 1.7.22 bug；`BaseAdapter` 强制 `OPENCLI_WINDOW=background` 避免创建 foreground 窗口。详见 [版本历史](#附录版本历史)。

---

## 目录

1. [环境准备与登录](#1-环境准备与登录)
2. [核心概念速览](#2-核心概念速览)
3. [单据列表查询](#3-单据列表查询)
4. [打开单据详情](#4-打开单据详情)
5. [下载附件](#5-下载附件)
6. [常见场景命令组合](#6-常见场景命令组合)
7. [GWT 框架操作规范](#7-gwt-框架操作规范)
8. [故障排查手册](#8-故障排查手册)
9. [易错点汇总](#9-易错点汇总)
10. [命令速查表](#10-命令速查表)
11. [日志系统](#11-日志系统)

---

## 1. 环境准备与登录

### 1.1 前置检查

```bash
# 检查 Node 版本（要求 >= 22）
node --version

# 检查 OpenCLI 版本
opencli --version

# 检查所有命令是否注册正常
opencli list | grep fip-cscec
```

### 1.2 登录流程

**重要前提：使用日常 Chrome**

`opencli-wrapper` 连接的是你**日常使用的 Chrome 浏览器**（不是 OpenClaw 的 Chrome）。

**前提条件：**
1. 在日常 Chrome 中安装 OpenCLI Browser Bridge 扩展（已安装）
2. 扩展显示为"已连接"状态

**第一步：在日常 Chrome 中打开财务系统**

```bash
# 在日常 Chrome 中打开 FIP 登录页
opencli browser $(cat ~/.opencli/clis/fip-cscec/.session) open "https://fip.cscec.com/OSPPortal/CSCPortal.jsp#/dashboard"
```

然后在日常 Chrome 窗口中：
1. 输入账号密码完成登录
2. 进入税务系统（点击左侧菜单"税务系统"）

**第二步：绑定会话**

绑定前**务必确认**当前活动标签页是财务系统页面，而不是 `about:blank`：

```bash
# 先检查当前页面 URL
opencli browser $(cat ~/.opencli/clis/fip-cscec/.session) eval 'location.href'

# 如果显示 about:blank，先切换到 FIP 标签页，再绑定
# 如果显示 fip.cscec.com，执行绑定：
cd ~/.opencli/clis/fip-cscec
bash bind-fip.sh
```

**绑定脚本原理**：`bind-fip.sh` 绑定的是当前**活动标签页**。如果活动标签页是空白页，就会绑定到空白页，导致后续命令无法操作。

**第三步：验证绑定**

```bash
# 检查系统健康状态
opencli fip-cscec system-health

# 或者直接查询待办列表
opencli fip-cscec tax-bill-list --status pending
```

### 1.3 Session 管理

Session ID 的读取优先级：

```
环境变量 SESSION_ID > .session 文件 > config 配置 > 'default'
```

**查看当前 session：**

```bash
cat ~/.opencli/clis/fip-cscec/.session
```

**手动指定 session（临时）：**

```bash
SESSION_ID=n4zwmtr9 opencli fip-cscec tax-bill-list --status finished
```

### 1.4 登录失效处理

如果页面变成 `about:blank` 或提示未登录：

```bash
# 1. 检查浏览器当前 URL
opencli browser $(cat ~/.opencli/clis/fip-cscec/.session) eval 'location.href'

# 2. 如果已失效，重新登录后再次绑定
bash bind-fip.sh
```

**常见原因：**
- **日常 Chrome 的活动标签页变成了 `about:blank`**（最常见）
- 浏览器标签页被关闭
- Chrome 崩溃或被系统释放内存
- 登录超时（通常 8 小时左右）

**排查步骤：**
```bash
# 1. 检查当前标签页列表
opencli browser $(cat ~/.opencli/clis/fip-cscec/.session) tab list

# 2. 如果只有 about:blank，说明 FIP 页面被关闭或切换了
#    需要重新在日常 Chrome 中打开 FIP 并登录
opencli browser $(cat ~/.opencli/clis/fip-cscec/.session) open "https://fip.cscec.com/OSPPortal/CSCPortal.jsp#/dashboard"

# 3. 确认 URL 正确后再绑定
opencli browser $(cat ~/.opencli/clis/fip-cscec/.session) eval 'location.href'
bash bind-fip.sh
```

**重要：绑定后检查 browser-state 文件**

OpenCLI 1.7.22 的 `bind` 命令有 bug，不会自动保存标签页的 targetId。`bind-fip.sh` 已修复此问题，但绑定后建议手动确认：

```bash
# 检查 browser-state 文件是否存在且包含 targetId
cat ~/.opencli/browser-state/$(cat ~/.opencli/clis/fip-cscec/.session).json
# 应输出类似：{"defaultPage":"DCACF475178D3D87BFE1321AA1D7D750",...}

# 如果不存在或为空，手动获取 targetId 并保存
TARGET_ID=$(opencli browser $(cat ~/.opencli/clis/fip-cscec/.session) tab list | grep '"page"' | head -1 | sed 's/.*"page": "\([^"]*\)".*/\1/')
mkdir -p ~/.opencli/browser-state
printf '{"defaultPage":"%s","updatedAt":"%s"}\n' "$TARGET_ID" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  > ~/.opencli/browser-state/$(cat ~/.opencli/clis/fip-cscec/.session).json
```

---

## 2. 核心概念速览

### 2.1 四层架构

```
CLI 命令 (tax-*.js)
    |
    v
TaxAdapter  -- 业务逻辑（打开单据、查询列表、下载附件）
    |
    v
TaxNavigator -- 页面导航（切换标签页、点击查询按钮）
    |
    v
BrowserBridge -- 浏览器连接管理（session、登录检查、eval）
    |
    +-- ElementLocator -- 元素定位（GWT 动态类名兼容、可见性过滤）
    +-- ActionExecutor -- 交互执行（CDP click / dispatchEvent / 序列点击）
    |
    v
OpenCLI Browser Bridge --> Chrome
```

**作为用户，你只需要关心 CLI 命令和 TaxAdapter 的返回结果。**

**作为开发者，核心基础设施在 `core/` 目录：**

| 模块 | 文件 | 职责 |
|------|------|------|
| `BrowserBridge` | `core/browser-bridge.js` | 统一 OpenCLI 调用入口、登录检查、操作统计 |
| `ElementLocator` | `core/element-locator.js` | GWT 元素定位策略、动态类名兼容、可见性过滤 |
| `ActionExecutor` | `core/action-executor.js` | 点击策略分发（CDP / dispatch / sequence / double） |
| `Validator` | `core/validator.js` | 运行时参数校验（billId、tabName、status 等） |
| 错误体系 | `core/errors.js` | 结构化错误（BridgeError、ElementNotFoundError、AuthError 等） |

### 2.2 单据的四种状态

| 状态 | 中文名 | 含义 | 命令参数 |
|------|--------|------|----------|
| pending | 待办 | 需要我审批的单据 | `--status pending` |
| finished | 已办 | 我已审批过的单据 | `--status finished` |
| completed | 已办结 | 流程已结束的单据 | `--status completed` |
| all | 我的单据 | 我发起或相关的所有单据 | `--status all` |

**重要：** 同一个单据编号可能在不同状态中出现。例如：我发起的单据在"我的单据"里，审批通过后进入"已办"，流程结束后进入"已办结"。

### 2.3 GWT 框架特性

FIP 系统使用 Google Web Toolkit (GWT) 构建，有以下特性：

1. **动态 CSS 类名**：每次页面刷新，类名可能变化（如 `.FD26IYC-O-l` 变成 `.FD26IYC-zb-l`）
2. **事件委托**：所有点击事件通过父元素代理，必须用 `dispatchEvent` 触发
3. **懒加载表格**：切换标签页后，必须点击"查询"按钮才能加载数据
4. **多标签页 DOM 共存**：所有标签页的内容同时存在于 DOM 中，通过尺寸为 0 隐藏非激活页

---

## 3. 单据列表查询

### 3.1 基础查询

```bash
# 查询待办单据
opencli fip-cscec tax-bill-list --status pending

# 查询已办单据
opencli fip-cscec tax-bill-list --status finished

# 查询已办结单据
opencli fip-cscec tax-bill-list --status completed

# 查询我的单据
opencli fip-cscec tax-bill-list --status all
```

### 3.2 JSON 格式输出

```bash
opencli fip-cscec tax-bill-list --status finished --output json
```

**返回结构：**

```json
{
  "tab": "已办",
  "total": 29,
  "headers": ["", "序号", "业务类型/发起时间", "组织机构", "发起人/发起部门", "节点/单据编号", "意见/业务事由", "金额", "审批进度", "单据"],
  "rows": [
    ["", "1", "建筑施工开票\n2026-05-18", "中建一局集团第五建筑有限公司西南分公司", "张林锋\n虚拟部门(武警西藏...)", "KP20002026051801149", "5月单据：某部拉萨项目申请开票", "5,352,130.56", "2026-05-18", "查看\n打开单据"]
  ],
  "url": "https://fip.cscec.com/OSPPortal/CSCPortal.jsp#/dashboard"
}
```

### 3.3 分页问题

**当前限制：** `tax-bill-list` 只返回当前页的数据（通常每页 20 条）。

如果已办有 29 条，命令只返回 20 条。剩余 9 条在第二页，需要手动翻页（暂不支持自动翻页）。

**查看实际总数：** 关注返回中的 `total` 字段，如果 `total > rows.length`，说明有分页。

### 3.4 列表查询的常见问题

**问题 1：返回 0 条数据，但页面实际有数据**

原因：
- GWT 表格类名变化，选择器不匹配
- 切换标签页后未点击"查询"按钮，表格未加载

解决：代码已自动处理，如仍有问题检查系统健康状态。

**问题 2：返回的数据量多于实际**

原因：GWT 所有标签页的表格数据都在 DOM 中，代码过滤逻辑异常。

解决：已修复，通过 `getBoundingClientRect().width > 0` 过滤只保留当前可见标签页的数据。

---

## 4. 打开单据详情

### 4.1 基础命令

```bash
opencli fip-cscec tax-invoice-get --id KP20002026051801149
```

**参数说明：**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `id` | string | 是 | - | 单据编号，如 KP20002026051801149 |
| `tab` | string | 否 | null | 指定标签页搜索（待办/已办/已办结/我的单据） |
| `output` | string | 否 | table | 输出格式：table / json |
| `download` | boolean | 否 | false | 是否同时下载附件 |

### 4.2 自动跨标签页搜索

`tax-invoice-get` 会自动在所有标签页中搜索单据：

1. 如果当前页面已有表格数据，先直接在当前页查找
2. 按顺序尝试：待办 → 已办 → 已办结 → 我的单据
3. 每个标签页自动点击"查询"加载数据
4. 找到后点击"打开单据"链接进入详情页

**不需要手动指定 `--tab` 参数**，除非你知道单据一定在某个标签页且想加速搜索。

### 4.3 指定标签页（加速搜索）

如果你确定单据在"已办"里：

```bash
opencli fip-cscec tax-invoice-get --id KP20002026051801149 --tab 已办
```

这样会跳过"待办"直接搜索"已办"，节省 3-5 秒。

### 4.4 打开单据的内部机制

**点击优先级：**

1. **严格匹配 `"打开单据"` 文本的 `<a class="anchor">` 链接** — 最可靠
2. **双击单据编号单元格** — 备选方案
3. **单击整行** — 最后备选

**绝对不要误点 `"查看"` 按钮**，否则会提示"获取GUID失败"。

### 4.5 打开单据的常见问题

**问题 1："获取GUID失败"**

原因：点击了"查看"按钮而不是"打开单据"按钮。

解决：已修复，代码现在严格匹配 `"打开单据"` 文本，排除 `"查看"`。

**问题 2：在所有标签页均未找到单据**

排查步骤：

```bash
# 1. 先确认单据在哪个标签页
opencli fip-cscec tax-bill-list --status finished --output json | grep KP20002026051801149

# 2. 如果列表里有但打不开，可能是分页问题（单据在第二页）
# 3. 如果列表里没有，确认单据编号是否正确
```

**问题 3：单据已打开但 URL 没变**

原因：GWT 打开单据可能是弹窗/浮层形式，不是页面跳转。

解决：代码会检查 URL 是否包含 `FLOW_`，如果不包含会报错。此时需要手动在浏览器中确认单据是否已打开。

---

## 5. 下载附件

### 5.1 基础命令

```bash
# 下载指定单据的附件
opencli fip-cscec tax-invoice-get --id KP20002026051801149 --download
```

### 5.2 下载流程

1. 打开单据详情页
2. 点击右侧边栏"附件"按钮
3. 等待附件列表窗口弹出
4. **逐个下载附件**：选中附件行 → 点击下载 → **循环检测文件是否写入磁盘**（连续3次大小稳定才确认完成）→ 移动到目标目录
5. 下载下一个附件（重复步骤4）
6. 关闭附件窗口

**关键设计：** 采用"串行下载+实时检测"模式，每个附件下载完成后才下载下一个，避免批量下载时的文件混淆和时序问题。

### 5.3 下载目录

默认下载目录：`/tmp/fip-attachments/{单据编号}/`

例如：`/tmp/fip-attachments/KP20002026051801149/`

### 5.4 下载附件的常见问题

**问题 1：未找到附件按钮**

原因：
- 附件按钮的 DOM 结构变化（如 `<span>附件</span>` 而非 `<div>附件
4</div>`）
- 尺寸检查过于严格

解决：已修复，匹配条件放宽为 `text.startsWith('附件')`，尺寸限制降低。

**问题 2：附件下载后找不到文件 / not_found**

原因：
- Chrome 下载是异步的，文件写入磁盘需要时间
- Chrome 自动重命名重复文件（如 `文件 (1).pdf`）
- 文件名中的空格可能被替换为 `+` 号

解决：已修复，采用串行下载+实时检测模式。每个附件下载后循环检测 `~/Downloads` 目录，直到文件出现且大小稳定（连续3次不变）才确认完成并移动。

排查：

```bash
# 检查浏览器默认下载目录
ls -lt ~/Downloads/ | head -10

# 检查目标目录
ls -la /tmp/fip-attachments/KP20002026051801149/
```

**问题 3：附件窗口未关闭**

原因：关闭按钮点击失败。

解决：手动关闭或重新运行命令。

**问题 4：下载成功数少于附件总数**

排查步骤：

1. 检查日志中每个附件的状态（`moved` / `not_found` / `failed`）
2. 检查 `~/Downloads` 目录是否有残留文件
3. 如果个别文件 `not_found`，可能是文件名匹配失败，检查日志中的实际文件名

**问题 5：大文件下载超时**

原因：6MB 以上的 PDF 下载可能需要 10-20 秒。

解决：代码已设置最多 60 秒等待时间（每次检测间隔 1 秒），通常足够。如果仍超时，可以手动从 `~/Downloads` 移动文件。

---

## 6. 常见场景命令组合

### 场景 1：查找并下载某个单据的附件

```bash
# 一步到位
opencli fip-cscec tax-invoice-get --id KP20002026051801149 --download --output json

# 查看下载结果
ls -la /tmp/fip-attachments/KP20002026051801149/
```

### 场景 2：批量查看已办单据详情

```bash
# 1. 获取已办列表
opencli fip-cscec tax-bill-list --status finished --output json > /tmp/finished.json

# 2. 提取单据编号（假设使用 jq）
cat /tmp/finished.json | jq -r '.rows[][5]' | head -5 > /tmp/bill_ids.txt

# 3. 循环查询每个单据详情
while read id; do
  echo "=== 单据: $id ==="
  opencli fip-cscec tax-invoice-get --id "$id" --output json | jq '.fields'
done < /tmp/bill_ids.txt
```

### 场景 3：检查系统健康状态

```bash
opencli fip-cscec system-health
```

返回示例：
```
- 字段: 状态
  值: healthy
- 字段: session
  值: n4zwmtr9
- 字段: url
  值: https://fip.cscec.com/OSPPortal/CSCPortal.jsp#/dashboard
- 字段: isLoggedIn
  值: true
```

### 场景 4：重新绑定浏览器

```bash
# 如果页面失效，重新登录后绑定
cd ~/.opencli/clis/fip-cscec
bash bind-fip.sh
```

---

## 7. GWT 框架操作规范

### 7.1 事件触发（最重要）

```javascript
// ❌ 绝对错误：GWT 使用事件委托，element.click() 不触发
element.click();

// ✅ 正确：必须使用 dispatchEvent
element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

// ✅ 双击打开单据
element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
```

### 7.2 表格数据行选择器

```javascript
// GWT 类名是动态生成的，必须兼容多种
const rowSelectors = ['.FD26IYC-O-l', '.FD26IYC-zb-l', '.FD26IYC-P-d'];

// 找到所有匹配的行
let allRows = [];
for (const sel of rowSelectors) {
  allRows = Array.from(document.querySelectorAll(sel));
  if (allRows.length > 0) break;
}

// 过滤出当前可见标签页的数据（隐藏的内容尺寸为0）
const visibleRows = allRows.filter(r => {
  const rect = r.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
});
```

### 7.3 关键 DOM 选择器汇总

| 元素 | 选择器 | 备注 |
|------|--------|------|
| 标签页 | `.FD26IYC-B-a` | 文本在子元素 `.FD26IYC-lb-e` 中 |
| 激活标签页 | `.FD26IYC-B-a.FD26IYC-C-a` | 有时不存在，需检查 aria-selected |
| 表格数据行 | `.FD26IYC-O-l` / `.FD26IYC-zb-l` | **动态类名**，需兼容多种 |
| 隐藏表头行 | `.FD26IYC-dc-h` | height: 0，存储表头文本 |
| 分页器 | `.FD26IYC-L-c` | 文本"共 N 条记录" |
| 查询按钮 | `.FD26IYC-H-q` | 文本"查询" |
| "打开单据"链接 | `a.anchor` | **严格匹配** `"打开单据"` |
| "查看"链接 | `a.anchor` | 文本"查看"，**不要误点** |
| 右侧附件按钮 | `.FD26IYC-H-q` | 文本"附件"或"附件\n4" |
| 附件下载按钮 | `.FD26IYC-H-q` | 文本"下载" |
| 弹窗关闭按钮 | `.FD26IYC-jb-a.FD26IYC-I-a` | 空 div，需 dispatchEvent |
| 附件窗口行 | `.FD26IYC-O-l` / `.FD26IYC-zb-l` | `cells.length === 7` 区分于单据列表行 |

### 7.4 不要 remove DOM 节点

```javascript
// ❌ 错误：GWT 异步回调会操作 null 节点
el.remove();

// ✅ 正确：只点击关闭按钮
closeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
```

---

## 8. 故障排查手册

### 8.1 快速诊断流程

```
遇到问题？
    |
    v
opencli fip-cscec system-health
    |
    +-- 状态正常？ --> 继续排查具体命令
    |
    +-- 状态异常？ --> 检查登录状态
            |
            v
    opencli browser <session> eval 'location.href'
            |
            +-- URL 是 about:blank？ --> 重新登录并绑定
            |
            +-- URL 正常？ --> 检查是否已登录
                    |
                    v
            opencli browser <session> eval 'document.body.innerText.includes("退出")'
                    |
                    +-- false？ --> 重新登录并绑定
                    |
                    +-- true？ --> 检查具体命令参数
```

### 8.2 常见问题速查

| 现象 | 可能原因 | 解决 |
|------|----------|------|
| 返回 0 条数据 | 表格类名变化 / 未点击查询 | 检查 `system-health`，确认页面状态 |
| 找不到单据 | 单据在其他标签页 / 分页 | 不指定 `--tab` 让代码自动搜索 |
| "获取GUID失败" | 误点了"查看"按钮 | 代码已修复，严格匹配"打开单据" |
| "未找到附件按钮" | 按钮 DOM 结构变化 | 检查浏览器中附件按钮的实际结构 |
| 客户端异常弹窗 | remove() 了 GWT 节点 | 代码已修复，只点击不 remove |
| 页面变 about:blank | 日常 Chrome 活动标签页切换 / 标签页被关闭 | 检查 `tab list`，重新打开 FIP 页面并绑定 |
| 每次操作打开新空白页 | 日常 Chrome 未绑定到 FIP 页面 / 绑定了 about:blank | 按 1.4 节排查，确认绑定到正确的 FIP 标签页 |
| 每次命令都打开新标签页 | OpenCLI 1.7.22 `bind` 不保存 targetPage / foreground 模式创建 interactive window | 重新运行 `./bind-fip.sh`（已修复保存 targetId），代码已强制 `OPENCLI_WINDOW=background` |
| 命令超时 | 网络慢 / GWT 加载慢 | 增加等待时间或重试 |
| 表格数据量不对 | 多标签页数据未过滤 | 代码已修复，检查 `total` vs `rows.length` |

### 8.3 调试命令

```bash
# 检查当前浏览器 URL
opencli browser $(cat ~/.opencli/clis/fip-cscec/.session) eval 'location.href'

# 检查页面是否包含登录关键字
opencli browser $(cat ~/.opencli/clis/fip-cscec/.session) eval '
  document.body.innerText.includes("退出") || document.body.innerText.includes("菜单收藏")
'

# 检查表格行数
opencli browser $(cat ~/.opencli/clis/fip-cscec/.session) eval '
  document.querySelectorAll(".FD26IYC-zb-l").length
'

# 检查当前激活的标签页
opencli browser $(cat ~/.opencli/clis/fip-cscec/.session) eval '
  document.querySelector(".FD26IYC-B-a.FD26IYC-C-a")?.innerText?.trim()
'

# 截图保存
opencli browser $(cat ~/.opencli/clis/fip-cscec/.session) screenshot /tmp/debug.png

# 检查 browser-state 文件（确认 bind 保存了 targetId）
cat ~/.opencli/browser-state/$(cat ~/.opencli/clis/fip-cscec/.session).json

# 检查 daemon 日志（查看是否有创建 about:blank 窗口的记录）
curl -s -H "X-OpenCLI: 1" http://127.0.0.1:19825/logs | grep -E "Created|about:blank|interactive"
```

---

## 9. 易错点汇总

### 9.1 命令使用易错点

| 错误 | 正确 | 说明 |
|------|------|------|
| `tax-invoice-get --id KP... --tab 待办` | `tax-invoice-get --id KP...` | 不指定 `--tab`，让代码自动搜索 |
| `tax-bill-list` | `tax-bill-list --status finished` | 必须指定 `--status` |
| `--output table` | `--output json` | JSON 更易处理 |
| 手动翻页 | 暂不支持 | 目前只返回第一页 |

### 9.2 GWT 操作易错点

| 错误 | 正确 | 说明 |
|------|------|------|
| `element.click()` | `dispatchEvent(new MouseEvent('click'))` | GWT 事件委托 |
| `el.remove()` | 只点击关闭按钮 | 避免 GWT null 异常 |
| `.FD26IYC-O-l` 硬编码 | 兼容多种类名 | 类名是动态生成的 |
| 不过滤不可见行 | `rect.width > 0` 过滤 | 多标签页数据共存 |
| `includes('查看')` | `=== '打开单据'` | 避免误点 |
| `'${var}'` 直接拼接 | `JSON.stringify(var)` | 防止单引号注入，确保 eval 字符串安全 |

### 9.3 环境易错点

| 错误 | 正确 | 说明 |
|------|------|------|
| 直接运行命令未登录 | 先登录再绑定 | 否则提示未登录 |
| 绑定后关闭浏览器 | 保持浏览器运行 | 绑定的是当前标签页 |
| 多个 session 混用 | 检查 `.session` 文件 | 确保使用正确的 session |
| 扩展未连接 | 检查 Chrome 扩展是否启用 | 打开 chrome://extensions 确认 OpenCLI Browser Bridge 已启用 |
| 绑定后仍操作空白页 | `bind` 绑定的是当前活动标签页 | 确保绑定前活动标签页是 FIP 页面，不是 about:blank |

---

## 10. 命令速查表

### 10.1 查询类命令

| 命令 | 功能 | 常用参数 |
|------|------|----------|
| `tax-bill-list` | 查询单据列表 | `--status pending/finished/completed/all` `--output json` |
| `tax-invoice-get` | 查询单据详情 | `--id <单据号>` `--download` `--output json` |
| `system-health` | 系统健康检查 | 无 |

### 10.2 参数速查

| 参数 | 类型 | 适用命令 | 说明 |
|------|------|----------|------|
| `--status` | string | tax-bill-list | `pending`/`finished`/`completed`/`all` |
| `--id` | string | tax-invoice-get | 单据编号，如 `KP20002026051801149` |
| `--tab` | string | tax-invoice-get | `待办`/`已办`/`已办结`/`我的单据`（可选） |
| `--download` | boolean | tax-invoice-get | 是否下载附件 |
| `--output` | string | 所有查询命令 | `table`/`json` |

### 10.3 文件路径速查

| 路径 | 用途 |
|------|------|
| `~/.opencli/clis/fip-cscec/` | CLI 项目根目录 |
| `~/.opencli/clis/fip-cscec/.session` | Session ID 配置文件 |
| `~/.opencli/clis/fip-cscec/lib/tax-adapter.js` | 核心适配器代码 |
| `/tmp/fip-attachments/{billId}/` | 附件下载目录 |
| `~/Downloads/` | 浏览器默认下载目录 |

---

## 11. 日志系统

### 11.1 命名空间说明

| 命名空间 | 用途 | 输出位置 |
|----------|------|----------|
| `fip:bridge` | BrowserBridge 调用日志 | stdout（通过 DEBUG 环境变量启用） |
| `fip:locator` | ElementLocator 定位日志 | stdout |
| `fip:executor` | ActionExecutor 交互日志 | stdout |
| `fip:adapter` | TaxAdapter 业务日志 | stdout |
| `fip:navigator` | TaxNavigator 导航日志 | stdout |
| `fip:error` | 错误日志（始终输出） | stderr |
| `fip:audit` | 审计日志（结构化 JSON） | `~/.local/share/fip-cscec/audit/audit-YYYY-MM-DD.log` |

### 11.2 启用方式

```bash
# 启用所有日志
DEBUG=fip:* node tax-bill-list.js

# 只启用 bridge 和 error
DEBUG=fip:bridge,fip:error node tax-invoice-get.js

# 启用 adapter 和 navigator
DEBUG=fip:adapter,fip:navigator node tax-invoice-get.js --id KP20002026051801149
```

## 附录：浏览器实例说明

### 日常 Chrome + OpenCLI 扩展

`opencli-wrapper` 和 `opencli fip-cscec` 命令连接的是你**日常使用的 Chrome 浏览器**，通过 OpenCLI Browser Bridge 扩展进行通信。

**前提条件：**
1. 在日常 Chrome 中安装并启用 OpenCLI Browser Bridge 扩展
2. 扩展显示为"已连接"状态（绿色）

**验证扩展是否连接：**
```bash
opencli-wrapper profile list
```
应显示类似：
```
Connected Browser Bridge profiles
  n4zwmtr9 default — connected v1.0.15
```

**绑定前务必检查：**
```bash
# 确认日常 Chrome 的当前活动标签页
opencli browser $(cat ~/.opencli/clis/fip-cscec/.session) tab list

# 如果只有 about:blank，先打开 FIP 页面
opencli browser $(cat ~/.opencli/clis/fip-cscec/.session) open "https://fip.cscec.com/OSPPortal/CSCPortal.jsp#/dashboard"

# 确认 URL 正确后再绑定
opencli browser $(cat ~/.opencli/clis/fip-cscec/.session) eval 'location.href'
bash bind-fip.sh
```

---

### 11.3 兼容旧接口

`BaseAdapter` 仍提供 `this.logger` 属性，内部代理到 debug 命名空间日志：

```javascript
this.logger.debug('调试信息');  // → fip:adapter
this.logger.info('一般信息');   // → fip:adapter
this.logger.warn('警告');       // → fip:error [WARN]
this.logger.error('错误');      // → fip:error
this.logger.audit('action', {}); // → audit 文件
```

---

## 附录：版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 3.6 | 2026-05-20 | **修复"打开空白页"问题：** 1) `bind-fip.sh` 手动保存 targetId 到 `browser-state`（修复 OpenCLI 1.7.22 `bind` 不保存 targetPage 的 bug）；2) `BaseAdapter` 强制设置 `OPENCLI_WINDOW=background`，避免内部调用创建 foreground 的 about:blank 窗口；3) 新增故障排查"每次命令都打开新标签页"解决方案 |
| 3.5 | 2026-05-20 | **全面代码 debug：** 修复 12 个 bug：1) `tax-invoice-get` 默认 `tab` 改为 `null` 支持自动跨标签搜索；2) `tax-bill-list` 补充 `all` 状态映射；3) `ensureTaxSystem()` 改为检测页面内容而非 URL，避免误判；4) `queryBills`/`openBill` 表格行选择器优先匹配可见行；5) 附件下载支持所有文件类型（pdf/doc/xls/jpg/png/zip 等）；6) `waitForLoad` 增加 `readyState === 'complete'` 和 URL 稳定性检查；7) `tax-navigator` 所有 `execFileSync('sleep')` 替换为 `waitForLoad`；8) `system-health` Node.js 版本检查更新为 >= 22；9) 删除未使用的 `execFileSync` 导入；10) `_getVisibleTableRows` 改为用 `getBoundingClientRect` 过滤；11) `bind-fip.sh` 保持简洁；12) `opencli-wrapper` 恢复为无 CDP 检测版本 |
| 3.4 | 2026-05-20 | **切换到日常 Chrome：** 安装 OpenCLI Browser Bridge 扩展到日常 Chrome，不再依赖 OpenClaw Chrome（端口 18800）|
| 3.3.1 | 2026-05-19 | **集成测试修复：** `config-manager.js` 增加 `initDirs()` 调用确保 XDG 目录自动创建；`BrowserEngine` 增加 `new.target` 抽象类保护；`browser-bridge.js` `_run()` 委托给引擎实现；`engine.js` 补充 `execFileSync` 导入 |
| 3.3 | 2026-05-19 | **配置标准化+引擎抽象：** XDG 规范目录（`~/.config/fip-cscec/`/`~/.local/share/fip-cscec/`/`~/.cache/fip-cscec/`），浏览器引擎抽象接口 `BrowserEngine` + `OpenCLIEngine` 实现，预留 Playwright 替换能力 |
| 3.2 | 2026-05-19 | **错误增强：** 所有错误类新增 `suggestions` 字段，提供可操作的修复建议（如 AuthError 提示重新绑定、ElementNotFoundError 提示检查 GWT 类名变化） |
| 3.1 | 2026-05-19 | **日志系统重构：** 引入 `debug` 库命名空间日志（`fip:bridge`/`locator`/`executor`/`adapter`/`navigator`/`error`/`audit`），替代旧 Logger 类，BaseAdapter 兼容旧 `this.logger` 接口 |
| 3.0 | 2026-05-19 | **架构重构：** 引入 `core/` 分层架构（BrowserBridge / ElementLocator / ActionExecutor / Validator / 统一错误体系），BaseAdapter 迁移到新架构 |
| 2.3 | 2026-05-19 | BrowserPage 底层重写：新增 `safeEval()`、`clickSafe()`、`debug()`，错误处理从静默吞错改为立即抛错 |
| 2.2 | 2026-05-19 | 代码清理：删除重复文件和探索脚本，修复 eval 字符串中的单引号注入风险（`JSON.stringify` 替代模板字符串） |
| 2.1 | 2026-05-19 | 修复附件下载：串行下载+实时检测，删除重复 push，修复文件名匹配 |
| 2.0 | 2026-05-18 | 重写，适配 OpenCLI 1.7.22+，新增 GWT 动态类名、事件委托等规范 |
| 1.1 | 2026-05-14 | 初始版本 |

---

## 附录：BrowserBridge API

### 调试与观测

| 方法 | 说明 | 示例 |
|------|------|------|
| `debug()` | 返回最后一次 `_run` 操作的详细结果 | `bridge.debug()` |
| `stats()` | 返回操作统计（callCount、lastResult、sessionId） | `bridge.stats()` |
| `screenshot(path)` | 截图 | `bridge.screenshot('/tmp/debug.png')` |
| `state()` | 浏览器状态 | `bridge.state()` |

### 页面信息

| 方法 | 说明 |
|------|------|
| `url()` | 当前 URL |
| `title()` | 页面标题 |
| `checkLogin()` | 检查登录状态，返回 `{ isLoggedIn, url, details }` |
| `requireLogin()` | 断言已登录，未登录抛 `AuthError` |

### 元素定位（locator 子模块）

| 方法 | 说明 |
|------|------|
| `locator.find(selector, { required, limit })` | CSS 查找 |
| `locator.findOne(selector)` | 查找单个，找不到返回 null |
| `locator.findGwtRows()` | 查找 GWT 表格可见行 |
| `locator.findGwtRowByText(text)` | 按文本查找 GWT 行 |
| `locator.findGwtTabs()` | 查找所有标签页 |
| `locator.findQueryButton()` | 查找查询按钮 |
| `locator.findBillRow(billId)` | 查找单据行及打开链接 |
| `locator.findAttachmentButton()` | 查找附件按钮 |
| `locator.findAttachmentList()` | 查找附件列表 |
| `locator.findDownloadButton()` | 查找下载按钮 |

### 交互执行（executor 子模块）

| 方法 | 说明 | 策略 |
|------|------|------|
| `executor.click(target, { strategy })` | 统一点击 | `ClickStrategy.CDP` / `DISPATCH` / `SEQUENCE` / `DOUBLE` |
| `executor.clickOpenBillLink(rowSelector, billId)` | 点击"打开单据" | SEQUENCE |
| `executor.clickTab(tabName)` | 点击标签页 | DISPATCH |
| `executor.clickQuery()` | 点击查询按钮 | DISPATCH |
| `executor.type(target, text)` | 输入文本 | CDP |
| `executor.select(target, option)` | 选择选项 | CDP |
| `executor.closeDialogs()` | 关闭弹窗 | - |

### 安全执行

| 方法 | 说明 | 示例 |
|------|------|------|
| `safeEval(template, vars)` | 模板变量自动 JSON.stringify 转义 | `safeEval('return document.querySelector({{sel}})?.innerText', { sel: '.btn' })` |

### 错误类型

| 类型 | 触发条件 | 上下文字段 | 修复建议示例 |
|------|----------|-----------|-------------|
| `BridgeError` | OpenCLI 命令失败 | `action, args, stderr, stdout, exitCode` | 检查守护进程、重新绑定会话 |
| `ElementNotFoundError` | 找不到元素 | `selector, strategy, pageUrl` | 检查选择器、切换标签页、等待加载 |
| `ElementStateError` | 元素状态异常 | `selector, expected, actual` | 关闭弹窗、更换 ClickStrategy |
| `AuthError` | 未登录 | `url, hint` | 重新登录绑定、检查 .session 文件 |
| `TimeoutError` | 超时 | `operation, timeout, elapsed` | 增加 timeout、检查网络、截图排查 |
| `ValidationError` | 参数校验失败 | `field, expected, actual` | 检查参数格式、查看帮助 |

---

## 附录：项目目录结构

```
fip-cscec/
├── core/                          # 底层基础设施（新增）
│   ├── index.js                   # 统一入口
│   ├── errors.js                  # 错误体系（含 suggestions）
│   ├── validator.js               # 参数校验
│   ├── logger.js                  # 命名空间日志系统（debug 库）
│   ├── paths.js                   # XDG 路径管理
│   ├── engine.js                  # 浏览器引擎抽象（BrowserEngine / OpenCLIEngine）
│   ├── browser-bridge.js          # 浏览器桥接
│   ├── element-locator.js         # 元素定位
│   └── action-executor.js         # 交互执行
├── lib/                           # 业务适配器
│   ├── base-adapter.js            # 基础适配器（使用 BrowserBridge）
│   ├── tax-adapter.js             # 税务适配器
│   ├── tax-navigator.js           # 税务导航器
│   ├── browser-page.js            # 旧 BrowserPage（保留兼容）
│   ├── config-manager.js          # 配置管理
│   ├── logger.js                  # 旧日志系统（兼容保留）
│   ├── auth-helper.js             # 登录助手
│   └── extractors/                # 数据提取器
│       └── base-extractor.js
├── docs/                          # 文档
│   └── OPERATION_GUIDE.md         # 本文件
├── tax-*.js                       # CLI 命令（27个）
├── system-*.js                    # 系统命令
├── bind-fip.sh                    # 绑定脚本
├── open-fip.sh                    # 打开脚本
├── scripts/                       # 脚本
│   ├── code-review.js             # 代码审查脚本
│   └── review-daemon.js           # 审查守护进程
├── logs/                          # 项目日志（审查报告等）
│   └── review/                    # 审查报告

### XDG 目录（运行时创建）

```
~/.config/fip-cscec/
└── user.json                      # 用户配置

~/.local/share/fip-cscec/
├── logs/                          # 应用日志
│   └── audit-YYYY-MM-DD.log       # 审计日志
├── audit/                         # 审计日志（备用）
└── exports/                       # 数据导出

~/.cache/fip-cscec/                # 缓存目录
```

### 引擎抽象层

```javascript
// 默认使用 OpenCLIEngine
const bridge = new BrowserBridge(sessionId);

// 注入自定义引擎（如 Playwright）
const bridge = new BrowserBridge(sessionId, null, {
  engine: new PlaywrightEngine({ headless: false })
});
```

---

## 附录：自动化代码审查

### 审查机制

项目配置了自动代码审查，每天 **9:00** 和 **21:00** 运行。

**审查内容：**
- 语法检查（`node --check`）
- eval 字符串安全（检测未转义的 `${var}` 和中文注释）
- import 路径有效性
- 重复导出
- 文档同步检查
- 核心文件完整性

**审查报告位置：**
```
logs/review/
├── report-YYYY-MM-DDTHH-MM-SS.json   # JSON 格式报告
├── review-YYYY-MM-DDTHH-MM-SS.log    # 文本日志
└── cron.log                            # 定时任务日志
```

**手动运行审查：**
```bash
cd ~/.opencli/clis/fip-cscec
node scripts/code-review.js
```

**查看审查守护进程状态：**
```bash
launchctl list | grep fip-cscec
```

**停止守护进程：**
```bash
launchctl unload ~/Library/LaunchAgents/com.fip-cscec.review.plist
```

---

*本文档基于实际踩坑经验编写，如有遗漏请补充。*
