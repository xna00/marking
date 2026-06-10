#include <windows.h>
#include <shlobj.h>
#include <winhttp.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <fcntl.h>
#include <io.h>
#include <minizip/unzip.h>
#include <minizip/iowin32.h>

const GUID CLSID_ShellLink = {0x00021401,0x0000,0x0000,{0xC0,0x00,0x00,0x00,0x00,0x00,0x00,0x46}};
const GUID IID_IShellLinkW = {0x000214F9,0x0000,0x0000,{0xC0,0x00,0x00,0x00,0x00,0x00,0x00,0x46}};
const GUID IID_IPersistFile = {0x0000010B,0x0000,0x0000,{0xC0,0x00,0x00,0x00,0x00,0x00,0x00,0x46}};

/* Forward declarations for file tree operations */
static BOOL DeleteFileTree(const WCHAR* path);

#define APP_NAME L"改卷仙人"
#define APP_DIR_NAME L"MarkingMaster"
#define DEFAULT_UPDATE_URL L"https://marking.xna00.top/update.json"
#define EDGE_PATHS_COUNT 3
static const WCHAR* const EDGE_PATHS[EDGE_PATHS_COUNT] = {
    L"C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    L"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    L"\\Microsoft\\Edge\\Application\\msedge.exe",  /* appended to %LOCALAPPDATA% at runtime */
};
#define OPEN_URL1 L"https://www.wylkyj.com/yuejuan/#/projectList"
#define OPEN_URL2 L"https://marking.xna00.top/"

/* %LOCALAPPDATA% */
static WCHAR g_localAppData[MAX_PATH];
/* %LOCALAPPDATA%\MarkingMaster */
static WCHAR g_appDataDir[MAX_PATH];
/* %LOCALAPPDATA%\MarkingMaster\extension */
static WCHAR g_destPath[MAX_PATH];
/* %LOCALAPPDATA%\MarkingMaster\edge-profile */
static WCHAR g_userDataDir[MAX_PATH];
/* Edge 浏览器路径 */
static WCHAR g_edgePath[MAX_PATH];
/* %LOCALAPPDATA%\MarkingMaster\MarkingMaster.exe */
static WCHAR g_installedExePath[MAX_PATH];

static BOOL g_uninstall = FALSE;
static BOOL g_noInstall = FALSE;

static void PrintError(const WCHAR* fmt, ...) {
    HANDLE hConsole = GetStdHandle(STD_OUTPUT_HANDLE);
    CONSOLE_SCREEN_BUFFER_INFO info;
    GetConsoleScreenBufferInfo(hConsole, &info);
    SetConsoleTextAttribute(hConsole, FOREGROUND_RED | FOREGROUND_INTENSITY);
    wprintf(L"\n错误: ");
    va_list args;
    va_start(args, fmt);
    vwprintf(fmt, args);
    va_end(args);
    SetConsoleTextAttribute(hConsole, info.wAttributes);
    wprintf(L"\n\n按回车键退出...");
    getchar();
    exit(1);
}

static void InitPaths(void) {
    SHGetFolderPathW(NULL, CSIDL_LOCAL_APPDATA, NULL, 0, g_localAppData);
    swprintf(g_appDataDir, MAX_PATH, L"%ls\\%ls", g_localAppData, APP_DIR_NAME);
    swprintf(g_destPath, MAX_PATH, L"%ls\\extension", g_appDataDir);
    swprintf(g_userDataDir, MAX_PATH, L"%ls\\edge-profile", g_appDataDir);
    swprintf(g_installedExePath, MAX_PATH, L"%ls\\%ls.exe", g_appDataDir, APP_DIR_NAME);

    /* auto-detect Edge path */
    BOOL found = FALSE;
    for (int i = 0; i < EDGE_PATHS_COUNT && !found; i++) {
        WCHAR fullPath[MAX_PATH];
        const WCHAR* path = EDGE_PATHS[i];
        if (i == EDGE_PATHS_COUNT - 1) {
            swprintf(fullPath, MAX_PATH, L"%ls%ls", g_localAppData, path);
            path = fullPath;
        }
        if (GetFileAttributesW(path) != INVALID_FILE_ATTRIBUTES) {
            wcscpy(g_edgePath, path);
            found = TRUE;
        }
    }
    if (!found)
        wcscpy(g_edgePath, EDGE_PATHS[1]);  /* fallback to 32-bit path */
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
    
    WCHAR curExe[MAX_PATH];
    GetModuleFileNameW(NULL, curExe, MAX_PATH);
    CopyFileW(curExe, g_installedExePath, FALSE);
    
    WCHAR desktopPath[MAX_PATH], startMenuDir[MAX_PATH];
    SHGetFolderPathW(NULL, CSIDL_DESKTOP, NULL, 0, desktopPath);
    SHGetFolderPathW(NULL, CSIDL_APPDATA, NULL, 0, startMenuDir);
    
    WCHAR shortcutDesktop[MAX_PATH], shortcutStart[MAX_PATH], shortcutUninstall[MAX_PATH];
    swprintf(shortcutDesktop, MAX_PATH, L"%ls\\%ls.lnk", desktopPath, APP_NAME);
    swprintf(shortcutStart, MAX_PATH, L"%ls\\Microsoft\\Windows\\Start Menu\\Programs\\%ls\\%ls.lnk", startMenuDir, APP_NAME, APP_NAME);
    swprintf(shortcutUninstall, MAX_PATH, L"%ls\\Microsoft\\Windows\\Start Menu\\Programs\\%ls\\卸载%ls.lnk", startMenuDir, APP_NAME, APP_NAME);
    
    WCHAR startMenuPath[MAX_PATH];
    swprintf(startMenuPath, MAX_PATH, L"%ls\\Microsoft\\Windows\\Start Menu\\Programs\\%ls", startMenuDir, APP_NAME);
    CreateDirectoryW(startMenuPath, NULL);
    
    CreateShortcut(g_installedExePath, L"-NoInstall", shortcutDesktop, APP_NAME);
    wprintf(L"已创建桌面快捷方式\n");
    
    CreateShortcut(g_installedExePath, L"-NoInstall", shortcutStart, APP_NAME);
    CreateShortcut(g_installedExePath, L"-Uninstall", shortcutUninstall, L"卸载");
    wprintf(L"已创建开始菜单快捷方式\n");
    
    wprintf(L"安装完成!\n");
}

static void KillEdgeProcesses(void) {
    WCHAR cmd[2048];
    swprintf(cmd, 2048,
        L"powershell -NoProfile -Command "
        L"\"Get-Process msedge -ErrorAction SilentlyContinue | "
        L"ForEach-Object { "
        L"  $cmd = (Get-CimInstance Win32_Process -Filter ('ProcessId=' + $_.Id)).CommandLine; "
        L"  if ($cmd -and $cmd.Contains('%ls')) { $_.Kill() } "
        L"}\"",
        g_userDataDir);
    STARTUPINFOW si = {0}; si.cb = sizeof(si);
    PROCESS_INFORMATION pi;
    if (CreateProcessW(NULL, cmd, NULL, NULL, FALSE, CREATE_NO_WINDOW, NULL, NULL, &si, &pi)) {
        WaitForSingleObject(pi.hProcess, 5000);
        CloseHandle(pi.hProcess);
        CloseHandle(pi.hThread);
    }
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
    
    DeleteFileTree(startMenuPath);
    wprintf(L"已删除开始菜单\n");
    
    KillEdgeProcesses();
    Sleep(500);

    /* exe 移到 TEMP 解除锁，然后删整个目录 */
    WCHAR tmpExe[MAX_PATH];
    GetTempPathW(MAX_PATH, tmpExe);
    wcscat(tmpExe, L"MarkingMaster_uninstalling.exe");
    MoveFileExW(g_installedExePath, tmpExe, MOVEFILE_REPLACE_EXISTING);
    DeleteFileTree(g_appDataDir);

    wprintf(L"\n卸载完成!\n");
    exit(0);
}

static char* HttpGet(const WCHAR* url, DWORD* outSize, const WCHAR* userAgent) {
    WCHAR urlBuf[MAX_PATH * 4];
    ULONGLONG ts = GetTickCount64();
    if (wcschr(url, L'?')) {
        swprintf(urlBuf, MAX_PATH * 4, L"%ls&t=%llu", url, ts);
    } else {
        swprintf(urlBuf, MAX_PATH * 4, L"%ls?t=%llu", url, ts);
    }

    WCHAR host[256] = {0}, path[1024] = {0};
    URL_COMPONENTSW uc = {0};
    uc.dwStructSize = sizeof(uc);
    uc.lpszHostName = host;
    uc.dwHostNameLength = 256;
    uc.lpszUrlPath = path;
    uc.dwUrlPathLength = 1024;
    
    if (!WinHttpCrackUrl(urlBuf, 0, 0, &uc)) return NULL;
    
    HINTERNET hSession = WinHttpOpen(userAgent, WINHTTP_ACCESS_TYPE_DEFAULT_PROXY, NULL, NULL, 0);
    if (!hSession) return NULL;
    
    HINTERNET hConnect = WinHttpConnect(hSession, host, uc.nPort, 0);
    if (!hConnect) { WinHttpCloseHandle(hSession); return NULL; }
    
    HINTERNET hRequest = WinHttpOpenRequest(hConnect, L"GET", path, NULL, NULL, NULL, 
        (uc.nScheme == INTERNET_SCHEME_HTTPS) ? WINHTTP_FLAG_SECURE : 0);
    if (!hRequest) { WinHttpCloseHandle(hConnect); WinHttpCloseHandle(hSession); return NULL; }
    
    BOOL bResult = WinHttpSendRequest(hRequest, NULL, 0, NULL, 0, 0, 0);
    if (!bResult) { WinHttpCloseHandle(hRequest); WinHttpCloseHandle(hConnect); WinHttpCloseHandle(hSession); return NULL; }
    
    WinHttpReceiveResponse(hRequest, NULL);
    
    DWORD dwSize = 0, dwDownloaded = 0;
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

static BOOL DownloadFile(const WCHAR* url, const WCHAR* localPath, const WCHAR* userAgent) {
    DWORD size = 0;
    char* data = HttpGet(url, &size, userAgent);
    if (!data) return FALSE;
    
    HANDLE hFile = CreateFileW(localPath, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
    if (hFile == INVALID_HANDLE_VALUE) { free(data); return FALSE; }
    
    DWORD written;
    WriteFile(hFile, data, size, &written, NULL);
    CloseHandle(hFile);
    free(data);
    return TRUE;
}

static BOOL CopyFileTree(const WCHAR* src, const WCHAR* dst) {
    WCHAR srcSearch[MAX_PATH * 2];
    swprintf(srcSearch, MAX_PATH * 2, L"%ls\\*", src);
    
    WIN32_FIND_DATAW ffd;
    HANDLE hFind = FindFirstFileW(srcSearch, &ffd);
    if (hFind == INVALID_HANDLE_VALUE) return FALSE;
    
    CreateDirectoryW(dst, NULL);
    
    do {
        if (wcscmp(ffd.cFileName, L".") == 0 || wcscmp(ffd.cFileName, L"..") == 0)
            continue;
        
        WCHAR srcPath[MAX_PATH * 2], dstPath[MAX_PATH * 2];
        swprintf(srcPath, MAX_PATH * 2, L"%ls\\%ls", src, ffd.cFileName);
        swprintf(dstPath, MAX_PATH * 2, L"%ls\\%ls", dst, ffd.cFileName);
        
        if (ffd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) {
            if (!CopyFileTree(srcPath, dstPath)) {
                FindClose(hFind);
                return FALSE;
            }
        } else {
            if (!CopyFileW(srcPath, dstPath, FALSE)) {
                FindClose(hFind);
                return FALSE;
            }
        }
    } while (FindNextFileW(hFind, &ffd));
    
    FindClose(hFind);
    return TRUE;
}

static BOOL DeleteFileTree(const WCHAR* path) {
    WCHAR searchPath[MAX_PATH * 2];
    swprintf(searchPath, MAX_PATH * 2, L"%ls\\*", path);
    
    WIN32_FIND_DATAW ffd;
    HANDLE hFind = FindFirstFileW(searchPath, &ffd);
    if (hFind == INVALID_HANDLE_VALUE) {
        return RemoveDirectoryW(path);
    }
    
    do {
        if (wcscmp(ffd.cFileName, L".") == 0 || wcscmp(ffd.cFileName, L"..") == 0)
            continue;
        
        WCHAR fullPath[MAX_PATH * 2];
        swprintf(fullPath, MAX_PATH * 2, L"%ls\\%ls", path, ffd.cFileName);
        
        if (ffd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) {
            DeleteFileTree(fullPath);
        } else {
            SetFileAttributesW(fullPath, FILE_ATTRIBUTE_NORMAL);
            DeleteFileW(fullPath);
        }
    } while (FindNextFileW(hFind, &ffd));
    
    FindClose(hFind);
    SetFileAttributesW(path, FILE_ATTRIBUTE_NORMAL);
    return RemoveDirectoryW(path);
}

static void CreateDirTree(const WCHAR* path) {
    WCHAR tmp[MAX_PATH * 2];
    wcscpy(tmp, path);

    WCHAR* p = tmp;
    if (p[0] && p[1] == L':' && p[2] == L'\\')
        p = tmp + 3;

    while ((p = wcschr(p, L'\\')) != NULL) {
        *p = L'\0';
        CreateDirectoryW(tmp, NULL);
        *p++ = L'\\';
    }
}

static BOOL ExtractZip(const WCHAR* zipPath, const WCHAR* destPath) {
    zlib_filefunc64_def ffunc;
    fill_win32_filefunc64W(&ffunc);

    unzFile uf = unzOpen2_64(zipPath, &ffunc);
    if (!uf) return FALSE;

    CreateDirectoryW(destPath, NULL);

    int result = unzGoToFirstFile(uf);
    while (result == UNZ_OK) {
        unz_file_info64 fi;
        char fileName[1024];
        if (unzGetCurrentFileInfo64(uf, &fi, fileName, sizeof(fileName), NULL, 0, NULL, 0) != UNZ_OK) {
            result = unzGoToNextFile(uf);
            continue;
        }

        WCHAR wideName[1024];
        MultiByteToWideChar(CP_UTF8, 0, fileName, -1, wideName, 1024);

        WCHAR fullPath[MAX_PATH * 2];
        swprintf(fullPath, MAX_PATH * 2, L"%ls\\%ls", destPath, wideName);

        size_t nameLen = strlen(fileName);
        int isDir = (nameLen > 0 && fileName[nameLen - 1] == '/');

        if (isDir) {
            CreateDirectoryW(fullPath, NULL);
        } else {
            CreateDirTree(fullPath);
            if (unzOpenCurrentFile(uf) == UNZ_OK) {
                HANDLE hFile = CreateFileW(fullPath, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
                if (hFile != INVALID_HANDLE_VALUE) {
                    char buf[8192];
                    int read;
                    do {
                        read = unzReadCurrentFile(uf, buf, 8192);
                        if (read > 0) {
                            DWORD written;
                            WriteFile(hFile, buf, read, &written, NULL);
                        }
                    } while (read > 0);
                    CloseHandle(hFile);
                }
                unzCloseCurrentFile(uf);
            }
        }
        result = unzGoToNextFile(uf);
    }
    unzClose(uf);
    return TRUE;
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
    
    WCHAR cleanupDirs[][MAX_PATH * 2] = {
        L"Default\\Sessions",
        L"Default\\Service Worker",
        L"Default\\Code Cache",
        L"Default\\Extension Scripts",
    };
    for (int i = 0; i < 4; i++) {
        WCHAR fullPath[MAX_PATH * 2];
        swprintf(fullPath, MAX_PATH * 2, L"%ls\\%ls", g_userDataDir, cleanupDirs[i]);
        DeleteFileTree(fullPath);
    }
    
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
    
    WCHAR localManifestPath[MAX_PATH];
    swprintf(localManifestPath, MAX_PATH, L"%ls\\manifest.json", g_destPath);
    
    char* localJson = NULL;
    HANDLE hManifest = CreateFileW(localManifestPath, GENERIC_READ, FILE_SHARE_READ, NULL, OPEN_EXISTING, 0, NULL);
    if (hManifest != INVALID_HANDLE_VALUE) {
        DWORD size = GetFileSize(hManifest, NULL);
        localJson = malloc(size + 1);
        DWORD read;
        ReadFile(hManifest, localJson, size, &read, NULL);
        localJson[read] = 0;
        CloseHandle(hManifest);
    }
    
    char localVerBuf[64] = "0";
    if (localJson) {
        int verLen = 0;
        char* ver = FindJsonValue(localJson, "version", &verLen);
        if (ver && verLen < 64) {
            memcpy(localVerBuf, ver, verLen);
            localVerBuf[verLen] = 0;
        }
    }
    
    WCHAR userAgent[128];
    swprintf(userAgent, 128, L"MarkingMaster.exe/%hs", localVerBuf);
    
    wprintf(L"正在检查更新...\n");
    char* json = HttpGet(DEFAULT_UPDATE_URL, NULL, userAgent);
    if (!json) {
        free(localJson);
        PrintError(L"无法连接更新服务器");
    }
    
    int versionLen = 0;
    char* version = FindJsonValue(json, "version", &versionLen);
    if (version) {
        wprintf(L"远程版本: %.*hs\n", versionLen, version);
    }
    
    BOOL needDownload = TRUE;
    WCHAR exeUrl[1024] = {0};
    
    if (localJson) {
        int localVersionLen = 0;
        char* localVersion = FindJsonValue(localJson, "version", &localVersionLen);
        if (localVersion && version && localVersionLen == versionLen && 
            memcmp(localVersion, version, versionLen) == 0) {
            wprintf(L"已是最新版本\n");
            needDownload = FALSE;
        }
        free(localJson);
        localJson = NULL;
    }
    
    KillEdgeProcesses();
    Sleep(500);
    
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
        if (!DownloadFile(extUrl, zipPath, userAgent)) {
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
        
        CreateDirectoryW(g_appDataDir, NULL);
        DeleteFileTree(g_destPath);
        if (!MoveFileExW(srcPath, g_destPath, MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH)) {
            wprintf(L"移动失败，回退到复制...\n");
            CreateDirectoryW(g_destPath, NULL);
            CopyFileTree(srcPath, g_destPath);
        }
        DeleteFileTree(extractPath);
        DeleteFileW(zipPath);
        
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
    
    CreateDirectoryW(g_appDataDir, NULL);
    CreateDirectoryW(g_userDataDir, NULL);
    
    StartEdge();

    if (exeUrl[0]) {
        wprintf(L"下载 exe 更新: %ls\n", exeUrl);

        WCHAR newExePath[MAX_PATH];
        GetTempPathW(MAX_PATH, newExePath);
        wcscat(newExePath, L"MarkingMaster_new.exe");

        if (DownloadFile(exeUrl, newExePath, userAgent)) {
            WCHAR oldExePath[MAX_PATH];
            swprintf(oldExePath, MAX_PATH, L"%ls.old", g_installedExePath);
            MoveFileExW(g_installedExePath, oldExePath, MOVEFILE_REPLACE_EXISTING);
            MoveFileExW(newExePath, g_installedExePath, MOVEFILE_REPLACE_EXISTING);
            wprintf(L"exe 已更新，重启后生效\n");
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
