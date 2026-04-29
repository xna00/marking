param(
    [string]$DestPath = "$env:LOCALAPPDATA\MarkingMaster\extension",
    [string[]]$UpdateUrls = @("https://marking.xna00.top/update.json", "https://marking.xna00.top/update.json"),
    [string]$EdgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    [string]$UserDataDir = "$env:LOCALAPPDATA\MarkingMaster\edge-profile"
)

$ErrorActionPreference = "Stop"

Write-Host "`n=== Marking Master Extension Launcher ==="

# Get update info
$info = $null
foreach ($url in $UpdateUrls) {
    try {
        Write-Host "Trying: $url"
        $info = Invoke-RestMethod $url -TimeoutSec 10
        break
    }
    catch {
        Write-Host "Failed: $url"
    }
}

if (-not $info) {
    Write-Host "Error: All update URLs failed"
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Remote version: $($info.version)"

# Check local version
$localManifestPath = Join-Path $DestPath "manifest.json"
$needDownload = $true

if (Test-Path $localManifestPath) {
    try {
        $localManifest = Get-Content $localManifestPath | ConvertFrom-Json
        Write-Host "Local version: $($localManifest.version)"
        if ($localManifest.version -eq $info.version) {
            Write-Host "Already up to date"
            $needDownload = $false
        }
    }
    catch {
        Write-Host "Will download"
    }
}

# Download and install
if ($needDownload) {
    Write-Host "Downloading..."
    $zipPath = Join-Path $env:TEMP "extension.zip"
    $extractPath = Join-Path $env:TEMP "extension_extract"

    Invoke-WebRequest $info.extensionUrl -OutFile $zipPath

    if (Test-Path $extractPath) {
        Remove-Item -Path $extractPath -Recurse -Force
    }

    Expand-Archive -Path $zipPath -DestinationPath $extractPath -Force

    $srcPath = $extractPath
    if (Test-Path (Join-Path $extractPath "dist\extension\manifest.json")) {
        $srcPath = Join-Path $extractPath "dist\extension"
    }
    elseif (Test-Path (Join-Path $extractPath "extension\manifest.json")) {
        $srcPath = Join-Path $extractPath "extension"
    }

    Write-Host "Source: $srcPath"

    if (-not (Test-Path $DestPath)) {
        New-Item -Path $DestPath -ItemType Directory -Force | Out-Null
    }

    Get-ChildItem -Path $srcPath -Recurse | ForEach-Object {
        $dest = $_.FullName.Replace($srcPath, $DestPath)
        if ($_.PSIsContainer) {
            if (-not (Test-Path $dest)) {
                New-Item -Path $dest -ItemType Directory -Force | Out-Null
            }
        }
        else {
            Copy-Item -Path $_.FullName -Destination $dest -Force
        }
    }

    Remove-Item $zipPath
    Remove-Item $extractPath -Recurse -Force

    Write-Host "Updated successfully"
}

# Create user data directory if needed
if (-not (Test-Path $UserDataDir)) {
    New-Item -Path $UserDataDir -ItemType Directory -Force | Out-Null
}

# Launch Edge with extension and separate profile
Write-Host "`nStarting Edge..."
Write-Host "Extension path: $DestPath"
Write-Host "User data dir: $UserDataDir"
Write-Host "Opening URL: https://www.wylkyj.com/yuejuan/#/projectList"

Start-Process -FilePath $EdgePath -ArgumentList @(
    "--load-extension=`"$DestPath`"",
    "--user-data-dir=`"$UserDataDir`"",
    "--no-first-run",
    "--no-default-browser-check",
    "https://www.wylkyj.com/yuejuan/#/projectList"
)

Write-Host "`nDone! Edge should open with the extension loaded."
Write-Host "If you don't see the extension icon, check: chrome://extensions/"
