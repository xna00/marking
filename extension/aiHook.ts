import { recognizeImage, type AIResultItem } from "./ai.js";
import { scaleImage, getImageBitmap } from "./image.js";
import { printImageInConsole } from "./printImage.js";
import { ApiError } from "@marking/api";
import { getCachedDataUrl, isPendingUrl } from "./logRequest.js";

let urlResultMap = new Map<string, Promise<{ result: AIResultItem[]; markRecordId: number }>>();

export function aiHook(url: string, dataUrl: string) {
  if (urlResultMap.has(url)) {
    return;
  }
  const promise = runAiRecognition(dataUrl);
  urlResultMap.set(url, promise);
  urlResultMap = new Map([...urlResultMap.entries()].slice(-20));
}

async function runAiRecognition(dataUrl: string) {
  const scaledDataUrl = await scaleImage(dataUrl);
  const bitmap = await getImageBitmap(scaledDataUrl);
  console.log("AI hook for URL:", scaledDataUrl, scaledDataUrl.length, "bitmap size:", bitmap.width, bitmap.height);
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
    console.log("getAIResult found");
    return { result: result.result, markRecordId: result.markRecordId };
  } catch (error) {
    console.error("Error fetching AI result:", error);
    urlResultMap.delete(url);
    if (error instanceof ApiError) {
      const code = error.body?.errorCode;
      if (code === "API_UNAUTHORIZED") {
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
  data: { url: string },
  sender: chrome.runtime.MessageSender
): Promise<{ result: AIResultItem[]; markRecordId: number } | { error: string }> => {
  let pendingResult = urlResultMap.get(data.url);
  console.log("getAIResult", data.url, pendingResult);
  if (!pendingResult) {
    const dataUrl = getCachedDataUrl(data.url);
    if (!dataUrl) {
      if (isPendingUrl(data.url)) {
        return { error: 'pending' }
      }
      return { error: "没有图片记录，请刷新页面重试" }
    };
    aiHook(data.url, dataUrl);
    pendingResult = urlResultMap.get(data.url)!;
  }
  return awaitResult(data.url, pendingResult)
};


(globalThis as any).getUrlMap = () => urlResultMap