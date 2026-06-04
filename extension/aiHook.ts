import { recognizeImage } from "./ai.js";
import { scaleImage, getImageBitmap } from "./image.js";
import { printImageInConsole } from "./printImage.js";

let urlResultMap = new Map<string, Promise<any>>();

export async function aiHook(url: string, dataUrl: string) {
  if (urlResultMap.has(url)) {
    return;
  }
  const promise = runAiRecognition(dataUrl);
  urlResultMap.set(url, promise);
  urlResultMap = new Map([...urlResultMap.entries()].slice(-20));
  promise.catch(() => urlResultMap.delete(url));
}

async function runAiRecognition(dataUrl: string) {
  const scaledDataUrl = await scaleImage(dataUrl);
  const bitmap = await getImageBitmap(scaledDataUrl);
  console.log("AI hook for URL:", scaledDataUrl, scaledDataUrl.length, "bitmap size:", bitmap.width, bitmap.height);
  printImageInConsole(scaledDataUrl, bitmap.width, bitmap.height);
  bitmap.close();
  return recognizeImage(scaledDataUrl);
}

export const getAIResultHandler = (
  request: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
) => {
  setTimeout(() => {
    const pendingResult = urlResultMap.get(request.url);
    console.log("getAIResult", request.url, pendingResult);
    if (pendingResult) {
      console.log("getAIResult found");
      pendingResult.then(
        (data) => {
          sendResponse({ result: data.result, markRecordId: data.markRecordId });
        },
        (error) => {
          console.error("Error fetching AI result:", error);
          sendResponse({ error: String(error) });
        }
      );
    } else {
      console.log("getAIResult not found");
      sendResponse({ error: "No result found" });
    }
  });
};
