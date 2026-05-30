import { getImageBitmap, blobToDataUrl } from "./image.js";

export async function mergeImagesVertically(dataUrls: string[]): Promise<string> {
  const bitmaps = await Promise.all(dataUrls.map((url) => getImageBitmap(url)));

  const totalWidth = Math.max(...bitmaps.map((b) => b.width));
  const totalHeight = bitmaps.reduce((sum, b) => sum + b.height, 0);

  const canvas = new OffscreenCanvas(totalWidth, totalHeight);
  const ctx = canvas.getContext("2d")!;

  let y = 0;
  for (const bitmap of bitmaps) {
    ctx.drawImage(bitmap, 0, y);
    y += bitmap.height;
    bitmap.close();
  }

  const blob = await canvas.convertToBlob({ type: "image/png" });
  return blobToDataUrl(blob);
}
