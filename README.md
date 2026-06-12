# FIP CLI

> 中国建筑司库一体化平台(fip.cscec.com)的自动化命令行工具 — 单据提取、台账查询、开票审核，一键完成。

[![CI](https://github.com/wuhuairline0727/fip-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/wuhuairline0727/fip-cli/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@wuhuairline0727/fip-cli)](https://www.npmjs.com/package/@wuhuairline0727/fip-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

FIP CLI 通过 [Kimi WebBridge](https://www.kimi.com/zh-cn/features/webbridge) 控制浏览器，自动完成中国建筑司库一体化平台的单据处理、税务台账查询和开票单审核，无需手动复制粘贴。

## Install

```bash
npm install -g fip-cli
```

**依赖**: [Node.js](https://nodejs.org) ≥ v20, [Kimi WebBridge](https://www.kimi.com/zh-cn/features/webbridge) 浏览器扩展 + 守护进程, Chrome（开启 `--remote-debugging-port=9222`）

## Quick Start

```bash
# 1. 检查环境是否就绪
fip-cli doctor

# 2. 提取一张单据的字段数据
fip-cli extract-bill SLBX2004202605003766

# 3. 查询税务台账
fip-cli export-input-transfer --start-period 2026-04 --query-only
```

## Features

- 📄 **单据自动提取** — 打开、识别类型、提取字段、关闭，全自动流程
- 🧾 **税务台账查询** — 未开票收入、进项转出、销项发票、增值税预缴等一键导出
- ✅ **开票单审核** — 合同金额核对、累计确权额验证、附件完整性检查
- 🩺 **环境诊断** — 一键检查 Node.js、WebBridge、CDP、FIP 登录状态
- 🔧 **GWT 框架兼容** — 自动处理动态类名、不稳定 ID、弹窗干扰
- 📝 **Debug 模式** — `--debug` 输出详细日志到 `fip-debug.log`，排查问题

## Commands

| Command | Description |
|---------|-------------|
| `doctor` | 环境诊断：检查 Node.js、依赖、WebBridge、CDP、FIP 登录 |
| `login-status` | 检查 FIP 登录状态 |
| `extract-bill <编号>` | 自动打开单据、提取字段、关闭 |
| `audit-invoice <编号>` | 开票单审核并生成报告 |
| `export-input-transfer` | 进项转出明细台账查询 |
| `export-output-invoice` | 销项发票明细台账查询 |
| `export-vat-prepayment` | 增值税预缴款台账查询 |
| `export-passenger-transport` | 旅客运输服务台账查询 |
| `export-unbilled` | 未开票收入台账查询 |
| `export-all` | 批量导出多个台账 |
| `config <key> [value]` | 查看/设置配置项 |

完整命令参考：`fip-cli --help`

## Supported Bill Types

| Type | Name | Module |
|------|------|--------|
| `SLBX` | 境内差旅报销单 | 报账系统 |
| `TBX` | 通用报销单 | 报账系统 |
| `CFK` | 对外成本费用付款申请 | 报账系统 |
| `CBX` | 差旅费报销 | 报账系统 |
| `YJK` | 预缴计算单 | 税务系统 |
| `KP` | 建筑施工开票单 | 税务系统 |

## Configuration

```bash
# 常用配置项
fip-cli config companyCode   1000200020040011
fip-cli config taxCode       91110000101638302P
fip-cli config startPeriod   2026-04
fip-cli config endPeriod     2026-04
```

配置自动验证格式（如 `companyCode` 必须为纯数字）。

## Documentation

- [完整使用指南](docs/GUIDE.md) — 所有命令详解、配置说明、故障排查
- [开发文档](docs/DEVELOPMENT.md) — 项目结构、测试、代码规范、TypeScript 类型系统
- [更新日志](docs/CHANGELOG.md) — 版本历史

## Tech Stack

- **TypeScript** — 全项目 TypeScript 化，`strict: true`，零 `any` 类型泄漏
- **tsx** — Node.js 运行时 TS 加载（CJS 模式）
- **Mocha + Chai + Sinon** — 单元测试框架
- **Kimi WebBridge** — 浏览器自动化（HTTP API + CDP）
- **Commander.js** — CLI 命令解析

## License

MIT
