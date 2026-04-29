param(
    [string]$DestPath = "$env:LOCALAPPDATA\MarkingMaster\extension",
    [string[]]$UpdateUrls = @("https://marking.xna00.top/update.json", "https://marking.xna00.top/update.json"),
    [string]$EdgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    [string]$UserDataDir = "$env:LOCALAPPDATA\MarkingMaster\edge-profile"
)

$ErrorActionPreference = "Stop"

Write-Host "`n=== 改卷仙人扩展启动器 ==="

$info = $null
foreach ($url in $UpdateUrls) {
    try {
        Write-Host "正在尝试: $url"
        $ts = Get-Date -UFormat %s
        $urlWithTs = $url + "?t=" + $ts
        $info = Invoke-RestMethod $urlWithTs -TimeoutSec 10
        break
    }
    catch {
        Write-Host "连接失败: $url"
    }
}

if (-not $info) {
    Write-Host "错误: 所有更新地址都无法连接"
    Read-Host "按回车键退出"
    exit 1
}

Write-Host "远程版本: $($info.version)"

$localManifestPath = Join-Path $DestPath "manifest.json"
$needDownload = $true

if (Test-Path $localManifestPath) {
    try {
        $localManifest = Get-Content $localManifestPath | ConvertFrom-Json
        Write-Host "本地版本: $($localManifest.version)"
        if ($localManifest.version -eq $info.version) {
            Write-Host "已是最新版本"
            $needDownload = $false
        }
    }
    catch {
        Write-Host "需要下载"
    }
}

if ($needDownload) {
    Write-Host "正在下载..."
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

    Write-Host "源路径: $srcPath"

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

    Write-Host "更新成功"
}

if (-not (Test-Path $UserDataDir)) {
    New-Item -Path $UserDataDir -ItemType Directory -Force | Out-Null
}

# 只在需要更新时才关闭已运行的 Edge 进程
if ($needDownload) {
    $edgeProcesses = Get-Process -Name "msedge" -ErrorAction SilentlyContinue
    if ($edgeProcesses) {
        foreach ($proc in $edgeProcesses) {
            try {
                $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)").CommandLine
                if ($cmdLine -and $cmdLine -like "*$UserDataDir*") {
                    Write-Host "正在关闭已运行的 Edge 以加载更新..."
                    Stop-Process -Id $proc.Id -Force
                    Start-Sleep -Milliseconds 500
                }
            }
            catch {}
        }
    }
}

Write-Host "`n正在启动 Edge..."
Write-Host "扩展路径: $DestPath"
Write-Host "用户数据目录: $UserDataDir"
Write-Host "打开网址: https://www.wylkyj.com/yuejuan/#/projectList"

Start-Process -FilePath $EdgePath -ArgumentList @(
    "--load-extension=`"$DestPath`"",
    "--user-data-dir=`"$UserDataDir`"",
    "--no-first-run",
    "--no-default-browser-check",
    "https://www.wylkyj.com/yuejuan/#/projectList"
)

Write-Host "`n完成! Edge 应该已打开并加载扩展。"
Write-Host "如果看不到扩展图标，请检查: chrome://extensions/"

Write-Host "`n5秒后自动关闭..."
Start-Sleep -Seconds 5

