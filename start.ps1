param(
    [switch]$Uninstall,
    [switch]$NoInstall,
    [string]$DestPath = "$env:LOCALAPPDATA\MarkingMaster\extension",
    [string[]]$UpdateUrls = @("https://marking.xna00.top/update.json", "https://marking.xna00.top/update.json"),
    [string]$EdgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    [string]$UserDataDir = "$env:LOCALAPPDATA\MarkingMaster\edge-profile"
)

# 从环境变量读取参数（用于 bat 文件调用）
if ($env:MARKING_ARGS) {
    $argsList = $env:MARKING_ARGS.Split(" ", [System.StringSplitOptions]::RemoveEmptyEntries)
    foreach ($arg in $argsList) {
        switch ($arg) {
            "-Uninstall" { $Uninstall = $true }
            "-NoInstall" { $NoInstall = $true }
        }
    }
}

$ErrorActionPreference = "Stop"

trap {
    Write-Host "`n错误: $_" -ForegroundColor Red
    Write-Host "`n按回车键退出..."
    Read-Host
    exit 1
}
$AppDataDir = "$env:LOCALAPPDATA\MarkingMaster"
$AppName = "改卷仙人"
$BatFileName = "MarkingMaster.bat"
$InstalledBatPath = Join-Path $AppDataDir $BatFileName

function Install-App {
    Write-Host "`n--- 安装 $AppName ---"

    if (-not (Test-Path $AppDataDir)) {
        New-Item -Path $AppDataDir -ItemType Directory -Force | Out-Null
    }

    $BatSource = $env:MARKING_BAT_PATH
    if ($BatSource -and (Test-Path $BatSource) -and ($BatSource -ne $InstalledBatPath)) {
        Copy-Item -Path $BatSource -Destination $InstalledBatPath -Force
        Write-Host "已复制脚本到程序目录"
    }

    $WshShell = New-Object -ComObject WScript.Shell

    $DesktopShortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\$AppName.lnk")
    $DesktopShortcut.TargetPath = $InstalledBatPath
    $DesktopShortcut.Arguments = "-NoInstall"
    $DesktopShortcut.WorkingDirectory = $AppDataDir
    $DesktopShortcut.Description = $AppName
    $DesktopShortcut.Save()
    Write-Host "已创建桌面快捷方式"

    $StartMenuDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\$AppName"
    if (-not (Test-Path $StartMenuDir)) {
        New-Item -Path $StartMenuDir -ItemType Directory -Force | Out-Null
    }

    $StartShortcut = $WshShell.CreateShortcut("$StartMenuDir\$AppName.lnk")
    $StartShortcut.TargetPath = $InstalledBatPath
    $StartShortcut.Arguments = "-NoInstall"
    $StartShortcut.WorkingDirectory = $AppDataDir
    $StartShortcut.Description = $AppName
    $StartShortcut.Save()

    $UninstallShortcut = $WshShell.CreateShortcut("$StartMenuDir\卸载 $AppName.lnk")
    $UninstallShortcut.TargetPath = $InstalledBatPath
    $UninstallShortcut.Arguments = "-Uninstall"
    $UninstallShortcut.WorkingDirectory = $AppDataDir
    $UninstallShortcut.Description = "卸载 $AppName"
    $UninstallShortcut.Save()
    Write-Host "已创建开始菜单快捷方式"

    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($WshShell) | Out-Null

    Write-Host "安装完成!"
}

function Uninstall-App {
    Write-Host "`n--- 卸载 $AppName ---"

    $DesktopShortcut = "$env:USERPROFILE\Desktop\$AppName.lnk"
    if (Test-Path $DesktopShortcut) {
        Remove-Item $DesktopShortcut -Force
        Write-Host "已删除桌面快捷方式"
    }

    $StartMenuDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\$AppName"
    if (Test-Path $StartMenuDir) {
        Remove-Item $StartMenuDir -Recurse -Force
        Write-Host "已删除开始菜单"
    }

    $edgeProcesses = Get-Process -Name "msedge" -ErrorAction SilentlyContinue
    if ($edgeProcesses) {
        foreach ($proc in $edgeProcesses) {
            try {
                $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)").CommandLine
                if ($cmdLine -and $cmdLine -like "*$UserDataDir*") {
                    Write-Host "正在关闭 Edge..."
                    Stop-Process -Id $proc.Id -Force
                }
            }
            catch {}
        }
        Start-Sleep -Milliseconds 500
    }

    Write-Host "`n卸载完成!"
    
    if (Test-Path $InstalledBatPath) {
        Write-Host "正在清理..."
        $tempBat = Join-Path $env:TEMP "cleanup.bat"
        $batContent = "@echo off`r`ncd /d %TEMP%`r`ntimeout /t 2 /nobreak >nul`r`nrd /s /q `"$AppDataDir`"`r`ndel /f /q `"$tempBat`""
        [System.IO.File]::WriteAllText($tempBat, $batContent, [System.Text.Encoding]::UTF8)
        Start-Process cmd.exe -ArgumentList "/c `"$tempBat`"" -WindowStyle Hidden
    }
    
    exit 0
}

if ($Uninstall) {
    Uninstall-App
}

if (-not $NoInstall) {
    Install-App
}

Write-Host "`n=== $AppName 扩展启动器 ==="

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

    $extensionDownloaded = $false
    foreach ($extUrl in $info.extensionUrls) {
        try {
            Write-Host "下载扩展: $extUrl"
            Invoke-WebRequest $extUrl -OutFile $zipPath
            $extensionDownloaded = $true
            break
        }
        catch {
            Write-Host "下载失败: $extUrl"
        }
    }

    if (-not $extensionDownloaded) {
        Write-Host "错误: 所有扩展下载地址都失败"
        Read-Host "按回车键退出"
        exit 1
    }

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
Write-Host "打开网址: https://www.wylkyj.com/yuejuan/#/projectList, https://marking.xna00.top/"

Start-Process -FilePath $EdgePath -ArgumentList @(
    "--load-extension=`"$DestPath`"",
    "--user-data-dir=`"$UserDataDir`"",
    "--no-first-run",
    "--no-default-browser-check",
    "https://www.wylkyj.com/yuejuan/#/projectList",
    "https://marking.xna00.top/"
)

Write-Host "`n完成! Edge 应该已打开并加载扩展。"
Write-Host "如果看不到扩展图标，请检查: chrome://extensions/"

# 更新脚本本身
if ($needDownload -and $info.setupUrls) {
    foreach ($setupUrl in $info.setupUrls) {
        try {
            Write-Host "`n正在更新脚本: $setupUrl"
            Invoke-WebRequest $setupUrl -OutFile $InstalledBatPath -UseBasicParsing
            Write-Host "脚本更新成功"
            break
        }
        catch {
            Write-Host "脚本更新失败: $setupUrl"
        }
    }
}

Write-Host "`n5秒后自动关闭本窗口..."
Start-Sleep -Seconds 5
