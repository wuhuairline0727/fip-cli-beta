---
description: FIP CLI 架构说明 — 系统模块归属、技术选型、CDP原理、GWT兼容策略
---

# FIP CLI 架构说明

## 系统模块归属

FIP 一体化平台包含多个业务系统，本 CLI 按功能模块分类如下：

### 报账系统

负责费用报销、付款申请等日常报账业务。

| 单据代码 | 单据名称             | 配置文件                           | 功能                              |
| -------- | -------------------- | ---------------------------------- | --------------------------------- |
| SLBX     | 境内差旅报销单       | `bills/config/domestic-travel.ts`  | 费用明细、预算分配、交通费/补助费 |
| TBX      | 通用报销单           | `bills/config/general-expense.ts`  | 费用明细、预算分配                |
| CFK      | 对外成本费用付款申请 | `bills/config/external-payment.ts` | 费用明细、支付信息                |
| CBX      | 差旅费报销           | `bills/config/travel-expense.ts`   | 差旅明细、补助信息                |

**CLI 命令**: `extract-bill <单据编号>`（自动识别类型）

### 税务系统

负责发票管理、税务台账、税费预缴等税务业务。

| 单据代码 | 单据名称       | 配置/模块             | 功能                                     |
| -------- | -------------- | --------------------- | ---------------------------------------- |
| YJK      | 预缴计算单     | `bills/config/yjk.ts` | 增值税/所得税/附加税费预缴               |
| KP       | 建筑施工开票单 | `audit/` 目录         | 合同金额核对、累计确权额核对、附件完整性 |

**税务台账**:
| 台账名称 | 模块文件 | CLI 命令 |
|----------|----------|----------|
| 未开票收入台账 | `ledgers/unbilled-income.ts` | `export-unbilled` |
| 进项转出明细台账 | `ledgers/input-transfer.ts` | `export-input-transfer` |
| 销项发票明细台账 | `ledgers/output-invoice.ts` | `export-output-invoice` |
| 增值税预缴款台账 | `ledgers/vat-prepayment.ts` | `export-vat-prepayment` |
| 旅客运输服务台账 | `ledgers/passenger-transport.ts` | `export-passenger-transport` |

**CLI 命令**:

- `extract-bill <YJK编号>` — 预缴计算单提取
- `extract-invoice <KP编号>` — 开票单字段提取
- `audit-invoice <KP编号>` — 开票单审核

### 司库系统

> 注：司库系统模块（资金管理、银企直联等）目前未在本 CLI 中实现。KP 开票单虽名称含"开票"，但属于**税务系统**发票管理模块，非司库系统。

## 技术架构

### 双层浏览器控制

```
┌─────────────────────────────────────────┐
│           FIP CLI (Node.js)             │
├─────────────────────────────────────────┤
│  Kimi WebBridge  │  Chrome DevTools     │
│  (端口 10086)    │  Protocol (端口 9222)│
├─────────────────────────────────────────┤
│  浏览器扩展      │  Chrome 浏览器        │
│  (JS注入/导航)   │  (真实鼠标点击)       │
└─────────────────────────────────────────┘
```

| 层        | 端口  | 用途                                       | 场景                                |
| --------- | ----- | ------------------------------------------ | ----------------------------------- |
| WebBridge | 10086 | DOM 操作、页面导航、截图、JS 执行          | 大多数操作                          |
| CDP       | 9222  | 真实鼠标点击（mousePressed/mouseReleased） | Picker 弹窗、下拉选项、GWT 特殊元素 |

### 为什么需要 CDP 真实点击

GWT（Google Web Toolkit）框架生成的部分元素无法通过常规 `element.click()` 触发：

- Picker 弹窗的触发按钮
- 下拉选项选择
- 某些弹窗内的确认按钮

CDP 通过 `Input.dispatchMouseEvent` 发送真实的鼠标按下/释放事件，绕过 GWT 的事件拦截机制。

## GWT 框架兼容策略

### 问题：动态类名

GWT 编译后的 CSS 类名每次部署可能变化：

```
.FD26IYC-w-l   → 可能变成 .FD26IYC-x-l
.FD26IYC-jb-a → 可能变成 .FD26IYC-kb-a
```

### 应对策略

1. **多选择器兼容**: 同时匹配多种可能的类名

   ```javascript
   document.querySelector('.FD26IYC-w-l, .FD26IYC-x-l, [class*="w-l"]');
   ```

2. **byIdPrefix 策略**: GWT ID 前缀稳定，后缀数字变化

   ```javascript
   // ID 可能是 SW_STO_YJKF_GSMC30 或 SW_STO_YJKF_GSMC3
   document.querySelector('[id^="SW_STO_YJKF_GSMC"]');
   ```

3. **文本内容匹配**: 当类名完全不可用时，通过元素文本定位

   ```javascript
   // 查找包含"查询"文本的按钮
   Array.from(document.querySelectorAll('button, div, span')).find(
     (el) => el.textContent.trim() === '查询'
   );
   ```

4. **坐标点击（CDP）**: 当 DOM 定位完全失效时，通过元素坐标点击
   ```javascript
   // 先获取元素坐标，再用 CDP 点击
   const rect = element.getBoundingClientRect();
   cdpClick(rect.left + rect.width / 2, rect.top + rect.height / 2);
   ```

## 单据类型自动识别

通过单据编号前缀识别类型：

```javascript
const BILL_TYPE_MAP = {
  SLBX: 'domestic_travel', // 境内差旅报销单
  TBX: 'general_expense', // 通用报销单
  CFK: 'external_payment', // 对外成本费用付款申请
  CBX: 'travel_expense', // 差旅费报销
  YJK: 'yjk', // 预缴计算单
  KP: 'invoice', // 建筑施工开票单（税务系统）
};
```

## 税率自动计算（YJK）

附加税费税率计算逻辑：

```
城市维护建设税税率 = 城市维护建设税 / 预缴增值税⑥
教育费附加税率     = 教育费附加 / 预缴增值税⑥
地方教育附加税率   = 地方教育附加 / 预缴增值税⑥
```

实现位置: `lib/bills/extractor.ts` → `postProcessYjk()`

## 弹窗检测策略

`lib/utils/dialog.ts` 采用多策略检测：

| 策略 | 检测目标                             | 关闭方式                                       |
| ---- | ------------------------------------ | ---------------------------------------------- |
| 1    | 系统弹窗 (`window.alert`/`confirm`)  | 自动接受/关闭                                  |
| 2    | 模态对话框 (`.modal`, `.dialog`)     | 点击关闭按钮                                   |
| 3    | 通知弹窗 (`.notification`, `.toast`) | 点击关闭或等待自动消失                         |
| 4    | GWT 弹窗 (`.x-window-draggable`)     | 查找 `x-tool-close` 或 `FD26IYC-jb-a` 关闭按钮 |

## 项目依赖

| 包名                      | 用途         | 必需 |
| ------------------------- | ------------ | ---- |
| `commander`               | CLI 命令解析 | 是   |
| `chrome-remote-interface` | CDP 客户端   | 是   |

无其他运行时依赖，保持轻量。
