import { addEventListener, sendTabMessage } from "./message.js";
import { aiHook } from "./aiHook.js";
import { mergeImagesVertically } from "./merge.js";
import { deferred, type Deferred } from "./deferred.js";

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

let urlResponseMap = new Map<string, Deferred<string>>();
let imageMap = new Map<string, { deferred: Deferred<string>; lock: boolean }>();
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

export function getGroupKey(url: string, count: number): string {
  const u = new URL(url);
  if (count > 1 && /[A-Z]\.png$/.test(u.pathname))
    return `${u.origin}${u.pathname.replace(/[A-Z]\.png$/, '')}A.png`;
  return url;
}

const debuggerEnabledUrls = [
  "http://127.0.0.1:8080/dist/doc/test/",
  "https://marking.xna00.top/test/",
  "https://www.wylkyj.com/",
  "https://wylkyj.com/",
];
const logUrls = [
  "http://127.0.0.1:8080/dist/doc/",
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
  if (changeInfo.status !== 'complete') {
    tabImageCount.delete(tabId);
    urlResponseMap.clear();
    imageMap.clear();
  }
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

      const d = deferred<string>();
      urlResponseMap.set(responseParams.response.url, d);

      const count = await getImageCount(tabId);

      const groupKey = getGroupKey(responseParams.response.url, count);
      let entry = imageMap.get(groupKey);
      if (!entry) {
        entry = { deferred: deferred<string>(), lock: false };
        imageMap.set(groupKey, entry);
      }

      const base = getBasePath(responseParams.response.url);

      const matched = [...urlResponseMap.entries()]
        .filter(([k]) => new URL(k).pathname.startsWith(base))
        .sort(([a], [b]) => new URL(a).pathname.localeCompare(new URL(b).pathname));

      if (matched.length >= count && !entry.lock) {
        entry.lock = true;
        const dataUrls = await Promise.all(matched.map(([_, d]) => d.promise));
        const merged = await mergeImagesVertically(dataUrls);
        entry.deferred.resolve(merged);
        aiHook(groupKey, entry.deferred.promise);
        matched.forEach(([k]) => urlResponseMap.delete(k));
        imageMap = new Map([...imageMap.entries()].slice(-20));
        sendTabMessage(tabId, {
          action: 'urlResponseUpdated',
          data: groupKey,
        });
      }
    }
  } else if (method === "Network.loadingFinished") {
    const requestId = params.requestId;
    const responseParams = requestIdResponseMap.get(requestId);
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

      urlResponseMap.get(responseParams.response.url)?.resolve(dataUrl);
      requestIdResponseMap.delete(requestId);
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  detachDebugger(tabId);
});

export function getImagePromise(groupKey: string): Promise<string> | undefined {
  return imageMap.get(groupKey)?.deferred.promise;
}

addEventListener("getResponse", async (data) => {
  const tab = await chrome.tabs.query({ active: true, currentWindow: true })
  let count = 1
  if (typeof tab[0]?.id === 'number') {
    count = await tabImageCount.get(tab[0].id) ?? 1
  }
  const groupKey = getGroupKey(data.url, count);
  const entry = imageMap.get(groupKey);

  if (entry) return { dataUrl: await entry.deferred.promise };
  const d = urlResponseMap.get(data.url);
  if (d) return { dataUrl: await d.promise };
  return { dataUrl: undefined };
});
