console.log("Marking extension background script loaded");
import { storageKeys } from "./constants.js";
import "./logRequest.js";
import { checkUpdate } from "./update.js";

// 使用Canvas API手动绘制SVG图标并设置为扩展图标

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === "reloadExtensionAfterUpgrade") {
    await chrome.storage.local.set({
      [storageKeys.UPDATE_INFO]: null,
    });
    chrome.runtime.reload();
  } else if (message.action === "hello") {
    sendResponse(`Hello ${sender.url}, I'm background script`);
  }
});

let clickCount = 0;
let lastClickTime = 0;
const DOUBLE_CLICK_THRESHOLD = 200; // 双击时间阈值（毫秒）

chrome.action.onClicked.addListener(() => {
  const currentTime = Date.now();
  const timeDiff = currentTime - lastClickTime;

  console.log("clickCount", clickCount, "timeDiff", timeDiff);
  clickCount++;
  lastClickTime = currentTime;

  setTimeout(async () => {
    if (clickCount === 1) {
      try {
        await chrome.action.setPopup({ popup: "popup.html" });
        await chrome.action.openPopup();
        await chrome.action.setPopup({ popup: "" });
      } catch {
      } finally {
        await chrome.action.setPopup({ popup: "" });
      }
    } else if (clickCount === 2) {
      const extensionUrl = chrome.runtime.getURL("popup.html");
      chrome.tabs.create({ url: extensionUrl });
    }
    clickCount = 0;
  }, DOUBLE_CLICK_THRESHOLD);
});

chrome.tabs.onCreated.addListener(checkUpdate);
