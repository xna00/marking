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

// 用于存储调试器附加状态
const attachedTabs = new Map<number, boolean>();

// 用于存储请求信息，key为requestId
const requestMap = new Map<string, any>();

export const responseMap = new Map<string, string>();

// 监听标签页更新事件
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 当标签页加载完成且URL包含cn.bing.com时
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    tab.url.includes("cn.bing.com")
  ) {
    // 如果已经附加了调试器，则不再重复附加
    if (attachedTabs.get(tabId)) {
      return;
    }

    // 附加调试器到当前标签页
    chrome.debugger.attach({ tabId }, "1.3", () => {
      if (chrome.runtime.lastError) {
        console.error(
          "Failed to attach debugger to bing.com:",
          chrome.runtime.lastError
        );
        return;
      }

      attachedTabs.set(tabId, true);
      console.log("Debugger attached to bing.com tab:", tabId, tab.url);

      // 启用网络监控
      chrome.debugger.sendCommand({ tabId }, "Network.enable", {}, () => {
        if (chrome.runtime.lastError) {
          console.error(
            "Failed to enable network monitoring:",
            chrome.runtime.lastError
          );
          return;
        }
        console.log("Network monitoring enabled for bing.com tab:", tabId);
      });
    });
  }
  // 当标签页URL变化且不再包含cn.bing.com时，分离调试器
  else if (
    tab.url &&
    !tab.url.includes("cn.bing.com") &&
    attachedTabs.get(tabId)
  ) {
    chrome.debugger.detach({ tabId }, () => {
      if (chrome.runtime.lastError) {
        console.error("Failed to detach debugger:", chrome.runtime.lastError);
        return;
      }
      attachedTabs.set(tabId, false);
      console.log("Debugger detached from tab (left bing.com):", tabId);
    });
  }
});

// 监听新标签页创建事件
chrome.tabs.onCreated.addListener((tab) => {
  // 如果新标签页URL包含cn.bing.com，等待加载完成后附加调试器
  if (tab.url && tab.url.includes("cn.bing.com")) {
    // 保存当前tab.id和tab.url
    const tabId = tab.id;
    const tabUrl = tab.url;

    // 如果没有tab.id，直接返回
    if (!tabId) return;

    // 使用setTimeout确保标签页已经创建完成
    setTimeout(() => {
      if (!attachedTabs.get(tabId)) {
        chrome.debugger.attach({ tabId }, "1.3", () => {
          if (chrome.runtime.lastError) {
            console.error(
              "Failed to attach debugger to new bing.com tab:",
              chrome.runtime.lastError
            );
            return;
          }

          attachedTabs.set(tabId, true);
          console.log("Debugger attached to new bing.com tab:", tabId, tabUrl);

          // 启用网络监控
          chrome.debugger.sendCommand({ tabId }, "Network.enable", {}, () => {
            if (chrome.runtime.lastError) {
              console.error(
                "Failed to enable network monitoring:",
                chrome.runtime.lastError
              );
              return;
            }
            console.log(
              "Network monitoring enabled for new bing.com tab:",
              tabId
            );
          });
        });
      }
    }, 1000);
  }
});

// 监听调试器事件
chrome.debugger.onEvent.addListener((source, method, rawParams) => {
  if (!source.tabId) return;

  const tabId = source.tabId;
  const params = rawParams as any;

  // 处理请求开始事件
  if (method === "Network.requestWillBeSent") {
    const requestParams = params as NetworkRequestWillBeSentParams;
    if (requestParams.requestId && requestParams.request) {
      // 存储请求信息
      requestMap.set(requestParams.requestId, {
        url: requestParams.request.url,
        method: requestParams.request.method,
        headers: requestParams.request.headers,
        timestamp: new Date().toISOString(),
        requestBody: requestParams.request.postData,
        responseBody: undefined,
      });

      console.log("Request started:", {
        requestId: requestParams.requestId,
        url: requestParams.request.url,
        method: requestParams.request.method,
      });
    }
  }

  // 处理请求数据发送事件（包含请求体）
  if (method === "Network.requestWillBeSentExtraInfo") {
    const extraInfoParams = params as NetworkRequestWillBeSentExtraInfoParams;
    if (extraInfoParams.requestId) {
      const requestInfo = requestMap.get(extraInfoParams.requestId);
      if (requestInfo) {
        // 更新请求头信息
        if (extraInfoParams.requestHeaders) {
          requestInfo.headers = extraInfoParams.requestHeaders;
        }

        // 如果有请求体（POST/PUT请求）
        if (extraInfoParams.body) {
          requestInfo.requestBody = extraInfoParams.body;
          console.log("Request body:", {
            requestId: extraInfoParams.requestId,
            body: extraInfoParams.body,
          });
        }

        requestMap.set(extraInfoParams.requestId, requestInfo);
      }
    }
  }

  // 处理响应接收事件
  if (method === "Network.responseReceived") {
    const responseParams = params as NetworkResponseReceivedParams;
    if (responseParams.requestId && responseParams.response) {
      const requestInfo = requestMap.get(responseParams.requestId);
      if (requestInfo) {
        // 更新响应信息
        requestInfo.responseHeaders = responseParams.response.headers;
        requestInfo.statusCode = responseParams.response.status;
        requestInfo.statusText = responseParams.response.statusText;
        requestInfo.mimeType = responseParams.response.mimeType;
        requestMap.set(responseParams.requestId, requestInfo);

        console.log("Response received:", {
          requestId: responseParams.requestId,
          url: requestInfo.url,
          status: responseParams.response.status,
          statusText: responseParams.response.statusText,
        });

        // 获取响应体
        chrome.debugger.sendCommand(
          { tabId },
          "Network.getResponseBody",
          { requestId: responseParams.requestId },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error(
                "Failed to get response body:",
                chrome.runtime.lastError
              );
              return;
            }

            if (!response) {
              console.error("Response is undefined");
              return;
            }

            // 使用类型断言
            const responseBody = response as NetworkGetResponseBodyResponse;

            const requestInfo = requestMap.get(responseParams.requestId);
            if (requestInfo) {
              // 存储响应体
              requestInfo.responseBody = responseBody.body;
              requestInfo.base64Encoded = responseBody.base64Encoded;
              requestMap.set(responseParams.requestId, requestInfo);

              // 解码响应体（如果是base64编码）
              let decodedBody = responseBody.body;
              if (responseBody.base64Encoded) {
                decodedBody = atob(responseBody.body);
              }

              let dataUrl = "";

              if (responseBody.base64Encoded) {
                dataUrl =
                  "data:" + requestInfo.mimeType + ";base64," + responseBody.body;
              } else {
                dataUrl =
                  "data:" +
                  requestInfo.mimeType +
                  ";charset=utf-8," +
                  encodeURIComponent(decodedBody);
              }
              responseMap.set(requestInfo.url, dataUrl);
              console.log(requestInfo.url, dataUrl)

              console.log("Response body:", {
                requestId: responseParams.requestId,
                body:
                  decodedBody.substring(0, 200) +
                  (decodedBody.length > 200 ? "..." : ""),
                mimeType: requestInfo.mimeType,
              });

              // 完整记录请求和响应
              console.log("Complete request/response:", requestInfo);
            }
          }
        );
      }
    }
  }
});

// 监听标签页关闭事件，自动分离调试器
chrome.tabs.onRemoved.addListener((tabId) => {
  if (attachedTabs.get(tabId)) {
    chrome.debugger.detach({ tabId }, () => {
      attachedTabs.delete(tabId);
    });
  }
});
