import { recognizeImage, type AIResultItem } from "./ai.js";
import { scaleImage, getImageBitmap } from "./image.js";
import { printImageInConsole } from "./printImage.js";
import { ApiError } from "@marking/api";
import { getGroupKey, getImagePromise } from "./logRequest.js";

let urlResultMap = new Map<string, Promise<{ result: AIResultItem[]; markRecordId: number }>>();

export function aiHook(url: string, dataUrlPromise: Promise<string>) {
  if (urlResultMap.has(url)) {
    return;
  }
  const promise = runAiRecognition(dataUrlPromise);
  urlResultMap.set(url, promise);
  urlResultMap = new Map([...urlResultMap.entries()].slice(-20));
}

async function runAiRecognition(dataUrlPromise: Promise<string>) {
  const dataUrl = await dataUrlPromise;
  const scaledDataUrl = await scaleImage(dataUrl);
  const bitmap = await getImageBitmap(scaledDataUrl);
  console.log("[aiHook] AI hook for URL:", scaledDataUrl, scaledDataUrl.length, "bitmap size:", bitmap.width, bitmap.height);
  printImageInConsole(scaledDataUrl, bitmap.width, bitmap.height);
  bitmap.close();
  return recognizeImage(scaledDataUrl);
}


const awaitResult = async (url: string, pendingResult: Promise<{
  result: AIResultItem[];
  markRecordId: number;
}>): Promise<{ result: AIResultItem[]; markRecordId: number } | { error: string }> => {
  try {
    const result = await pendingResult;
    console.log("[aiHook] getAIResult found");
    return { result: result.result, markRecordId: result.markRecordId };
  } catch (error) {
    console.error("[aiHook] Error fetching AI result:", error);
    urlResultMap.delete(url);
    if (error instanceof ApiError) {
      const code = error.body?.errorCode;
      if (code === "API_UNAUTHORIZED") {
        urlResultMap.clear();
        chrome.action.setBadgeText({ text: "登录" });
        chrome.action.setBadgeTextColor({ color: "#C00" });
        chrome.action.setBadgeBackgroundColor({ color: "#FFF" });
        return { error: "请先登录" };
      }
      if (code === "API_AI_FAILED")
        return { error: error.body?.rawContent ?? error.message };
      return { error: error.message };
    }
    return { error: "评分失败: 未知错误" };
  }
}
export const getAIResultHandler = async (
  data: { url: string, count: number },
  sender: chrome.runtime.MessageSender
): Promise<{ result: AIResultItem[]; markRecordId: number } | { error: string }> => {
  const groupKey = getGroupKey(data.url, data.count);
  let pendingResult = urlResultMap.get(groupKey);
  console.log("[aiHook] getAIResult", data.url, groupKey, pendingResult);
  if (!pendingResult) {
    const promise = getImagePromise(groupKey);
    if (!promise) return { error: "没有图片记录，请刷新页面重试" };
    aiHook(groupKey, promise);
    pendingResult = urlResultMap.get(groupKey)!;
  }
  return awaitResult(groupKey, pendingResult)
};


(globalThis as any).getUrlMap = () => urlResultMap