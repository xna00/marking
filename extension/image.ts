export const blobToDataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const scaleImage = async (dataUrl: string, width = 700): Promise<string> => {
  try {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const imageBitmap = await createImageBitmap(blob);

    const canvasWidth = width;
    const canvasHeight = (canvasWidth / imageBitmap.width) * imageBitmap.height;
    // 创建新的Canvas用于缩放（缩小一半，保持比例）
    const scaleCanvas = new OffscreenCanvas(canvasWidth, canvasHeight);
    const scaleCtx = scaleCanvas.getContext("2d");

    if (!scaleCtx) {
      throw new Error("Failed to get canvas context");
    }

    scaleCtx.imageSmoothingEnabled = true;
    scaleCtx.imageSmoothingQuality = "high";
    // 缩放图像到一半大小
    scaleCtx.drawImage(
      imageBitmap,
      0,
      0,
      imageBitmap.width,
      imageBitmap.height, // 源图像区域
      0,
      0,
      canvasWidth,
      canvasHeight
    );

    // 转换为data URL
    // 将 type: 'image/png' 改为 type: 'image/webp'
    const scaledDataBlob = await scaleCanvas.convertToBlob({
      type: "image/webp",
    });

    // 释放资源
    imageBitmap.close();

    // 将Blob转换为data URL
    return blobToDataUrl(scaledDataBlob);
  } catch (error) {
    console.error("Crop failed:", error);
    throw error;
  }
};
