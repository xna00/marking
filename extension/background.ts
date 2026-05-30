console.log("Marking extension background script loaded");
import { getAIResultHandler } from "./aiHook.js";
import "./logRequest.js";

// 使用Canvas API手动绘制SVG图标并设置为扩展图标

/**
 * async listener, return value as response to sender
 * sync listener, return true to indicate you wish to send a response asynchronously (this will keep the message channel open to the other end until sendResponse is called)
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getAIResult") {
    getAIResultHandler(message, sender, sendResponse);
  } else if (message.action === "hello") {
    sendResponse(`Hello ${sender.url}, I'm background script`);
  }
  return true;
});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
