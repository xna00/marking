import { recognizeImage, type AIResultItem } from "./ai.js";
import { scaleImage, getImageBitmap } from "./image.js";
import { printImageInConsole } from "./printImage.js";

let urlResultMap = new Map<string, Promise<{ result: AIResultItem[]; markRecordId: number }>>();

export async function aiHook(url: string, dataUrl: string) {
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

export const getAIResultHandler = async (
  data: { url: string },
  sender: chrome.runtime.MessageSender
): Promise<{ result: AIResultItem[]; markRecordId: number } | { error: string }> => {
  await new Promise(r => setTimeout(r, 0));
  const pendingResult = urlResultMap.get(data.url);
  console.log("getAIResult", data.url, pendingResult);
  if (pendingResult) {
    try {
      const result = await pendingResult;
      console.log("getAIResult found");
      return { result: result.result, markRecordId: result.markRecordId };
    } catch (error) {
      console.error("Error fetching AI result:", error);
      urlResultMap.delete(data.url);
      return { error: String(error) };
    }
  } else {
    console.log("getAIResult not found");
    return { error: "No result found" };
  }
};
