// background.ts
import { recognizeImage } from './ai.js';
console.log('Marking extension background script loaded');
import './logRequest.js'


// 获取扩展自身位置信息
const getExtensionLocation = async () => {
  try {
    // 获取扩展ID
    const extensionId = chrome.runtime.id;
    console.log('Extension ID:', extensionId);
    
    // 获取扩展根目录下某个文件的URL
    const iconUrl = chrome.runtime.getURL('images/icon.png');
    console.log('Extension Icon URL:', iconUrl);
    
    // 获取扩展安装目录
    const dirEntry = await chrome.runtime.getPackageDirectoryEntry();
    console.log('Extension Directory Entry:', dirEntry);
    
    // 使用management API获取扩展更多信息（需要添加management权限）
    if (chrome.management) {
      const extensionInfo = await chrome.management.getSelf();
      console.log('Extension Info:', extensionInfo);
    }
    
    return {
      extensionId,
      iconUrl,
      directoryEntry: dirEntry
    };
  } catch (error) {
    console.error('Error getting extension location:', error);
    throw error;
  }
};

// 测试获取扩展位置信息
// getExtensionLocation().catch(error => {
//   console.error('Failed to get extension location:', error);
// });


// 处理图片裁剪的辅助函数
const cropImage = async (dataUrl: string, cropInfo: { x: number, y: number, width: number, height: number }): Promise<string> => {
  try {
    // 将data URL转换为Blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    
    // 创建ImageBitmap
    const imageBitmap = await createImageBitmap(blob);
    
    // 创建OffscreenCanvas进行裁剪
    const cropCanvas = new OffscreenCanvas(cropInfo.width, cropInfo.height);
    const cropCtx = cropCanvas.getContext('2d');
    
    if (!cropCtx) {
      throw new Error('Failed to get canvas context');
    }
    
    // 裁剪目标区域
    cropCtx.drawImage(
      imageBitmap,
      cropInfo.x, cropInfo.y, cropInfo.width, cropInfo.height, // 源图像区域
      0, 0, cropInfo.width, cropInfo.height // 目标Canvas区域
    );
    
    // 创建新的Canvas用于缩放（缩小一半，保持比例）
    const scaleCanvas = new OffscreenCanvas(cropInfo.width / 2, cropInfo.height / 2);
    const scaleCtx = scaleCanvas.getContext('2d');
    
    if (!scaleCtx) {
      throw new Error('Failed to get canvas context');
    }
    
    scaleCtx.imageSmoothingEnabled = true;
    scaleCtx.imageSmoothingQuality = 'high';
    // 缩放图像到一半大小
    scaleCtx.drawImage(
      cropCanvas,
      0, 0, cropInfo.width, cropInfo.height, // 源图像区域
      0, 0, cropInfo.width / 2, cropInfo.height / 2 // 目标Canvas区域（缩小一半）
    );
    
    // 转换为data URL
    // 将 type: 'image/png' 改为 type: 'image/webp'
    const scaledDataUrl = await scaleCanvas.convertToBlob({ type: 'image/webp' });

    // 释放资源
    imageBitmap.close();
    
    // 将Blob转换为data URL
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(scaledDataUrl!);
    });
  } catch (error) {
    console.error('Crop failed:', error);
    throw error;
  }
};

// 监听内容脚本发送的截图请求
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'captureTab') {
    // 使用Chrome原生截图API截取当前标签页
    // 省略windowId参数，默认捕获当前窗口
    chrome.tabs.captureVisibleTab({
      format: 'png',
      quality: 100
    }, async (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error('Screenshot failed:', chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
        return;
      }
      
      try {
        let finalDataUrl = dataUrl;
        
        // 如果有裁剪信息，则进行裁剪
        if (message.cropInfo) {
          finalDataUrl = await cropImage(dataUrl, message.cropInfo);
        }
        
        // 保存图片数据到chrome.storage.local
        chrome.storage.local.set({
          capturedImage: finalDataUrl,
          timestamp: Date.now()
        }, () => {
          if (chrome.runtime.lastError) {
            console.error('Error saving image to storage:', chrome.runtime.lastError);
          } else {
            console.log('Image saved to storage successfully');
          }
        });

        // 调用AI识别函数处理截图
        recognizeImage(finalDataUrl).then(aiResult => {
          // 将AI识别结果保存到storage
          chrome.storage.local.set({
            aiRecognitionResult: aiResult,
            aiRecognitionTimestamp: Date.now()
          }, () => {
            if (chrome.runtime.lastError) {
              console.error('Error saving AI recognition result to storage:', chrome.runtime.lastError);
            } else {
              console.log('AI recognition result saved to storage successfully');
            }
          });

          // 如果有识别结果，将结果和imgSrc一起发送回content.ts
          if (aiResult && aiResult.choices && aiResult.choices[0] && aiResult.choices[0].message && aiResult.choices[0].message.content) {
            const aiContent = aiResult.choices[0].message.content;
            // 发送消息到内容脚本，包含AI识别结果和图片src
            if (sender.tab && sender.tab.id) {
              chrome.tabs.sendMessage(sender.tab.id, {
                action: 'aiRecognitionResult',
                aiContent: aiContent,
                imgSrc: message.imgSrc
              });
            }
          }
        }).catch(error => {
          console.error('AI recognition failed:', error);
        });
        
        sendResponse({ success: true, dataUrl: finalDataUrl });
      } catch (error) {
        console.error('Crop failed:', error);
        sendResponse({ success: false, error: 'Failed to crop image' });
      }
    });
    
    return true; // 表示异步响应
  } else if (message.action === 'reloadExtension') {
    chrome.runtime.reload();
  }
});

chrome.action.setIcon