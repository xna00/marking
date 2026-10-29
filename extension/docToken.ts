import { storageKeys } from "./constants";

const KEY = storageKeys.AUTH_TOKEN;

// 由 doc(/app/) 页面主动发 MARKING_REQUEST_TOKEN 请求 token；
// content script 在 document_start 注册监听，必然早于页面脚本，不存在时序问题。
window.addEventListener("message", (e) => {
  if (e.data?.type !== "MARKING_REQUEST_TOKEN") return;
  chrome.storage.local.get(KEY).then((r) => {
    const token = r[KEY];
    if (typeof token === "string" && token) {
      // content script 与页面共享同 origin 的 sessionStorage，页面直接可读
      sessionStorage.setItem(KEY, token);
    }
    // 有无 token 都回信号：没登录时也别让页面白等超时
    window.postMessage({ type: "MARKING_TOKEN_READY" }, "*");
  });
});
