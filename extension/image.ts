export const blobToDataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const getImageBitmap = async (url: string) => {
  const response = await fetch(url);
  const blob = await response.blob();
  const imageBitmap = await createImageBitmap(blob);
  return imageBitmap;
};

// doubao-seed-2.0+ high 模式：单图归一化到 ~2,257,920 px、固定 1280 token。
// 原图超过上限才等比缩小（避免平台二次压缩丢细节）；不超过也原样转 webp（不重缩），
// 让 1280 token 尽量装真实像素而非插值。不再强制缩到 700px。
const HIGH_MAX_PIXELS = 2257920;

export const scaleImage = async (
  dataUrl: string,
  maxPixels = HIGH_MAX_PIXELS
): Promise<string> => {
  try {
    const imageBitmap = await getImageBitmap(dataUrl);

    const srcPixels = imageBitmap.width * imageBitmap.height;
    // 只缩不放：超过上限才缩
    const scale = srcPixels > maxPixels ? Math.sqrt(maxPixels / srcPixels) : 1;
    const canvasWidth = Math.round(imageBitmap.width * scale);
    const canvasHeight = Math.round(imageBitmap.height * scale);

    const scaleCanvas = new OffscreenCanvas(canvasWidth, canvasHeight);
    const scaleCtx = scaleCanvas.getContext("2d");

    if (!scaleCtx) {
      throw new Error("Failed to get canvas context");
    }

    scaleCtx.imageSmoothingEnabled = true;
    scaleCtx.imageSmoothingQuality = "high";
    scaleCtx.drawImage(
      imageBitmap,
      0,
      0,
      imageBitmap.width,
      imageBitmap.height,
      0,
      0,
      canvasWidth,
      canvasHeight
    );

    // 统一转 webp 减体积（默认有损质量）
    const scaledDataBlob = await scaleCanvas.convertToBlob({
      type: "image/webp",
    });

    imageBitmap.close();

    return blobToDataUrl(scaledDataBlob);
  } catch (error) {
    console.error("[image] scale failed:", error);
    console.error("[image]", dataUrl);
    throw error;
  }
};
