import { aiHook } from "./ai.js";

// 定义chrome.debugger API事件参数的类型接口
interface NetworkRequestWillBeSentParams {
  requestId: string;
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    postData?: string;
  };
  timestamp: number;
}

interface NetworkRequestWillBeSentExtraInfoParams {
  requestId: string;
  requestHeaders: Record<string, string>;
  body?: string;
}

interface NetworkResponseReceivedParams {
  requestId: string;
  response: {
    url: string;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    mimeType: string;
  };
  timestamp: number;
}

interface NetworkGetResponseBodyResponse {
  body: string;
  base64Encoded: boolean;
}

const urlResponseMap = new Map<string, string>();
// 用于存储调试器附加状态
const attachedTabs = new Map<number, boolean>();

export const responseMap = new Map<string, string>();

const debuggerEnabledUrls = ["http://127.0.0.1:8080/dist/doc/test/"];
const logUrls = ["http://127.0.0.1:8080/dist/doc/test/images/"];

const attachAndEnableNetwork = async (tabId: number, tab: chrome.tabs.Tab) => {
  // 检查是否已经附加了调试器
  if (!attachedTabs.get(tabId)) {
    try {
      // 附加调试器到当前标签页
      await chrome.debugger.attach({ tabId }, "1.3");
      await chrome.debugger.sendCommand({ tabId }, "Network.enable");
      attachedTabs.set(tabId, true);
      console.log("Debugger attached to:", tabId, tab.url);
    } catch (e) {
      console.error("Failed to attach debugger:", e);
    }
  }
};

const detachDebugger = async (tabId: number) => {
  if (attachedTabs.get(tabId)) {
    try {
      await chrome.debugger.detach({ tabId });
      attachedTabs.set(tabId, false);
      console.log("Debugger detached from:", tabId);
    } catch (e) {
      console.error("Failed to detach debugger:", e);
    }
  }
};
// 监听标签页更新事件
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 当标签页加载完成且URL包含cn.bing.com时
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    debuggerEnabledUrls.some((url) => tab.url!.includes(url))
  ) {
    attachAndEnableNetwork(tabId, tab);
  }
  // 当标签页URL变化且不再包含cn.bing.com时，分离调试器
  else if (
    attachedTabs.get(tabId) &&
    tab.url &&
    !debuggerEnabledUrls.some((url) => tab.url!.includes(url))
  ) {
    detachDebugger(tabId);
  }
});

// 监听新标签页创建事件
chrome.tabs.onCreated.addListener((tab) => {
  const tabId = tab.id;
  if (!tabId) return;
  if (tab.url && debuggerEnabledUrls.some((url) => tab.url!.includes(url))) {
    setTimeout(() => {
      if (!attachedTabs.get(tabId)) {
        attachAndEnableNetwork(tabId, tab);
      }
    }, 1000);
  }
});

// 监听调试器事件
chrome.debugger.onEvent.addListener(async (source, method, rawParams) => {
  if (!source.tabId) return;

  const tabId = source.tabId;
  const params = rawParams as any;

  if (method === "Network.responseReceived") {
    const responseParams = params as NetworkResponseReceivedParams;
    console.log("Response received:", params);
    if (logUrls.some((url) => responseParams.response.url.includes(url))) {
      const response = await chrome.debugger.sendCommand(
        { tabId },
        "Network.getResponseBody",
        {
          requestId: responseParams.requestId,
        }
      );

      if (!response) {
        console.log("Response is undefined");
        return;
      }
      const responseBody = response as NetworkGetResponseBodyResponse;
      let dataUrl = "";

      if (responseBody.base64Encoded) {
        dataUrl =
          "data:" +
          responseParams.response.mimeType +
          ";base64," +
          responseBody.body;
      } else {
        dataUrl =
          "data:" +
          responseParams.response.mimeType +
          ";charset=utf-8," +
          encodeURIComponent(responseBody.body);
      }
      urlResponseMap.set(responseParams.response.url, dataUrl);
      aiHook(responseParams.response.url, dataUrl);
      console.log("Response body:", {
        requestId: responseParams.requestId,
        body: dataUrl.substring(0, 200) + (dataUrl.length > 200 ? "..." : ""),
      });
    }
  }
});

// 监听标签页关闭事件，自动分离调试器
chrome.tabs.onRemoved.addListener((tabId) => {
  detachDebugger(tabId);
});
