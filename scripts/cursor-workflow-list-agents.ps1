# List Cursor Cloud Agents and run status (Windows PowerShell 5.1+).
# Matches the repo filter used by cursor-workflow-count-active-agents.sh for the 8-agent cap.
#
# Usage (from repo root):
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\cursor-workflow-list-agents.ps1
#   .\scripts\cursor-workflow-list-agents.ps1
#
# Optional:
#   .\scripts\cursor-workflow-list-agents.ps1 -Repository BlackLodgeLabs/cuebox
#   .\scripts\cursor-workflow-list-agents.ps1 -AllRepos
#
# Requires: curl.exe (Windows 10+), .env with CURSOR_API_KEY (or set $env:CURSOR_API_KEY)

[CmdletBinding()]
param(
    [string]$Repository = $(if ($env:GITHUB_REPOSITORY) { $env:GITHUB_REPOSITORY } else { "BlackLodgeLabs/cuebox" }),
    [string]$EnvFile = ".env",
    [string]$ApiKey = "",
    [switch]$AllRepos,
    [int]$MaxActiveCap = $(if ($env:CURSOR_WORKFLOW_MAX_ACTIVE_AGENTS) { [int]$env:CURSOR_WORKFLOW_MAX_ACTIVE_AGENTS } else { 8 })
)

$ErrorActionPreference = "Stop"

function Get-DotEnvValue {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Env file not found: $Path"
    }

    $line = Get-Content -LiteralPath $Path |
        Where-Object { $_ -match "^\s*$([regex]::Escape($Name))=" } |
        Select-Object -First 1

    if (-not $line) {
        throw "$Name not found in $Path"
    }

    return ($line -replace "^\s*$([regex]::Escape($Name))=\s*", "" -replace '"', "").Trim()
}

function Invoke-CursorApi {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [Parameter(Mandatory = $true)][string]$Key
    )

    $raw = curl.exe -sS -u "${Key}:" $Url
    if ($LASTEXITCODE -ne 0) {
        throw "curl failed ($LASTEXITCODE) for $Url"
    }

    try {
        return $raw | ConvertFrom-Json
    }
    catch {
        throw "Invalid JSON from $Url : $raw"
    }
}

function Test-RunTargetsRepo {
    param(
        [Parameter(Mandatory = $true)]$Run,
        [Parameter(Mandatory = $true)][string]$RepoSlug
    )

    if (-not $Run.git -or -not $Run.git.branches) {
        return $false
    }

    return [bool]($Run.git.branches | Where-Object { $_.repoUrl -eq $RepoSlug })
}

function Get-RunBranchesForRepo {
    param(
        [Parameter(Mandatory = $true)]$Run,
        [Parameter(Mandatory = $true)][string]$RepoSlug
    )

    if (-not $Run.git -or -not $Run.git.branches) {
        return ""
    }

    return (($Run.git.branches |
        Where-Object { $_.repoUrl -eq $RepoSlug } |
        ForEach-Object { $_.branch }) -join ", ")
}

$key = if ($ApiKey) { $ApiKey.Trim() } elseif ($env:CURSOR_API_KEY) { $env:CURSOR_API_KEY.Trim() } else { Get-DotEnvValue -Name "CURSOR_API_KEY" -Path $EnvFile }
$repoSlug = "github.com/$Repository"

if ($AllRepos) {
    Write-Host "Repository filter: $repoSlug (showing all repos; cap column still uses filter above)"
}
else {
    Write-Host "Repository filter: $repoSlug"
}
Write-Host "Workflow cap: $MaxActiveCap ACTIVE agents targeting this repo (agent.status == ACTIVE)"
Write-Host ""

$results = @()
$pageCursor = $null
$capCount = 0

do {
    $url = "https://api.cursor.com/v1/agents?limit=100"
    if ($pageCursor) {
        $url += "&cursor=$pageCursor"
    }

    $page = Invoke-CursorApi -Url $url -Key $key

    foreach ($item in $page.items) {
        $agentUrl = "https://api.cursor.com/v1/agents/$($item.id)"
        $agent = Invoke-CursorApi -Url $agentUrl -Key $key
        $runId = $agent.latestRunId
        $runStatus = "-"
        $branches = ""
        $countsTowardCap = $false

        if ($runId) {
            $runUrl = "https://api.cursor.com/v1/agents/$($item.id)/runs/$runId"
            $run = Invoke-CursorApi -Url $runUrl -Key $key
            $runStatus = $run.status
            $branches = Get-RunBranchesForRepo -Run $run -RepoSlug $repoSlug
            $countsTowardCap = ($agent.status -eq "ACTIVE") -and (Test-RunTargetsRepo -Run $run -RepoSlug $repoSlug)
        }

        if ($countsTowardCap) {
            $capCount++
        }

        if ($AllRepos -or $branches) {
            $capFlag = if ($countsTowardCap) { "yes" } else { "" }
            $results += [PSCustomObject]@{
                AgentId     = $item.id
                AgentStatus = $agent.status
                RunStatus   = $runStatus
                CountsToCap = $capFlag
                Name        = $agent.name
                Branch      = $branches
                RunId       = $runId
                Url         = "https://cursor.com/agents/$($item.id)"
            }
        }
    }

    $pageCursor = $page.nextCursor
} while ($pageCursor)

if ($results.Count -eq 0) {
    if ($AllRepos) {
        Write-Host "No agents found."
    }
    else {
        Write-Host "No agents found targeting $repoSlug."
    }
}
else {
    $results |
        Sort-Object CountsToCap, RunStatus, AgentId -Descending |
        Format-Table -AutoSize AgentId, AgentStatus, RunStatus, CountsToCap, Name, Branch, RunId
}

Write-Host ""
Write-Host "Summary"
Write-Host "-------"
Write-Host "Listed rows       : $($results.Count)"
Write-Host "Cap count (repo)  : $capCount / $MaxActiveCap"
if ($capCount -ge $MaxActiveCap) {
    Write-Host "Handoff status    : AT CAP - new spawns will defer (at-cap)"
}
else {
    $room = $MaxActiveCap - $capCount
    Write-Host "Handoff status    : OK - room for $room more spawn(s)"
}
Write-Host ""
Write-Host "Note: Cap uses agent.status ACTIVE + latest run targets repo, not run RUNNING."
Write-Host 'Archive example: curl.exe -sS -X POST -u "$env:CURSOR_API_KEY:" https://api.cursor.com/v1/agents/AGENT_ID/archive'
