import { storageKeys } from "./constants";

const KEY = storageKeys.AUTH_TOKEN;
const AUTH_COOKIE = "authToken";

// content script 与页面同源，写的就是页面自己的 cookie，后续请求浏览器会自动携带
const writeAuthCookie = (token: string) => {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${AUTH_COOKIE}=${token}; Path=/; SameSite=Lax${secure}`;
};

// 由 doc(/app/) 页面主动发 MARKING_REQUEST_TOKEN 请求 token；
// content script 在 document_start 注册监听，必然早于页面脚本，不存在时序问题。
window.addEventListener("message", (e) => {
  if (e.data?.type !== "MARKING_REQUEST_TOKEN") return;
  chrome.storage.local.get(KEY).then((r) => {
    const token = r[KEY];
    // 扩展没登录时不动 cookie：后台可能是网页端自己登录的，不能在这里清掉
    if (typeof token === "string" && token) writeAuthCookie(token);
    // 有无 token 都回信号：没登录时也别让页面白等超时
    window.postMessage({ type: "MARKING_TOKEN_READY" }, "*");
  });
});
