import { HOST, EXTENSION_VERSION } from "./constants";

export type UpdateInfo = {
  version: string;
};

let updateCache: UpdateInfo | undefined;

export const checkUpdate = async (): Promise<UpdateInfo | undefined> => {
  if (updateCache) return updateCache;

  console.log("[update] checkUpdate");
  const manifest = await (
    await fetch(new URL("/update.json?" + Date.now(), HOST), {
      headers: {
        "Cache-Control": "no-cache",
        "Version": EXTENSION_VERSION,
      },
    })
  ).json();
  console.log("[update]", manifest);
  if (manifest.version !== chrome.runtime.getManifest().version) {
    updateCache = { version: manifest.version };
    return updateCache;
  }
};

export async function setUpdateIcon(hasUpdate: boolean) {
  try {
    const canvas = new OffscreenCanvas(128, 128);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get canvas context");

    ctx.fillStyle = hasUpdate ? "#F44336" : "#4CAF50";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "white";
    ctx.lineWidth = 16;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(32, 32);
    ctx.lineTo(96, 96);
    ctx.moveTo(96, 96);
    ctx.lineTo(96, 64);
    ctx.moveTo(96, 96);
    ctx.lineTo(64, 96);
    ctx.stroke();

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    await chrome.action.setIcon({ imageData });
  } catch (error) {
    console.error("[update] setUpdateIcon error:", error);
  }
}
