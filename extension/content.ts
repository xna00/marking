// content.ts
console.log('Image monitoring extension content script loaded');

// 显示所有AI结果框
const showAllAIBoxes = () => {
    const existingBoxes = document.querySelectorAll('.ai-result-box');
    existingBoxes.forEach(box => {
        (box as HTMLElement).style.display = 'block';
    });
};

// 使用浏览器原生截图API截图并裁剪目标元素
const captureImageAsDataURL = (imgElement: HTMLImageElement): Promise<string> => {
    return new Promise((resolve) => {
        // 在截图前隐藏所有AI结果框
        hideAllAIBoxes();

        // 获取目标元素的坐标和尺寸，考虑页面滚动和设备像素比
        const rect = imgElement.getBoundingClientRect();

        // 获取页面滚动位置
        const scrollX = window.scrollX;
        const scrollY = window.scrollY;

        // 获取设备像素比
        const devicePixelRatio = window.devicePixelRatio || 1;

        // 计算准确的裁剪坐标和尺寸
        const cropInfo = {
            x: (rect.left + scrollX) * devicePixelRatio,
            y: (rect.top + scrollY) * devicePixelRatio,
            width: rect.width * devicePixelRatio,
            height: rect.height * devicePixelRatio
        };

        console.log('Element coordinates (adjusted):', cropInfo);
        console.log('Scroll position:', { scrollX, scrollY });
        console.log('Device pixel ratio:', devicePixelRatio);

        chrome.runtime.sendMessage
        // 发送消息到后台脚本请求截图和裁剪，包含图片src
        chrome.runtime.sendMessage({ action: 'captureTab', cropInfo: cropInfo, imgSrc: imgElement.src }, (response) => {
            // 截图完成后重新显示所有AI结果框
            showAllAIBoxes();

            if (response && response.success) {
                console.log('Browser API screenshot and crop successful');
                resolve(response.dataUrl);
            } else {
                console.error('Browser API screenshot failed:', response?.error || 'Unknown error');
                resolve(''); // 失败时返回空字符串
            }
        });
    });
};

// 每秒查询目标元素的src变化
const observeImageChanges = (): void => {
    const targetSelector = '#app > div > div.imageEdit > div.imageBox > div:nth-child(1) > div > img';
    let previousSrc = '';

    // 定时查询函数
    const checkImageSrc = () => {
        // 查找目标图片元素
        const imgElement = document.querySelector<HTMLImageElement>(targetSelector);

        if (imgElement) {
            const currentSrc = imgElement.src;

            // 检查src是否变化
                if (currentSrc !== previousSrc) {
                    console.log('Image URL changed:', currentSrc);
                    previousSrc = currentSrc;
                    
                    // Remove all AI boxes when image changes
                    removeAllAIBoxes();

                    // 等待图片加载完成后截图
                    const captureAfterDelay = () => {
                    // 延迟500ms后截图
                    setTimeout(() => {
                        captureImageAsDataURL(imgElement).then((dataURL) => {
                            console.log('Image captured as data URL:', dataURL);
                            // Service Worker已自动保存图片到storage
                        });
                    }, 500);
                };

                if (imgElement.complete) {
                    captureAfterDelay();
                } else {
                    imgElement.addEventListener('load', () => {
                        captureAfterDelay();
                    }, { once: true }); // 使用once选项确保监听器只执行一次
                }
            }
        } else {
            // 如果找不到元素，重置previousSrc
            previousSrc = '';
        }
    };

    // 每秒执行一次查询
    setInterval(checkImageSrc, 1000);

};

// 初始化
const init = (): void => {
    // 启动图片变化监听
    observeImageChanges();
};

// 解析AI识别结果
const parseAIResult = (content: string): Record<string, string> | null => {
    try {
        const parsed = JSON.parse(content);
        // 确保解析结果是预期的格式：{key: [content, score]}
        const isValidFormat = typeof parsed === 'object' && parsed !== null &&
            Object.values(parsed).every(item => typeof item === 'string');
        return isValidFormat ? parsed as Record<string, string> : null;
    } catch (error) {
        console.error('Failed to parse AI result:', error);
        return null;
    }
};

// 创建可拖动的信息框
const createDraggableBox = (key: string, value: [string, number], initialPosition: { x: number, y: number }) => {
    const box = document.createElement('div');
    box.className = 'ai-result-box';
    box.id = `ai-box-${key}`; // 添加唯一标识符
    box.style.position = 'absolute';
    box.style.left = `${initialPosition.x}px`;
    box.style.top = `${initialPosition.y}px`;
    box.style.width = '200px';
    box.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
    box.style.border = '1px solid #ccc';
    box.style.borderRadius = '5px';
    box.style.padding = '10px';
    box.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
    box.style.cursor = 'move';
    box.style.zIndex = '10000';
    box.style.userSelect = 'none';
    box.style.fontFamily = 'Arial, sans-serif';
    box.style.fontSize = '14px';

    // 添加标题
    const title = document.createElement('div');
    title.textContent = key;
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '5px';
    title.style.color = '#333';
    box.appendChild(title);

    // 添加内容和分数
    const content = document.createElement('div');
    const [contentText, score] = value;
    content.textContent = `${contentText || '无内容'} (${score}分)`;
    content.style.color = '#666';
    content.style.wordBreak = 'break-word';
    box.appendChild(content);

    // 实现拖动功能
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    box.addEventListener('mousedown', (e) => {
        isDragging = true;
        offsetX = e.clientX - box.getBoundingClientRect().left;
        offsetY = e.clientY - box.getBoundingClientRect().top;
        box.style.zIndex = '10001'; // 拖动时置于顶层
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const newX = e.clientX - offsetX + window.scrollX;
        const newY = e.clientY - offsetY + window.scrollY;

        box.style.left = `${newX}px`;
        box.style.top = `${newY}px`;
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            box.style.zIndex = '10000';
            // 保存位置
            saveBoxPosition(key, {
                x: parseInt(box.style.left),
                y: parseInt(box.style.top)
            });
        }
    });

    return box;
};

// 保存信息框位置到storage
const saveBoxPosition = (key: string, position: { x: number, y: number }) => {
    chrome.storage.local.get('aiBoxPositions', (result) => {
        // 使用类型断言确保类型安全
        const positions = (result.aiBoxPositions || {}) as Record<string, { x: number, y: number }>;
        positions[key] = position;
        chrome.storage.local.set({ aiBoxPositions: positions }, () => {
            if (chrome.runtime.lastError) {
                console.error('Failed to save box position:', chrome.runtime.lastError);
            }
        });
    });
};

// 加载保存的信息框位置
const loadBoxPositions = (): Promise<Record<string, { x: number, y: number }>> => {
    return new Promise((resolve) => {
        chrome.storage.local.get('aiBoxPositions', (result) => {
            // 使用类型断言确保类型安全
            resolve((result.aiBoxPositions || {}) as Record<string, { x: number, y: number }>);
        });
    });
};

// 移除所有现有的AI结果框
const removeAllAIBoxes = () => {
    const existingBoxes = document.querySelectorAll('.ai-result-box');
    existingBoxes.forEach(box => box.remove());
};

// 隐藏所有AI结果框
const hideAllAIBoxes = () => {
    const existingBoxes = document.querySelectorAll('.ai-result-box');
    existingBoxes.forEach(box => {
        (box as HTMLElement).style.display = 'none';
    });
};

// 更新或创建信息框
const updateOrCreateBox = (key: string, value: [string, number], initialPosition: { x: number, y: number }) => {
    // 查找是否已存在该key对应的信息框
    const existingBox = document.getElementById(`ai-box-${key}`);
    
    if (existingBox) {
        // 更新现有框的内容
        const contentElement = existingBox.querySelector('div:nth-child(2)');
        if (contentElement) {
            const [contentText, score] = value;
            contentElement.textContent = `${contentText || '无内容'} (${score}分)`;
        }
    } else {
        // 创建新框
        const box = createDraggableBox(key, value, initialPosition);
        document.body.appendChild(box);
    }
};

// 显示AI识别结果
const displayAIResults = (aiContent: string, imgSrc: string) => {
    // 查找当前图片元素
    const targetSelector = '#app > div > div.imageEdit > div.imageBox > div:nth-child(1) > div > img';
    const currentImg = document.querySelector<HTMLImageElement>(targetSelector);

    // 检查当前图片src是否与返回的src一致
    if (!currentImg || currentImg.src !== imgSrc) {
        console.log('Image src mismatch, ignoring AI result');
        return;
    }

    // 解析AI结果
    const aiData = parseAIResult(aiContent);
    if (!aiData) {
        console.error('Invalid AI result format');
        return;
    }

    const _aiData: Record<string, [string, number]> = {
        "1.1": [aiData["1.1"], ['500mL容量瓶', '500ml容量瓶', '500毫升容量瓶']?.includes(aiData["1.1"]) ? 1 : 0],
        "1.2": [aiData["1.2"], aiData["1.2"] === '13.6' ? 2 : 0],
        "2": [aiData["2"], aiData["2"] === '25' ? 1 : 0],
        "3": [aiData["3"], 0 + (
            aiData["3"]?.includes('杯壁') ? 1 : 0) +
            (aiData["3"]?.includes('玻璃棒搅拌')
                || aiData["3"]?.includes('玻璃棒不断搅拌') ||
                aiData["3"]?.includes('玻璃棒不断地搅拌') ?
                1 : 0)],
        "4": [aiData["4"], aiData["4"].toUpperCase() === 'C' ? 2 : 0],
    }
    // 计算总分
    const totalScore =

        Object.values(_aiData).reduce((sum, [_, score]) => sum + score, 0);

    // 加载保存的位置
    loadBoxPositions().then(positions => {
        // 更新或创建信息框
        Object.entries(_aiData).forEach(([key, value], index) => {
            // 如果没有保存的位置，使用默认位置
            const initialPosition = positions[key] || {
                x: 100 + (index * 220),
                y: 100
            };

            updateOrCreateBox(key, value, initialPosition);
        });

        // 向#inputOne发送总分事件
        const inputOne = document.getElementById('inputOne') as HTMLInputElement;
        if (inputOne) {
            inputOne.value = totalScore.toString();
            inputOne.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });
};

// 监听AI识别结果
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'aiRecognitionResult') {
        console.log('Received AI recognition result:', message);
        displayAIResults(message.aiContent, message.imgSrc);
    }
});

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}