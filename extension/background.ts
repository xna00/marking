import { addEventListener, sendMessage } from "./message.js";
import { getAIResultHandler } from "./aiHook.js";
import { api } from "./api.js";
import { EXTENSION_VERSION, storageKeys } from "./constants.js";
import "./logRequest.js";
import { addMarkRecordId } from "./ai.js";
import { setupSettingsSync } from "./settingsSync.js";

chrome.storage.local.onChanged.addListener((changes) => {
  if (storageKeys.AUTH_TOKEN in changes && changes[storageKeys.AUTH_TOKEN].newValue) {
    chrome.action.setBadgeText({ text: "" });
  }
});

// 配置云同步：登录拉取 + 改动 debounce 推送
setupSettingsSync();

addEventListener("getAIResult", getAIResultHandler);

addEventListener("confirmMark", addMarkRecordId);

addEventListener("getBackgroundVersion", async () => {
  return EXTENSION_VERSION;
});

addEventListener("hello", async (_data, sender) => {
  return `Hello ${sender.url}, I'm background script`;
});

// 侧边栏是 Chrome/Edge 114+ 特性；@types/chrome 把它声明为必有，但旧版（如
// Edge 109）实际没有该 API。用 in 做运行时特性检测：旧版忽略 side_panel 键
// 且 action 无 default_popup、点击图标无响应，故守卫调用，并在无 sidePanel
// 时用 action.onClicked 在新标签页打开 popup.html 兜底。
const hasSidePanelApi = "sidePanel" in chrome && typeof chrome.sidePanel?.setPanelBehavior === "function";
if (hasSidePanelApi) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
}

chrome.action.onClicked.addListener(() => {
  // ≥114：setPanelBehavior({openPanelOnActionClick:true}) 会让点击开侧边栏，
  // 且不再触发 onClicked；走到这里说明是 <114 的无 sidePanel 环境。
  if (hasSidePanelApi) return;
  chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
});
