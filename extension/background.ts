console.log("Marking extension background script loaded");
import "./logRequest.js";

// 监听内容脚本发送的截图请求
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "reloadExtension") {
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

const checkUpdate = async () => {
  console.log("checkUpdate");
  const manifest = await (
    await fetch("https://marking.xna00.top/manifest.json", {
      cache: "no-cache",
    })
  ).json();
  console.log(manifest);
  if (manifest.version !== chrome.runtime.getVersion()) {
    await chrome.action.setTitle({
      title: `有新版本${manifest.version}`,
    });
  }
};

chrome.tabs.onCreated.addListener(checkUpdate);
