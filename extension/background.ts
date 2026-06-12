import { addEventListener, sendMessage } from "./message.js";
import { getAIResultHandler } from "./aiHook.js";
import { api } from "./api.js";
import { EXTENSION_VERSION, storageKeys } from "./constants.js";
import "./logRequest.js";

chrome.storage.local.onChanged.addListener((changes) => {
  if (storageKeys.AUTH_TOKEN in changes && changes[storageKeys.AUTH_TOKEN].newValue) {
    chrome.action.setBadgeText({ text: "" });
  }
});

addEventListener("getAIResult", getAIResultHandler);

addEventListener("confirmMark", async (data) => {
  try {
    const res = await api.ai.confirmMark({ markRecordId: data.markRecordId });
    sendMessage({ action: "usageUpdated", data: { usage: res.usage } });
    return { success: true as const, usage: res.usage };
  } catch (e) {
    return { error: String(e) };
  }
});

addEventListener("getBackgroundVersion", async () => {
  return EXTENSION_VERSION;
});

addEventListener("hello", async (_data, sender) => {
  return `Hello ${sender.url}, I'm background script`;
});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
