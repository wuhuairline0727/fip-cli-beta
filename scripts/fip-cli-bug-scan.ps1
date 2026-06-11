# fip-cli-bug-scan.ps1
# 用途：每天 6 次扫描 fip-cli 仓库代码是否引入新 bug，如发现新 bug 调 GitHub API 推 issue
# 触发：mavis cron 调度（cron prompt 里调用）
# 凭据：读 C:\Users\40427\.config\gh\cron-token（不在脚本里硬编码）
# 去重：发现 bug 标题先查 GitHub 已有 open issue，撞到了就跳过
# 输出：写到 D:\claude\fip-cli\scripts\bug-scan.log

param(
  [string]$Repo = "wuhuairline0727/fip-cli",
  [string]$WorkDir = "D:\claude\fip-cli",
  [string]$TokenFile = "C:\Users\40427\.config\gh\cron-token",
  [string]$LogFile = "D:\claude\fip-cli\scripts\bug-scan.log"
)

$ErrorActionPreference = "Continue"
$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$token = (Get-Content $TokenFile -Raw -ErrorAction SilentlyContinue).Trim()

if (-not $token) {
  $line = "[$ts] ABORT: token file not found or empty at $TokenFile"
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
  Write-Output $line
  exit 1
}

Set-Location $WorkDir
git fetch origin --quiet 2>&1 | Out-Null

# === 阶段 1: 静态分析 ===
$findings = @()

# 1a. Lint
$lintOut = & npm run lint 2>&1
if ($LASTEXITCODE -ne 0) {
  $findings += [pscustomobject]@{ severity = "error"; source = "lint"; detail = ($lintOut -join "`n") }
}

# 1b. Format check
$fmtOut = & npm run format:check 2>&1
if ($LASTEXITCODE -ne 0) {
  $findings += [pscustomobject]@{ severity = "warn"; source = "format:check"; detail = ($fmtOut -join "`n") }
}

# 1c. Unit tests
$testOut = & npm test 2>&1
if ($LASTEXITCODE -ne 0) {
  $findings += [pscustomobject]@{ severity = "error"; source = "test"; detail = ($testOut -join "`n") }
}

# 1d. Security audit (only fail on high/critical)
$auditOut = & npm audit --json 2>&1 | Out-String
try {
  $auditJson = $auditOut | ConvertFrom-Json -ErrorAction SilentlyContinue
  $highCount = $auditJson.metadata.vulnerabilities.high + $auditJson.metadata.vulnerabilities.critical
  if ($highCount -gt 0) {
    $findings += [pscustomobject]@{ severity = "error"; source = "audit"; detail = "high/critical vulnerabilities: $highCount" }
  }
} catch {}

# === 阶段 2: 汇总 + 去重 + 推 issue ===
if ($findings.Count -eq 0) {
  $line = "[$ts] OK: no new bugs found (lint+test+audit clean)"
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
  Write-Output $line
  exit 0
}

# 拉已有 open issue 标题做去重
$env:GH_TOKEN = $token
$existingTitles = @()
try {
  $issues = gh issue list --repo $Repo --state open --limit 100 --json title 2>&1 | ConvertFrom-Json
  $existingTitles = $issues | ForEach-Object { $_.title }
} catch {}

foreach ($f in $findings) {
  $title = "[Bug] fip-cli $($f.source) failed: $($f.severity)"
  $body = "## 自动检测结果`n`n- **来源**: $($f.source)`n- **严重性**: $($f.severity)`n- **时间**: $ts`n`n## 详情`n````n$($f.detail.Substring(0, [Math]::Min(2000, $f.detail.Length)))`n````n`n---\n自动生成 by mavis cron bug-scan"
  if ($existingTitles -contains $title) {
    $line = "[$ts] SKIP: '$title' already exists in open issues"
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
    Write-Output $line
    continue
  }
  # 用数组+splatting 传参，避免 PowerShell 把 --label bug 拆开
  $ghArgs = @('issue','create','--repo',$Repo,'--title',$title,'--body',$body,'--label','bug')
  $output = & gh @ghArgs 2>&1
  if ($LASTEXITCODE -eq 0) {
    $line = "[$ts] CREATED: $output"
  } else {
    $line = "[$ts] FAIL ($LASTEXITCODE): $output"
  }
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
  Write-Output $line
  }
}

Remove-Item Env:GH_TOKEN -ErrorAction SilentlyContinue
exit 0
