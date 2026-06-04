import { getAIResultHandler } from "./aiHook.js";
import { api } from "./api.js";
import "./logRequest.js";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getAIResult") {
    getAIResultHandler(message, sender, sendResponse);
  } else if (message.action === "confirmMark") {
    api.ai.confirmMark({ markRecordId: message.markRecordId })
      .then((res) => {
        sendResponse({ success: true, usage: res.usage });
        chrome.runtime.sendMessage({ action: "usageUpdated", usage: res.usage });
      })
      .catch(e => sendResponse({ error: String(e) }));
  } else if (message.action === "hello") {
    sendResponse(`Hello ${sender.url}, I'm background script`);
  }
  return true;
});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
