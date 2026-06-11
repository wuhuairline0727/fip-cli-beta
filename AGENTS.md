# AGENTS.md — fip-cli 项目 Agent 协作指南

> 面向未来接手 fip-cli 项目的 AI agent / 人类协作者。

## 项目概览

- 仓库：`https://github.com/wuhuairline0727/fip-cli`
- 用途：通过 Kimi WebBridge 控制浏览器，自动化中建司库一体化平台（fip.cscec.com）单据提取/审核
- 详细架构与开发规范见 `docs/ARCHITECTURE.md` / `docs/DEVELOPMENT.md`

## 自动化任务（已注册 cron）

### 1. fip-cli-bug-scan — 每天 6 次扫描代码 bug

- **调度**：`0 3,7,11,15,19,23 * * *`（每天 03/07/11/15/19/23 点）
- **时区**：Asia/Shanghai
- **Session 模式**：new（每次 tick 独立 session）
- **Report**：结果汇总到 root session
- **执行**：`D:\claude\fip-cli\scripts\fip-cli-bug-scan.ps1`
- **流程**：
  1. 拉最新 master
  2. 跑 `npm run lint` / `npm test` / `npm run format:check` / `npm audit`（high+critical 级别）
  3. 任何一项失败 → 调 `gh issue create` 推 issue（带 bug label）
  4. 推之前**先去重**（拉 GitHub open issue 列表查标题）
  5. 日志写到 `D:\claude\fip-cli\scripts\bug-scan.log`

### 凭据维护

- **GitHub PAT 路径**：`C:\Users\40427\.config\gh\cron-token`
- **必需 scope**：`repo`（本 cron 只需 issue 写权限）
- **当前过期**：2026-09-09（90 天）
- **过期后**：去 https://github.com/settings/tokens 重新生成 PAT，把新 token 覆盖到上述路径

### 修改/禁用

```bash
# 查看
mavis cron info mavis fip-cli-bug-scan

# 禁用（临时）
mavis cron disable mavis fip-cli-bug-scan

# 重新启用
mavis cron enable mavis fip-cli-bug-scan

# 立即手动触发一次（测试用）
mavis cron trigger mavis fip-cli-bug-scan

# 删除
mavis cron delete mavis fip-cli-bug-scan
```

## 已知坑

- 脚本用 `[Environment]::SetEnvironmentVariable(...)` 而不是 `$env:GH_TOKEN = ...`，因为 PowerShell `& script.ps1` + `& gh @args` 链式调用下，**`$env:` 赋值在脚本 scope 不外传到 gh 子进程**。详见脚本注释。
- `gh issue create --label bug` 在 PowerShell 里**必须用数组+splatting 传参**（`$ghArgs = @(...)` + `& gh @ghArgs`），否则 `--label` 会被解析错。
- 用户**手动删除 GitHub issue** 后，cron 下次扫描会因为"库里没这个 bug 标题"而**重新推一次**。这是去重逻辑的合理行为，不是 bug。
