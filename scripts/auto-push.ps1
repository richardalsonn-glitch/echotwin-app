param(
  [int]$IntervalSeconds = 5,
  [int]$DebounceSeconds = 15,
  [string]$MessagePrefix = "auto-sync"
)

$ErrorActionPreference = "Stop"

function Invoke-Git {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)

  & git @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
  }
}

function Get-GitStatus {
  git status --porcelain
}

function Sync-Changes {
  $status = Get-GitStatus
  if ([string]::IsNullOrWhiteSpace($status)) {
    return
  }

  Write-Host "Changes detected. Committing and pushing..."
  Invoke-Git add -A

  $staged = git diff --cached --name-only
  if ([string]::IsNullOrWhiteSpace($staged)) {
    Write-Host "Only ignored files changed. Waiting..."
    return
  }

  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Invoke-Git commit -m "$MessagePrefix $timestamp"
  Invoke-Git pull --rebase
  Invoke-Git push

  Write-Host "Pushed at $timestamp"
}

Write-Host "Watching this repository for changes."
Write-Host "Press Ctrl+C to stop. Commits are pushed after $DebounceSeconds seconds without new changes."

$pendingSince = $null
$lastStatus = ""

while ($true) {
  $status = Get-GitStatus

  if ([string]::IsNullOrWhiteSpace($status)) {
    $pendingSince = $null
    $lastStatus = ""
    Start-Sleep -Seconds $IntervalSeconds
    continue
  }

  if ($status -ne $lastStatus) {
    $pendingSince = Get-Date
    $lastStatus = $status
  }

  $elapsed = ((Get-Date) - $pendingSince).TotalSeconds
  if ($elapsed -ge $DebounceSeconds) {
    Sync-Changes
    $pendingSince = $null
    $lastStatus = ""
  }

  Start-Sleep -Seconds $IntervalSeconds
}
