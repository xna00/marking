import { HOST, storageKeys } from "./constants";

async function setSvgIcon(backgroundColor = "#4CAF50") {
  try {
    const canvas = new OffscreenCanvas(128, 128);
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Failed to get canvas context");
    }

    ctx.fillStyle = backgroundColor;
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

    await chrome.action.setIcon({
      imageData: imageData,
    });

    console.log("SVG icon set successfully using Canvas API");
  } catch (error) {
    console.error("Error setting SVG icon:", error);
  }
}

export type UpdateInfo = {
  version: string;
  extensionUrl: string;
};

export const checkUpdate = async (): Promise<UpdateInfo | undefined> => {
  console.log("checkUpdate");
  const manifest = await (
    await fetch(new URL("/update.json?" + Date.now(), HOST), {
      headers: {
        "Cache-Control": "no-cache",
      },
    })
  ).json();
  console.log(manifest);
  if (manifest.version !== chrome.runtime.getVersion()) {
    await chrome.storage.local.set({
      [storageKeys.UPDATE_INFO]: {
        version: manifest.version,
      },
    });
    await setSvgIcon("red");
    await chrome.action.setTitle({
      title: `有新版本${manifest.version}`,
    });
    return {
      version: manifest.version,
      extensionUrl: manifest.extensionUrl,
    };
  } else {
    await setSvgIcon();
    await chrome.storage.local.set({
      [storageKeys.UPDATE_INFO]: null,
    });
  }
};
