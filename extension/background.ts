console.log("Marking extension background script loaded");
import "./logRequest.js";

// 使用Canvas API手动绘制SVG图标并设置为扩展图标
async function setSvgIcon(backgroundColor = "#4CAF50") {
  try {
    const canvas = new OffscreenCanvas(128, 128);
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Failed to get canvas context");
    }

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "white";
    ctx.lineWidth = 16;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(32, 32);
    ctx.lineTo(96, 96);
    ctx.moveTo(96, 96);
    ctx.lineTo(96, 64);
    ctx.moveTo(96, 96);
    ctx.lineTo(64, 96);
    ctx.stroke();

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    await chrome.action.setIcon({
      imageData: imageData,
    });

    console.log("SVG icon set successfully using Canvas API");
  } catch (error) {
    console.error("Error setting SVG icon:", error);
  }
}

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
        await chrome.action.setPopup({ popup: "popup/index.html" });
        await chrome.action.openPopup();
        await chrome.action.setPopup({ popup: "" });
      } catch {
      } finally {
        await chrome.action.setPopup({ popup: "" });
      }
    } else if (clickCount === 2) {
      const extensionUrl = chrome.runtime.getURL("popup/index.html");
      chrome.tabs.create({ url: extensionUrl });
    }
    clickCount = 0;
  }, DOUBLE_CLICK_THRESHOLD);
});

const checkUpdate = async () => {
  console.log("checkUpdate");
  const manifest = await (
    await fetch("https://marking.xna00.top/update.json", {
      cache: "no-cache",
    })
  ).json();
  console.log(manifest);
  if (manifest.version !== chrome.runtime.getVersion()) {
    await chrome.action.setTitle({
      title: `有新版本${manifest.version}`,
    });
    await setSvgIcon("red");
  }
};

chrome.tabs.onCreated.addListener(checkUpdate);
