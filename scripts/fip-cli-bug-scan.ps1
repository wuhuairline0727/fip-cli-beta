# fip-cli-bug-scan.ps1
# Purpose: cron-driven scanner for fip-cli repo. Runs lint + test + format:check + npm audit.
# If new bugs are found, dedup against open issues then create a GitHub issue via gh CLI.
# Trigger: mavis cron (every 4 hours)
# Credential: reads <用户目录>/.config/gh/cron-token
# Dedupe: matches bug title against existing open issues
# Output: appends to <项目目录>/scripts/bug-scan.log
#
# NOTE: This script is intentionally English-only in source. PowerShell 5.1 on zh-CN systems
# sometimes mis-tokenizes CJK in .ps1 source even with a UTF-8 BOM, causing parser errors
# before the script body runs. All Chinese strings used in GitHub issue bodies are loaded
# at runtime from bug-scan-i18n.json (parsed via ConvertFrom-Json, which handles UTF-8 fine).
# This keeps the script source ASCII-safe while still producing readable Chinese issues.

param(
  [string]$Repo = "wuhuairline0727/fip-cli",
  [string]$WorkDir = $PSScriptRoot,
  [string]$TokenFile = "$env:USERPROFILE/.config/gh/cron-token",
  [string]$LogFile = "$PSScriptRoot/bug-scan.log",
  [string]$I18nFile = "$PSScriptRoot/bug-scan-i18n.json"
)

$ErrorActionPreference = "Continue"
$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# --- Banner so log shows the script was actually reached ---
$banner = "[$ts] START bug-scan pid=$PID psh=$($PSVersionTable.PSVersion)"
Add-Content -Path $LogFile -Value $banner -Encoding UTF8
Write-Output $banner

# --- Load i18n strings (loaded lazily, fallback to English keys) ---
$i18n = @{}
if (Test-Path $I18nFile) {
  try {
    $i18n = Get-Content $I18nFile -Raw -Encoding UTF8 | ConvertFrom-Json
  } catch {
    Write-Output "[$ts] WARN: i18n load failed, using fallbacks: $_"
  }
}
function I($key, $fallback) {
  $val = $i18n.PSObject.Properties[$key]
  if ($val) { return $val.Value } else { return $fallback }
}

# --- Load token (explicit UTF-8 to avoid GBK mangling on zh-CN systems) ---
$token = ""
if (Test-Path $TokenFile) {
  $token = (Get-Content $TokenFile -Raw -Encoding UTF8 -ErrorAction SilentlyContinue).Trim()
}

if (-not $token) {
  $line = "[$ts] ABORT: token file missing or empty at $TokenFile"
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
  Write-Output $line
  exit 1
}

# --- Inject token for gh CLI child process ---
[Environment]::SetEnvironmentVariable("GH_TOKEN", $token, "Process")
[Environment]::SetEnvironmentVariable("GITHUB_TOKEN", $token, "Process")
$env:GH_TOKEN = $token
$env:GITHUB_TOKEN = $token

Set-Location $WorkDir
git fetch origin --quiet 2>&1 | Out-Null

# === Phase 1: static analysis ===
# Each finding is a hashtable with: severity, source, detail (raw), rich (structured)
$findings = @()

# Helper: capture last N lines of an external command's combined output.
function Run-Step([string]$name, [string]$severity) {
  $output = & npm run $name 2>&1 | Out-String
  $exit = $LASTEXITCODE
  $lines = ($output -split "`r?`n" | Where-Object { $_.Trim() -ne '' })
  $tail = ($lines | Select-Object -Last 30) -join "`n"
  if ($exit -ne 0) {
    return [pscustomobject]@{
      severity = $severity
      source = $name
      rawTail = $tail
      rich = $null
    }
  }
  return $null
}

# 1a. Lint
$f = Run-Step 'lint' 'error'
if ($f) { $findings += $f }

# 1b. Format check
$f = Run-Step 'format:check' 'warn'
if ($f) { $findings += $f }

# 1c. Unit tests
$f = Run-Step 'test' 'error'
if ($f) { $findings += $f }

# 1d. Security audit: produce ONE finding per affected package so the issue body can list
# package name, current version, severity, vulnerability title, fix range, and advisory URL.
$auditJson = & npm audit --json 2>&1 | Out-String
try {
  $parsed = $auditJson | ConvertFrom-Json -ErrorAction SilentlyContinue
  $vulnMap = $parsed.vulnerabilities
  if ($vulnMap) {
    foreach ($pkgName in ($vulnMap.PSObject.Properties | ForEach-Object { $_.Name })) {
      $v = $vulnMap.$pkgName
      $sev = $v.severity
      if ($sev -ne 'high' -and $sev -ne 'critical') { continue }
      $advisories = @()
      if ($v.via) {
        foreach ($via in $v.via) {
          if ($via -is [string]) { continue }  # skip package-name strings (transitive parents)
          $advisories += [pscustomobject]@{
            title    = $via.title
            severity = $via.severity
            url      = $via.url
            range    = $via.range
          }
        }
      }
      $findings += [pscustomobject]@{
        severity = 'error'
        source   = 'audit'
        rawTail  = ''
        rich     = [pscustomobject]@{
          pkgName    = $pkgName
          severity   = $sev
          installedRange = $v.range
          fixAvailable    = $v.fixAvailable
          advisories      = $advisories
          viaParents      = @($v.via | Where-Object { $_ -is [string] })
        }
      }
    }
  }
} catch {}

# === Phase 2: summarize + dedup + create issue ===
if ($findings.Count -eq 0) {
  $line = "[$ts] OK: no new bugs found (lint+test+format+audit clean)"
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
  Write-Output $line
  Remove-Item Env:GH_TOKEN -ErrorAction SilentlyContinue
  Remove-Item Env:GITHUB_TOKEN -ErrorAction SilentlyContinue
  exit 0
}

# --- Dedup: list existing open issues by title ---
$existingTitles = @()
$dedupOk = $false
try {
  $listOutput = & gh issue list --repo $Repo --state open --limit 200 --json title 2>&1
  $listExit = $LASTEXITCODE
  if ($listExit -ne 0) {
    $line = "[$ts] WARN: gh issue list failed exit=$listExit, output=$($listOutput -join ' ')"
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
    Write-Output $line
  } else {
    $json = ($listOutput -join "`n") | Out-String
    $arr = $json | ConvertFrom-Json -ErrorAction Stop
    $existingTitles = @($arr | ForEach-Object { $_.title })
    $dedupOk = $true
    $line = "[$ts] INFO: dedup loaded $($existingTitles.Count) open issue titles"
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
    Write-Output $line
  }
} catch {
  $line = "[$ts] WARN: dedup parse failed: $_"
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
  Write-Output $line
}

# --- Build issue body for one finding ---
function Format-Severity([string]$s) {
  switch ($s) {
    'critical' { return I 'severityCritical' 'critical' }
    'high'     { return I 'severityHigh'     'high' }
    'moderate' { return I 'severityModerate' 'moderate' }
    'low'      { return I 'severityLow'      'low' }
    'error'    { return I 'severityError'    'error' }
    'warn'     { return I 'severityWarn'     'warn' }
    default    { return $s }
  }
}

function Build-Body($f) {
  $nl = [Environment]::NewLine
  $sb = New-Object System.Text.StringBuilder

  $null = $sb.AppendLine((I 'sectionFindings' '## Auto-detected finding'))
  $null = $sb.AppendLine()
  # NOTE: Use [string]::Format instead of `"... {0} ..." -f ...`. PowerShell 5.1 sometimes
  # mis-tokenizes double-quoted strings containing `{N}` placeholders when followed by
  # `-f` and a complex argument list, causing ParserError before the line runs.
  $null = $sb.AppendLine(([string]::Format('- **{0}**: {1}', (I 'fieldSource' 'Source'), $f.source)))
  $null = $sb.AppendLine(([string]::Format('- **{0}**: {1}', (I 'fieldSeverity' 'Severity'), (Format-Severity $f.severity))))
  $null = $sb.AppendLine(([string]::Format('- **{0}**: {1}', (I 'fieldTime' 'Time'), $ts)))
  $null = $sb.AppendLine()

  if ($f.source -eq 'audit' -and $f.rich) {
    # Structured audit finding: one table per package listing advisories.
    $null = $sb.AppendLine((I 'sectionPackages' '## Affected packages'))
    $null = $sb.AppendLine()
    $r = $f.rich
    $null = $sb.AppendLine(([string]::Format('- **{0}**: `{1}`', (I 'colPackage' 'Package'), $r.pkgName)))
    $null = $sb.AppendLine(([string]::Format('- **{0}**: {1}', (I 'colSeverity' 'Severity'), (Format-Severity $r.severity))))
    if ($r.installedRange) {
      $null = $sb.AppendLine(([string]::Format('- **{0}**: `{1}`', (I 'colInstalled' 'Installed range'), $r.installedRange)))
    }
    if ($r.fixAvailable -and $r.fixAvailable -ne $false) {
      $null = $sb.AppendLine(([string]::Format('- **{0}**: `{1}`', (I 'colFixTo' 'Fix available in'), $r.fixAvailable)))
    } elseif ($r.fixAvailable -eq $false) {
      $null = $sb.AppendLine(([string]::Format('- **{0}**: (no patch yet)', (I 'colFixTo' 'Fix available in'))))
    }
    if ($r.viaParents -and $r.viaParents.Count -gt 0) {
      $null = $sb.AppendLine(([string]::Format('- **{0}**: {1}', (I 'colVia' 'Reached via'), ($r.viaParents -join ', '))))
    }
    $null = $sb.AppendLine()
    if ($r.advisories -and $r.advisories.Count -gt 0) {
      foreach ($a in $r.advisories) {
        $null = $sb.AppendLine(([string]::Format('- **{0}**: {1}', (I 'colTitle' 'Advisory title'), $a.title)))
        if ($a.url) {
          $null = $sb.AppendLine(([string]::Format('- **{0}**: {1}', (I 'colAdvisory' 'Advisory URL'), $a.url)))
        }
        $null = $sb.AppendLine()
      }
    }
  } else {
    # Generic finding (lint/test/format): show the tail of the command output.
    $null = $sb.AppendLine((I 'sectionDetail' '## Detail'))
    $null = $sb.AppendLine()
    $null = $sb.AppendLine('````')
    if ($f.rawTail) { $null = $sb.AppendLine($f.rawTail) }
    $null = $sb.AppendLine('````')
    $null = $sb.AppendLine()
  }

  # Remediation hint per source
  $null = $sb.AppendLine((I 'sectionRemediation' '## Suggested fix'))
  $null = $sb.AppendLine()
  switch ($f.source) {
    'audit'        { $null = $sb.AppendLine((I 'remediationAudit'  'Run `npm audit fix`.')) }
    'lint'         { $null = $sb.AppendLine((I 'remediationLint'   'Run `npm run lint -- --fix`.')) }
    'test'         { $null = $sb.AppendLine((I 'remediationTest'   'Run `npm test`.')) }
    'format:check' { $null = $sb.AppendLine((I 'remediationFormat' 'Run `npm run format`.')) }
    default        { $null = $sb.AppendLine(('Source: ' + $f.source)) }
  }
  $null = $sb.AppendLine()
  $null = $sb.AppendLine((I 'footer' 'Auto-generated by mavis cron bug-scan'))

  return $sb.ToString()
}

# --- For each finding, check dedup then create issue ---
foreach ($f in $findings) {
  # Build a more specific title for audit findings (include package name) so each package
  # dedups independently. Lint/test/format use the generic title.
  if ($f.source -eq 'audit' -and $f.rich) {
    $title = "[Bug] fip-cli audit $($f.rich.severity): $($f.rich.pkgName)"
  } else {
    $title = "[Bug] fip-cli $($f.source) failed: $($f.severity)"
  }

  if ($dedupOk -and ($existingTitles -contains $title)) {
    $line = "[$ts] SKIP: '$title' already exists in open issues"
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
    Write-Output $line
    continue
  }

  $body = Build-Body $f
  # Write body to a temp file and pass via --body-file to avoid PowerShell 5.1
  # mangling non-ASCII bytes when passing strings as command-line arguments to gh.
  # IMPORTANT: use a UTF-8 encoding instance without BOM — gh POSTs the file as the
  # request body verbatim, and a leading BOM breaks the Markdown rendering on GitHub.
  $safeTs = $ts -replace '[: ]', '-'
  # Sanitize $f.source for Windows filenames — replace ':' and '/' which are illegal
  $safeSource = $f.source -replace '[:/\\ ]', '-'
  $bodyFile = Join-Path $WorkDir ("scripts/.bugscan-body-$PID-$safeTs-$safeSource.md")
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  try {
    [System.IO.File]::WriteAllText($bodyFile, $body, $utf8NoBom)
  } catch {
    $line = "[$ts] FAIL (write-body): $($_.Exception.Message)"
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
    Write-Output $line
    continue
  }
  $ghArgs = @('issue','create','--repo',$Repo,'--title',$title,'--body-file',$bodyFile,'--label','bug')
  $output = & gh @ghArgs 2>&1 | Out-String
  Remove-Item $bodyFile -ErrorAction SilentlyContinue
  if ($LASTEXITCODE -eq 0) {
    $line = "[$ts] CREATED: $($output.Trim())"
  } else {
    $line = "[$ts] FAIL ($LASTEXITCODE): $output"
  }
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
  Write-Output $line
}

Remove-Item Env:GH_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:GITHUB_TOKEN -ErrorAction SilentlyContinue
exit 0
