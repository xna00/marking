import { recognizeImage } from "./ai.js";
import { scaleImage, getImageBitmap } from "./image.js";
import { printImageInConsole } from "./printImage.js";

let urlResultMap = new Map<string, Promise<any>>();

export async function aiHook(url: string, dataUrl: string) {
  if (urlResultMap.has(url)) {
    return;
  }
  const scaledDataUrl = await scaleImage(dataUrl);
  const bitmap = await getImageBitmap(scaledDataUrl);
  printImageInConsole(scaledDataUrl, bitmap.width, bitmap.height);
  bitmap.close();
  const result = recognizeImage(scaledDataUrl);

  urlResultMap.set(url, result);
  urlResultMap = new Map([...urlResultMap.entries()].slice(-20));
  result.catch(() => {
    urlResultMap.delete(url);
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getAIResult") {
    // check if need delay
    setTimeout(() => {
      const pendingResult = urlResultMap.get(request.url);
      console.log("getAIResult", request.url, pendingResult);
      if (pendingResult) {
        console.log("getAIResult found");
        pendingResult.then(
          (result) => {
            sendResponse({ result });
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
  }
  return true;
});