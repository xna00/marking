// popup.ts

import { modelNames } from "./models.js";

// 添加showOpenFilePicker的类型定义

console.log('Marking extension popup loaded');

// 获取DOM元素
const capturedImage = document.getElementById('capturedImage') as HTMLImageElement;
const statusText = document.getElementById('statusText') as HTMLParagraphElement;
const modelSelect = document.getElementById('modelSelect') as HTMLSelectElement;
const promptTextarea = document.getElementById('promptTextarea') as HTMLTextAreaElement;
const selectFileBtn = document.getElementById('selectFileBtn') as HTMLButtonElement;
const doubaoKeyInput = document.getElementById('doubaoKeyInput') as HTMLInputElement;

// 定义存储数据类型
interface CapturedImageData {
  capturedImage?: string;
  timestamp?: number;
}

interface AISettings {
  model?: string;
  prompt?: string;
}

interface APIKeys {
  doubaoKey?: string;
  glmKey?: string;
  hunyuanKey?: string;
  qwenKey?: string;
}

// 加载图片函数
function loadCapturedImage() {
  chrome.storage.local.get(['capturedImage', 'timestamp'], (result) => {
    if (chrome.runtime.lastError) {
      console.error('Error reading from storage:', chrome.runtime.lastError);
      statusText.textContent = 'Error loading image';
      return;
    }

    const data = result as CapturedImageData;
    if (data.capturedImage) {
      capturedImage.src = data.capturedImage;
      capturedImage.style.display = 'block';
      const time = new Date(data.timestamp || Date.now()).toLocaleString();
      statusText.textContent = `Image loaded at ${time}`;
      console.log('Image loaded from storage successfully');
    } else {
      capturedImage.style.display = 'none';
      statusText.textContent = 'No image captured yet';
      console.log('No image found in storage');
    }
  });
}

// 刷新按钮事件监听
document.getElementById('refreshBtn')?.addEventListener('click', () => {
  console.log('Refreshing image...');
  statusText.textContent = 'Refreshing image...';
  loadCapturedImage();
});

// 重新加载扩展按钮
document.getElementById('reloadBtn')?.addEventListener('click', () => {
  console.log('Reloading extension...');
  chrome.runtime.reload();
});

// Fetch按钮
document.getElementById('fetchBtn')?.addEventListener('click', () => {
  console.log('Fetching baidu.com...');
  fetch('https://www.baidu.com').then((res) => res.text()).then((data) => {
    console.log(data);
  });
});

// 文件选择按钮

// 加载AI设置函数
function loadAISettings() {
  // 清空现有选项
  modelSelect.innerHTML = '';
  
  // 动态生成模型选项
  modelNames.forEach((model) => {
    const option = document.createElement('option');
    option.value = model;
    option.textContent = model;
    modelSelect.appendChild(option);
  });

  chrome.storage.local.get(['aiModel', 'aiPrompt', 'apiKeys'], (result) => {
    if (chrome.runtime.lastError) {
      console.error('Error reading AI settings:', chrome.runtime.lastError);
      return;
    }

    const settings = result as AISettings;
    const apiKeys = result.apiKeys as APIKeys;
    if (settings.model) {
      modelSelect.value = settings.model;
    }
    if (settings.prompt) {
      promptTextarea.value = settings.prompt;
    }
    if (apiKeys && apiKeys.doubaoKey) {
      doubaoKeyInput.value = apiKeys.doubaoKey;
    }
    console.log('AI settings loaded from storage');
  });
}

// 保存API Key函数
function saveApiKey() {
  const doubaoKey = doubaoKeyInput.value;

  // 获取现有API Keys，然后更新doubaoKey
  chrome.storage.local.get(['apiKeys'], (result) => {
    const existingKeys = (result.apiKeys as APIKeys) || {};
    const updatedKeys: APIKeys = {
      ...existingKeys,
      doubaoKey
    };

    chrome.storage.local.set({ apiKeys: updatedKeys }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error saving API Key:', chrome.runtime.lastError);
        return;
      }

      console.log('API Key saved to storage:', updatedKeys);
    });
  });
}

// 保存AI设置函数
function saveAISettings() {
  const model = modelSelect.value;
  const prompt = promptTextarea.value;

  chrome.storage.local.set({ aiModel: model, aiPrompt: prompt }, () => {
    if (chrome.runtime.lastError) {
      console.error('Error saving AI settings:', chrome.runtime.lastError);
      return;
    }

    console.log('AI settings saved to storage');
  });
}

// 模型选择变化事件监听
modelSelect.addEventListener('change', saveAISettings);

// 提示词变化事件监听
promptTextarea.addEventListener('change', saveAISettings);

// API Key变化事件监听
doubaoKeyInput.addEventListener('change', saveApiKey);

// 初始加载
loadCapturedImage();
loadAISettings();

// 定期检查图片更新（每秒检查一次）
setInterval(loadCapturedImage, 1000);