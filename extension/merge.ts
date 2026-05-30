import { getImageBitmap, blobToDataUrl } from "./image.js";

export async function mergeImagesVertically(dataUrls: string[]): Promise<string> {
  console.log(`[mergeImagesVertically] merging ${dataUrls.length} images`);
  const bitmaps = await Promise.all(dataUrls.map((url) => getImageBitmap(url)));
  console.log(`[mergeImagesVertically] bitmaps:`, bitmaps.map((b) => `${b.width}x${b.height}`));

  const totalWidth = Math.max(...bitmaps.map((b) => b.width));
  const totalHeight = bitmaps.reduce((sum, b) => sum + b.height, 0);
  console.log(`[mergeImagesVertically] canvas size: ${totalWidth}x${totalHeight}`);

  const canvas = new OffscreenCanvas(totalWidth, totalHeight);
  const ctx = canvas.getContext("2d")!;

  let y = 0;
  for (const bitmap of bitmaps) {
    ctx.drawImage(bitmap, 0, y);
    y += bitmap.height;
    bitmap.close();
  }

  const blob = await canvas.convertToBlob({ type: "image/png" });
  const result = await blobToDataUrl(blob);
  console.log(`[mergeImagesVertically] merged dataUrl length=${result.length}`);
  return result;
}
