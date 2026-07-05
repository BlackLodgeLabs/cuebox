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
#   .\scripts\cursor-workflow-list-agents.ps1 -CapOnly   # fast: cap count only
#
# Requires: curl.exe (Windows 10+), .env with CURSOR_API_KEY (or set $env:CURSOR_API_KEY)

[CmdletBinding()]
param(
    [string]$Repository = $(if ($env:GITHUB_REPOSITORY) { $env:GITHUB_REPOSITORY } else { "BlackLodgeLabs/cuebox" }),
    [string]$EnvFile = ".env",
    [string]$ApiKey = "",
    [switch]$AllRepos,
    [switch]$CapOnly,
    [int]$MaxActiveCap = $(if ($env:CURSOR_WORKFLOW_MAX_ACTIVE_AGENTS) { [int]$env:CURSOR_WORKFLOW_MAX_ACTIVE_AGENTS } else { 8 }),
    [int]$CurlTimeoutSeconds = 60
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
        [Parameter(Mandatory = $true)][string]$Key,
        [int]$TimeoutSeconds = $CurlTimeoutSeconds
    )

    $raw = curl.exe -sS --max-time $TimeoutSeconds -u "${Key}:" $Url
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

function Test-RunInFlight {
    param(
        [Parameter(Mandatory = $true)]$Run
    )

    return ($Run.status -eq "RUNNING") -or ($Run.status -eq "CREATING")
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
Write-Host "Workflow cap: $MaxActiveCap in-flight runs targeting this repo (run RUNNING or CREATING)"
Write-Host "Fetching agent workspaces from Cursor API (one run lookup per ACTIVE workspace)..."
Write-Host ""

$results = @()
$pageCursor = $null
$pageNum = 0
$capCount = 0
$activeChecked = 0
$activeTotal = 0

# Pass 1: collect ACTIVE list items (list endpoint includes status + latestRunId; no per-agent GET needed).
$activeItems = @()
do {
    $pageNum++
    Write-Host "  Listing page $pageNum..."

    $url = "https://api.cursor.com/v1/agents?limit=100"
    if ($pageCursor) {
        $url += "&cursor=$pageCursor"
    }

    $page = Invoke-CursorApi -Url $url -Key $key
    if ($page.items) {
        $activeItems += @($page.items | Where-Object { $_.status -eq "ACTIVE" })
    }

    $pageCursor = $page.nextCursor
} while ($pageCursor)

$activeTotal = $activeItems.Count
Write-Host "  Found $activeTotal ACTIVE agent(s). Checking latest runs..."
Write-Host ""

foreach ($item in $activeItems) {
    $activeChecked++
    $pct = if ($activeTotal -gt 0) { [int](100 * $activeChecked / $activeTotal) } else { 100 }
    Write-Progress -Activity "Cursor agents" -Status "$activeChecked / $activeTotal : $($item.id)" -PercentComplete $pct

    $runId = $item.latestRunId
    $runStatus = "-"
    $branches = ""
    $countsTowardCap = $false

    if ($runId) {
        $runUrl = "https://api.cursor.com/v1/agents/$($item.id)/runs/$runId"
        $run = Invoke-CursorApi -Url $runUrl -Key $key
        $runStatus = $run.status
        $branches = Get-RunBranchesForRepo -Run $run -RepoSlug $repoSlug
        $countsTowardCap = (Test-RunInFlight -Run $run) -and (Test-RunTargetsRepo -Run $run -RepoSlug $repoSlug)
    }

    if ($countsTowardCap) {
        $capCount++
    }

    if (-not $CapOnly -and ($AllRepos -or $branches)) {
        $capFlag = if ($countsTowardCap) { "yes" } else { "" }
        $results += [PSCustomObject]@{
            AgentId     = $item.id
            AgentStatus = $item.status
            RunStatus   = $runStatus
            CountsToCap = $capFlag
            Name        = $item.name
            Branch      = $branches
            RunId       = $runId
            Url         = "https://cursor.com/agents/$($item.id)"
        }
    }
}

Write-Progress -Activity "Cursor agents" -Completed

if (-not $CapOnly) {
    if ($results.Count -eq 0) {
        if ($AllRepos) {
            Write-Host "No ACTIVE agents found."
        }
        else {
            Write-Host "No ACTIVE agents found targeting $repoSlug."
        }
    }
    else {
        $results |
            Sort-Object CountsToCap, RunStatus, AgentId -Descending |
            Format-Table -AutoSize AgentId, AgentStatus, RunStatus, CountsToCap, Name, Branch, RunId
    }
}

Write-Host ""
Write-Host "Summary"
Write-Host "-------"
Write-Host "ACTIVE in account : $activeTotal"
if (-not $CapOnly) {
    Write-Host "Listed rows       : $($results.Count)"
}
Write-Host "In-flight (repo)  : $capCount / $MaxActiveCap"
if ($capCount -ge $MaxActiveCap) {
    Write-Host "Handoff status    : AT CAP - new spawns will defer (at-cap)"
}
else {
    $room = $MaxActiveCap - $capCount
    Write-Host "Handoff status    : OK - room for $room more spawn(s)"
}
Write-Host ""
Write-Host "Note: Cap counts runs with status RUNNING/CREATING targeting this repo."
Write-Host "      Agent workspaces stay ACTIVE after FINISHED; archive old workspaces to tidy the UI."
Write-Host 'Archive example: curl.exe -sS -X POST -u "$env:CURSOR_API_KEY:" https://api.cursor.com/v1/agents/AGENT_ID/archive'
