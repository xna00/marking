#include <windows.h>
#include <tlhelp32.h>
#include <psapi.h>
#include <shlobj.h>
#include <shobjidl.h>
#include <winhttp.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <fcntl.h>
#include <io.h>

#pragma comment(lib, "psapi.lib")

#pragma comment(lib, "winhttp.lib")
#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "shell32.lib")

/* Define COM IIDs manually to avoid linking with -luuid */
const IID IID_IShellLinkW = {0x000214F9, 0x0000, 0x0000, {0xC0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x46}};
const IID IID_IPersistFile = {0x0000010B, 0x0000, 0x0000, {0xC0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x46}};

#define APP_NAME L"改卷仙人"
#define APP_DIR_NAME L"MarkingMaster"
#define BAT_FILE_NAME L"MarkingMaster.bat"
#define DEFAULT_UPDATE_URL L"https://marking.xna00.top/update.json"
#define DEFAULT_EDGE_PATH L"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
#define OPEN_URL1 L"https://www.wylkyj.com/yuejuan/#/projectList"
#define OPEN_URL2 L"https://marking.xna00.top/"

static WCHAR g_localAppData[MAX_PATH];
static WCHAR g_appDataDir[MAX_PATH];
static WCHAR g_destPath[MAX_PATH];
static WCHAR g_userDataDir[MAX_PATH];
static WCHAR g_edgePath[MAX_PATH];
static WCHAR g_installedBatPath[MAX_PATH];
static WCHAR g_installedExePath[MAX_PATH];
static WCHAR g_exePath[MAX_PATH];
static BOOL g_uninstall = FALSE;
static BOOL g_noInstall = FALSE;

static void PrintColor(WORD color, const WCHAR* fmt, ...) {
    HANDLE hConsole = GetStdHandle(STD_OUTPUT_HANDLE);
    CONSOLE_SCREEN_BUFFER_INFO info;
    GetConsoleScreenBufferInfo(hConsole, &info);
    SetConsoleTextAttribute(hConsole, color);
    va_list args;
    va_start(args, fmt);
    vwprintf(fmt, args);
    va_end(args);
    SetConsoleTextAttribute(hConsole, info.wAttributes);
}

static void PrintError(const WCHAR* fmt, ...) {
    PrintColor(FOREGROUND_RED | FOREGROUND_INTENSITY, L"\n错误: ");
    va_list args;
    va_start(args, fmt);
    vwprintf(fmt, args);
    va_end(args);
    wprintf(L"\n\n按回车键退出...");
    getchar();
    exit(1);
}

static void InitPaths(void) {
    SHGetFolderPathW(NULL, CSIDL_LOCAL_APPDATA, NULL, 0, g_localAppData);
    swprintf(g_appDataDir, MAX_PATH, L"%ls\\%ls", g_localAppData, APP_DIR_NAME);
    swprintf(g_destPath, MAX_PATH, L"%ls\\extension", g_appDataDir);
    swprintf(g_userDataDir, MAX_PATH, L"%ls\\edge-profile", g_appDataDir);
    wcscpy(g_edgePath, DEFAULT_EDGE_PATH);
    swprintf(g_installedBatPath, MAX_PATH, L"%ls\\%ls", g_appDataDir, BAT_FILE_NAME);
    swprintf(g_installedExePath, MAX_PATH, L"%ls\\%ls.exe", g_appDataDir, APP_DIR_NAME);
    GetModuleFileNameW(NULL, g_exePath, MAX_PATH);
}

static void ParseArgs(int argc, wchar_t** argv) {
    for (int i = 1; i < argc; i++) {
        if (_wcsicmp(argv[i], L"-Uninstall") == 0 || _wcsicmp(argv[i], L"/Uninstall") == 0) {
            g_uninstall = TRUE;
        } else if (_wcsicmp(argv[i], L"-NoInstall") == 0 || _wcsicmp(argv[i], L"/NoInstall") == 0) {
            g_noInstall = TRUE;
        } else if (_wcsicmp(argv[i], L"-EdgePath") == 0 && i + 1 < argc) {
            wcscpy(g_edgePath, argv[++i]);
        }
    }
}

static BOOL CreateShortcut(const WCHAR* targetPath, const WCHAR* args, const WCHAR* shortcutPath, const WCHAR* desc) {
    HRESULT hr = CoInitialize(NULL);
    if (FAILED(hr)) return FALSE;
    
    IShellLinkW* pShellLink = NULL;
    hr = CoCreateInstance(&CLSID_ShellLink, NULL, CLSCTX_INPROC_SERVER, &IID_IShellLinkW, (void**)&pShellLink);
    if (SUCCEEDED(hr)) {
        pShellLink->lpVtbl->SetPath(pShellLink, targetPath);
        pShellLink->lpVtbl->SetArguments(pShellLink, args);
        pShellLink->lpVtbl->SetWorkingDirectory(pShellLink, g_appDataDir);
        pShellLink->lpVtbl->SetDescription(pShellLink, desc);
        
        IPersistFile* pPersistFile = NULL;
        hr = pShellLink->lpVtbl->QueryInterface(pShellLink, &IID_IPersistFile, (void**)&pPersistFile);
        if (SUCCEEDED(hr)) {
            hr = pPersistFile->lpVtbl->Save(pPersistFile, shortcutPath, TRUE);
            pPersistFile->lpVtbl->Release(pPersistFile);
        }
        pShellLink->lpVtbl->Release(pShellLink);
    }
    CoUninitialize();
    return SUCCEEDED(hr);
}

static void InstallApp(void) {
    wprintf(L"\n--- 安装 %ls ---\n", APP_NAME);
    
    CreateDirectoryW(g_appDataDir, NULL);
    
    CopyFileW(g_exePath, g_installedExePath, FALSE);
    wcscpy(g_exePath, g_installedExePath);
    
    WCHAR desktopPath[MAX_PATH], startMenuDir[MAX_PATH];
    SHGetFolderPathW(NULL, CSIDL_DESKTOP, NULL, 0, desktopPath);
    SHGetFolderPathW(NULL, CSIDL_APPDATA, NULL, 0, startMenuDir);
    
    WCHAR shortcutDesktop[MAX_PATH], shortcutStart[MAX_PATH], shortcutUninstall[MAX_PATH];
    swprintf(shortcutDesktop, MAX_PATH, L"%ls\\%ls.lnk", desktopPath, APP_NAME);
    swprintf(shortcutStart, MAX_PATH, L"%ls\\Microsoft\\Windows\\Start Menu\\Programs\\%ls\\%ls.lnk", startMenuDir, APP_NAME, APP_NAME);
    swprintf(shortcutUninstall, MAX_PATH, L"%ls\\Microsoft\\Windows\\Start Menu\\Programs\\%ls\\卸载 %ls.lnk", startMenuDir, APP_NAME, APP_NAME);
    
    WCHAR startMenuPath[MAX_PATH];
    swprintf(startMenuPath, MAX_PATH, L"%ls\\Microsoft\\Windows\\Start Menu\\Programs\\%ls", startMenuDir, APP_NAME);
    CreateDirectoryW(startMenuPath, NULL);
    
    CreateShortcut(g_exePath, L"-NoInstall", shortcutDesktop, APP_NAME);
    wprintf(L"已创建桌面快捷方式\n");
    
    CreateShortcut(g_exePath, L"-NoInstall", shortcutStart, APP_NAME);
    CreateShortcut(g_exePath, L"-Uninstall", shortcutUninstall, L"卸载");
    wprintf(L"已创建开始菜单快捷方式\n");
    
    wprintf(L"安装完成!\n");
}

static void KillEdgeProcesses(void) {
    HANDLE hSnapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (hSnapshot == INVALID_HANDLE_VALUE) return;
    
    PROCESSENTRY32W pe;
    pe.dwSize = sizeof(pe);
    if (Process32FirstW(hSnapshot, &pe)) {
        do {
            if (_wcsicmp(pe.szExeFile, L"msedge.exe") == 0) {
                HANDLE hProcess = OpenProcess(PROCESS_TERMINATE | PROCESS_QUERY_INFORMATION, FALSE, pe.th32ProcessID);
                if (hProcess) {
                    WCHAR cmdLine[MAX_PATH * 4] = {0};
                    DWORD size = sizeof(cmdLine);
                    if (GetProcessImageFileNameW(hProcess, cmdLine, size) > 0) {
                        if (wcsstr(cmdLine, L"edge-profile") != NULL || TRUE) {
                            wprintf(L"正在关闭 Edge...\n");
                            TerminateProcess(hProcess, 0);
                        }
                    }
                    CloseHandle(hProcess);
                }
            }
        } while (Process32NextW(hSnapshot, &pe));
    }
    CloseHandle(hSnapshot);
}

static void UninstallApp(void) {
    wprintf(L"\n--- 卸载 %ls ---\n", APP_NAME);
    
    WCHAR desktopPath[MAX_PATH], startMenuDir[MAX_PATH];
    SHGetFolderPathW(NULL, CSIDL_DESKTOP, NULL, 0, desktopPath);
    SHGetFolderPathW(NULL, CSIDL_APPDATA, NULL, 0, startMenuDir);
    
    WCHAR shortcutDesktop[MAX_PATH], startMenuPath[MAX_PATH];
    swprintf(shortcutDesktop, MAX_PATH, L"%ls\\%ls.lnk", desktopPath, APP_NAME);
    swprintf(startMenuPath, MAX_PATH, L"%ls\\Microsoft\\Windows\\Start Menu\\Programs\\%ls", startMenuDir, APP_NAME);
    
    DeleteFileW(shortcutDesktop);
    wprintf(L"已删除桌面快捷方式\n");
    
    WCHAR cmd[MAX_PATH * 2];
    swprintf(cmd, MAX_PATH * 2, L"rd /s /q \"%ls\"", startMenuPath);
    _wsystem(cmd);
    wprintf(L"已删除开始菜单\n");
    
    KillEdgeProcesses();
    Sleep(500);
    
    wprintf(L"\n卸载完成!\n");

    WCHAR batPath[MAX_PATH];
    GetTempPathW(MAX_PATH, batPath);
    wcscat(batPath, L"MarkingMaster_cleanup.bat");

    FILE* fBat = _wfopen(batPath, L"w");
    if (fBat) {
        fprintf(fBat,
            "@echo off\r\n"
            "timeout /t 2 /nobreak >nul\r\n"
            "rd /s /q \"%ls\"\r\n"
            "del /f /q \"%%~f0\"\r\n",
            g_appDataDir);
        fclose(fBat);

        STARTUPINFOW si = {0};
        si.cb = sizeof(si);
        PROCESS_INFORMATION pi;
        CreateProcessW(NULL, batPath, NULL, NULL, FALSE,
                       CREATE_NO_WINDOW, NULL, NULL, &si, &pi);
        CloseHandle(pi.hProcess);
        CloseHandle(pi.hThread);
    }

    exit(0);
}

static char* HttpGet(const WCHAR* url, DWORD* outSize) {
    WCHAR host[256] = {0}, path[1024] = {0};
    URL_COMPONENTSW uc = {0};
    uc.dwStructSize = sizeof(uc);
    uc.lpszHostName = host;
    uc.dwHostNameLength = 256;
    uc.lpszUrlPath = path;
    uc.dwUrlPathLength = 1024;
    
    if (!WinHttpCrackUrl(url, 0, 0, &uc)) return NULL;
    
    HINTERNET hSession = WinHttpOpen(L"MarkingMaster/1.0", WINHTTP_ACCESS_TYPE_DEFAULT_PROXY, NULL, NULL, 0);
    if (!hSession) return NULL;
    
    HINTERNET hConnect = WinHttpConnect(hSession, host, uc.nPort, 0);
    if (!hConnect) { WinHttpCloseHandle(hSession); return NULL; }
    
    HINTERNET hRequest = WinHttpOpenRequest(hConnect, L"GET", path, NULL, NULL, NULL, 
        (uc.nScheme == INTERNET_SCHEME_HTTPS) ? WINHTTP_FLAG_SECURE : 0);
    if (!hRequest) { WinHttpCloseHandle(hConnect); WinHttpCloseHandle(hSession); return NULL; }
    
    BOOL bResult = WinHttpSendRequest(hRequest, NULL, 0, NULL, 0, 0, 0);
    if (!bResult) { WinHttpCloseHandle(hRequest); WinHttpCloseHandle(hConnect); WinHttpCloseHandle(hSession); return NULL; }
    
    WinHttpReceiveResponse(hRequest, NULL);
    
    DWORD dwSize = 0, dwDownloaded = 0, dwTotalSize = 0;
    char* buffer = NULL;
    DWORD bufferSize = 0;
    
    do {
        dwSize = 0;
        WinHttpQueryDataAvailable(hRequest, &dwSize);
        if (dwSize == 0) break;
        
        buffer = realloc(buffer, bufferSize + dwSize + 1);
        if (!buffer) break;
        
        WinHttpReadData(hRequest, buffer + bufferSize, dwSize, &dwDownloaded);
        bufferSize += dwDownloaded;
        buffer[bufferSize] = 0;
    } while (dwSize > 0);
    
    WinHttpCloseHandle(hRequest);
    WinHttpCloseHandle(hConnect);
    WinHttpCloseHandle(hSession);
    
    if (outSize) *outSize = bufferSize;
    return buffer;
}

static BOOL DownloadFile(const WCHAR* url, const WCHAR* localPath) {
    DWORD size = 0;
    char* data = HttpGet(url, &size);
    if (!data) return FALSE;
    
    HANDLE hFile = CreateFileW(localPath, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
    if (hFile == INVALID_HANDLE_VALUE) { free(data); return FALSE; }
    
    DWORD written;
    WriteFile(hFile, data, size, &written, NULL);
    CloseHandle(hFile);
    free(data);
    return TRUE;
}

static BOOL ExtractZip(const WCHAR* zipPath, const WCHAR* destPath) {
    WCHAR cmd[MAX_PATH * 4];
    swprintf(cmd, MAX_PATH * 4, 
        L"powershell -NoProfile -Command \"Expand-Archive -Path '%ls' -DestinationPath '%ls' -Force\"", 
        zipPath, destPath);
    return _wsystem(cmd) == 0;
}

static char* FindJsonValue(const char* json, const char* key, int* outLen) {
    char searchKey[256];
    snprintf(searchKey, sizeof(searchKey), "\"%s\"", key);
    char* pos = strstr(json, searchKey);
    if (!pos) return NULL;
    
    pos = strchr(pos + strlen(searchKey), ':');
    if (!pos) return NULL;
    
    while (*pos && (*pos == ':' || *pos == ' ' || *pos == '\t')) pos++;
    
    if (*pos == '"') {
        pos++;
        char* end = strchr(pos, '"');
        if (end) {
            *outLen = (int)(end - pos);
            return pos;
        }
    } else if (*pos == '[') {
        int depth = 1;
        char* end = pos + 1;
        while (*end && depth > 0) {
            if (*end == '[') depth++;
            else if (*end == ']') depth--;
            end++;
        }
        *outLen = (int)(end - pos);
        return pos;
    }
    return NULL;
}

static void StartEdge(void) {
    WCHAR args[MAX_PATH * 4];
    swprintf(args, MAX_PATH * 4, 
        L"\"%ls\" --load-extension=\"%ls\" --user-data-dir=\"%ls\" --no-first-run --no-default-browser-check %ls %ls",
        g_edgePath, g_destPath, g_userDataDir, OPEN_URL1, OPEN_URL2);
    
    STARTUPINFOW si;
    memset(&si, 0, sizeof(si));
    si.cb = sizeof(si);
    PROCESS_INFORMATION pi;
    
    wprintf(L"\n正在启动 Edge...\n");
    wprintf(L"扩展路径: %ls\n", g_destPath);
    wprintf(L"用户数据目录: %ls\n", g_userDataDir);
    wprintf(L"\n完整命令行:\n%ls\n", args);
    
    if (CreateProcessW(NULL, args, NULL, NULL, FALSE, 0, NULL, NULL, &si, &pi)) {
        CloseHandle(pi.hProcess);
        CloseHandle(pi.hThread);
        wprintf(L"\n完成! Edge 应该已打开并加载扩展。\n");
    } else {
        PrintError(L"无法启动 Edge: %ls", g_edgePath);
    }
}

static void MainLogic(void) {
    wprintf(L"\n=== %ls 扩展启动器 ===\n", APP_NAME);
    
    char* json = HttpGet(DEFAULT_UPDATE_URL, NULL);
    if (!json) {
        PrintError(L"无法连接更新服务器");
    }
    
    int versionLen = 0;
    char* version = FindJsonValue(json, "version", &versionLen);
    if (version) {
        wprintf(L"远程版本: %.*hs\n", versionLen, version);
    }
    
    WCHAR localManifestPath[MAX_PATH];
    swprintf(localManifestPath, MAX_PATH, L"%ls\\manifest.json", g_destPath);
    
    BOOL needDownload = TRUE;
    WCHAR exeUrl[1024] = {0};
    HANDLE hManifest = CreateFileW(localManifestPath, GENERIC_READ, FILE_SHARE_READ, NULL, OPEN_EXISTING, 0, NULL);
    if (hManifest != INVALID_HANDLE_VALUE) {
        DWORD size = GetFileSize(hManifest, NULL);
        char* localJson = malloc(size + 1);
        DWORD read;
        ReadFile(hManifest, localJson, size, &read, NULL);
        localJson[read] = 0;
        CloseHandle(hManifest);
        
        int localVersionLen = 0;
        char* localVersion = FindJsonValue(localJson, "version", &localVersionLen);
        if (localVersion && version && localVersionLen == versionLen && 
            memcmp(localVersion, version, versionLen) == 0) {
            wprintf(L"已是最新版本\n");
            needDownload = FALSE;
        }
        free(localJson);
    }
    
    if (needDownload) {
        wprintf(L"正在下载...\n");
        
        int extUrlsLen = 0;
        char* extUrls = FindJsonValue(json, "extensionUrls", &extUrlsLen);
        if (!extUrls) {
            free(json);
            PrintError(L"无法找到扩展下载地址");
        }
        
        char* urlStart = strchr(extUrls, '"');
        if (!urlStart) {
            free(json);
            PrintError(L"解析扩展地址失败");
        }
        urlStart++;
        char* urlEnd = strchr(urlStart, '"');
        if (!urlEnd) {
            free(json);
            PrintError(L"解析扩展地址失败");
        }
        
        int urlLen = (int)(urlEnd - urlStart);
        WCHAR extUrl[1024];
        MultiByteToWideChar(CP_UTF8, 0, urlStart, urlLen, extUrl, 1024);
        extUrl[urlLen] = 0;
        
        WCHAR zipPath[MAX_PATH], extractPath[MAX_PATH];
        GetTempPathW(MAX_PATH, zipPath);
        GetTempPathW(MAX_PATH, extractPath);
        wcscat(zipPath, L"extension.zip");
        wcscat(extractPath, L"extension_extract");
        
        wprintf(L"下载扩展: %ls\n", extUrl);
        if (!DownloadFile(extUrl, zipPath)) {
            free(json);
            PrintError(L"下载扩展失败");
        }
        
        wprintf(L"解压中...\n");
        ExtractZip(zipPath, extractPath);
        
        WCHAR srcPath[MAX_PATH];
        wcscpy(srcPath, extractPath);
        
        WCHAR testPath[MAX_PATH];
        swprintf(testPath, MAX_PATH, L"%ls\\dist\\extension\\manifest.json", extractPath);
        if (GetFileAttributesW(testPath) != INVALID_FILE_ATTRIBUTES) {
            swprintf(srcPath, MAX_PATH, L"%ls\\dist\\extension", extractPath);
        } else {
            swprintf(testPath, MAX_PATH, L"%ls\\extension\\manifest.json", extractPath);
            if (GetFileAttributesW(testPath) != INVALID_FILE_ATTRIBUTES) {
                swprintf(srcPath, MAX_PATH, L"%ls\\extension", extractPath);
            }
        }
        
        wprintf(L"源路径: %ls\n", srcPath);
        
        CreateDirectoryW(g_destPath, NULL);
        
        WCHAR copyCmd[MAX_PATH * 4];
        swprintf(copyCmd, MAX_PATH * 4, L"xcopy /E /Y /I \"%ls\\*\" \"%ls\"", srcPath, g_destPath);
        _wsystem(copyCmd);
        
        DeleteFileW(zipPath);
        swprintf(copyCmd, MAX_PATH * 4, L"rd /s /q \"%ls\"", extractPath);
        _wsystem(copyCmd);
        
        wprintf(L"更新成功\n");

        int exeUrlsLen = 0;
        char* exeUrls = FindJsonValue(json, "exeUrls", &exeUrlsLen);
        if (exeUrls) {
            char* urlStart = strchr(exeUrls, '"');
            if (urlStart) {
                urlStart++;
                char* urlEnd = strchr(urlStart, '"');
                if (urlEnd) {
                    int urlLen = (int)(urlEnd - urlStart);
                    MultiByteToWideChar(CP_UTF8, 0, urlStart, urlLen, exeUrl, 1024);
                }
            }
        }
    }
    
    free(json);
    
    CreateDirectoryW(g_userDataDir, NULL);
    
    if (needDownload) {
        KillEdgeProcesses();
        Sleep(500);
    }
    
    StartEdge();

    if (exeUrl[0]) {
        wprintf(L"下载 exe 更新: %ls\n", exeUrl);

        WCHAR newExePath[MAX_PATH], batPath[MAX_PATH];
        GetTempPathW(MAX_PATH, newExePath);
        GetTempPathW(MAX_PATH, batPath);
        wcscat(newExePath, L"MarkingMaster_new.exe");
        wcscat(batPath, L"MarkingMaster_update.bat");

        if (DownloadFile(exeUrl, newExePath)) {
            FILE* fBat = _wfopen(batPath, L"w");
            if (fBat) {
                fprintf(fBat,
                    "@echo off\r\n"
                    "timeout /t 3 /nobreak >nul\r\n"
                    "del /f /q \"%ls\"\r\n"
                    "move /y \"%ls\" \"%ls\"\r\n"
                    "del /f /q \"%%~f0\"\r\n",
                    g_exePath, newExePath, g_exePath);
                fclose(fBat);

                STARTUPINFOW si = {0};
                si.cb = sizeof(si);
                PROCESS_INFORMATION pi;
                if (CreateProcessW(NULL, batPath, NULL, NULL, FALSE,
                                   CREATE_NO_WINDOW, NULL, NULL, &si, &pi)) {
                    CloseHandle(pi.hProcess);
                    CloseHandle(pi.hThread);
                    wprintf(L"exe 已更新，即将重启...\n");
                }
            }
        }
    }

    wprintf(L"\n5秒后自动关闭本窗口...\n");
    Sleep(5000);
}

int wmain(int argc, wchar_t** argv) {
    SetConsoleCP(CP_UTF8);
    SetConsoleOutputCP(CP_UTF8);
    _setmode(_fileno(stdout), _O_U8TEXT);
    SetConsoleTitleW(APP_NAME L" 扩展启动器");
    
    InitPaths();
    ParseArgs(argc, argv);
    
    if (g_uninstall) {
        UninstallApp();
    }
    
    if (!g_noInstall) {
        InstallApp();
    }
    
    MainLogic();
    return 0;
}
