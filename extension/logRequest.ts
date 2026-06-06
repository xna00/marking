import { addEventListener } from "./message.js";
import { aiHook } from "./aiHook.js";
import { mergeImagesVertically } from "./merge.js";

type NetworkResponseReceivedParams = {
  requestId: string;
  response: {
    url: string;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    mimeType: string;
  };
  timestamp: number;
};

type NetworkGetResponseBodyResponse = {
  body: string;
  base64Encoded: boolean;
};

const requestIdResponseMap = new Map<string, NetworkResponseReceivedParams>();

let urlResponseMap = new Map<string, string>();
let imageMap = new Map<string, string>(); // key = A图的完整URL, value = 合并后 dataUrl
const attachedTabs = new Map<number, boolean>();

function makeDataUrl(body: string, base64: boolean, mimeType: string): string {
  return base64
    ? `data:${mimeType};base64,${body}`
    : `data:${mimeType};charset=utf-8,${encodeURIComponent(body)}`;
}

const tabImageCount = new Map<number, Promise<number>>();

async function getImageCount(tabId: number): Promise<number> {
  if (!tabImageCount.has(tabId)) {
    const promise = new Promise<void>(r => setTimeout(r, 1000))
      .then(() => chrome.scripting.executeScript({
        target: { tabId },
        func: () => document.querySelectorAll('.outBox:not(.hideBox) .imgSection>img').length,
        world: "ISOLATED",
      }))
      .then(([{ result }]) => {
        console.log("Image count for tab", tabId, "is", result);
        return result ?? 1;
      });
    tabImageCount.set(tabId, promise);
  }
  return tabImageCount.get(tabId)!;
}

function getBasePath(url: string): string {
  return new URL(url).pathname.replace(/[A-Z]\.png$/, '');
}

const debuggerEnabledUrls = [
  "http://127.0.0.1:8080/dist/doc/test/",
  "https://marking.xna00.top/test/",
  "https://www.wylkyj.com/",
  "https://wylkyj.com/",
];
const logUrls = [
  "http://127.0.0.1:8080/dist/doc/test/images/",
  "https://marking.xna00.top/image",
  "https://data.wylkyj.com/PaperScan/",
  "https://data.wylkyj.com/AnswerSheet/",
];

const attachAndEnableNetwork = async (tabId: number, tab: chrome.tabs.Tab) => {
  if (!attachedTabs.get(tabId)) {
    try {
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

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  tabImageCount.delete(tabId);
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    debuggerEnabledUrls.some((url) => tab.url!.includes(url))
  ) {
    attachAndEnableNetwork(tabId, tab);
  }
  else if (
    attachedTabs.get(tabId) &&
    tab.url &&
    !debuggerEnabledUrls.some((url) => tab.url!.includes(url))
  ) {
    detachDebugger(tabId);
  }
});

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

chrome.debugger.onEvent.addListener(async (source, method, rawParams) => {
  if (!source.tabId) return;

  const tabId = source.tabId;
  const params = rawParams as any;

  if (method === "Network.responseReceived") {
    const responseParams = params as NetworkResponseReceivedParams;
    if (
      responseParams.response.mimeType.startsWith("image/") &&
      logUrls.some((url) => responseParams.response.url.includes(url))
    ) {
      requestIdResponseMap.set(responseParams.requestId, responseParams);
    }
  } else if (method === "Network.loadingFinished") {
    const requestId = params.requestId;
    const responseParams = requestIdResponseMap.get(requestId);
    requestIdResponseMap.delete(requestId);
    if (responseParams) {
      const response = await chrome.debugger.sendCommand(
        { tabId },
        "Network.getResponseBody",
        {
          requestId: responseParams.requestId,
        }
      );
      console.log("Response body:", response);

      if (!response) {
        console.log("Response is undefined");
        return;
      }
      const responseBody = response as NetworkGetResponseBodyResponse;
      const dataUrl = makeDataUrl(responseBody.body, responseBody.base64Encoded, responseParams.response.mimeType);

      const base = getBasePath(responseParams.response.url);
      const count = await getImageCount(tabId);
      urlResponseMap.set(responseParams.response.url, dataUrl); // 必须在 await getImageCount 之后才 set，否则多个并发的 loadingFinished handler 在 yield 回来的 matched 检查中都会看到 count 张图，导致重复 merge
      const matched = [...urlResponseMap.entries()]
        .filter(([k]) => {
          return new URL(k).pathname.startsWith(base)
        })
        .sort(([a], [b]) => new URL(a).pathname.localeCompare(new URL(b).pathname));

      if (matched.length >= count) {
        const keys = matched.map(([k]) => k);
        const dataUrls = matched.map(([_, v]) => v);
        const merged = await mergeImagesVertically(dataUrls);
        imageMap.set(keys[0], merged);
        keys.forEach(k => urlResponseMap.delete(k));
        aiHook(keys[0], merged);
        imageMap = new Map([...imageMap.entries()].slice(-20));
      }

      console.log("Response body:", {
        requestId: responseParams.requestId,
        base64Encoded: responseBody.base64Encoded,
        body: responseBody.body,
        dataUrl,
      });
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  detachDebugger(tabId);
});

export function getCachedDataUrl(url: string): string | undefined {
  return imageMap.get(url) ?? urlResponseMap.get(url);
}

addEventListener("getResponse", async (data) => {
  const dataUrl = getCachedDataUrl(data.url);
  return { dataUrl };
});
