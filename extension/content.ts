function parseAIResult2(aiResult: any): string {
  return aiResult.choices[0].message.content;
}
console.log("content.ts loaded");

const testPageHandlers = {
  submit: () => {
    document.dispatchEvent(new CustomEvent("customSubmit"));
  },
  getImageSrc: () => {
    const cardImage = document.getElementById("cardImage") as HTMLImageElement;
    return cardImage.src;
  },
};

const overlay = document.createElement("div");
overlay.style.position = "fixed";
overlay.style.top = "0";
overlay.style.left = "0";
overlay.style.width = "100%";
overlay.style.height = "100%";
overlay.style.zIndex = "9999";

const { submit, getImageSrc } = testPageHandlers;

let previousSrc = "";

// 拖动功能相关变量
let isDragging = false;
let currentElement: HTMLElement | null = null;
let startX = 0;
let startY = 0;
let initialX = 0;
let initialY = 0;

// 存储div位置的键名
const POSITION_STORAGE_KEY = "div_positions";
// 总分存储键名
const TOTAL_SCORE_KEY = "total_score";

// 获取存储的位置数据
const getStoredPositions = (): Record<
  string,
  { left: number; top: number }
> => {
  try {
    const data = localStorage.getItem(POSITION_STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    console.error("Error loading stored positions:", e);
    return {};
  }
};

// 保存位置数据到localStorage
const savePosition = (id: string, left: number, top: number): void => {
  try {
    const positions = getStoredPositions();
    positions[id] = { left, top };
    localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(positions));
  } catch (e) {
    console.error("Error saving position:", e);
  }
};

// 总分相关变量
let totalScore = 0;
const totalScoreDiv = document.createElement("div");

// 计算总分
const calculateTotalScore = (res: [string, number, string][]): number => {
  return res.reduce((sum, [, score]) => sum + score, 0);
};

// 更新总分显示
const updateTotalScoreDisplay = (score: number): void => {
  totalScoreDiv.innerText = `总分: ${score}`;
};

// 保存总分到localStorage
const saveTotalScore = (score: number): void => {
  try {
    localStorage.setItem(TOTAL_SCORE_KEY, score.toString());
  } catch (e) {
    console.error("Error saving total score:", e);
  }
};

// 初始化总分div
const initializeTotalScoreDiv = (): void => {
  totalScoreDiv.style.position = "absolute";
  totalScoreDiv.style.left = "50%";
  totalScoreDiv.style.top = "20px";
  totalScoreDiv.style.transform = "translateX(-50%)";
  totalScoreDiv.style.padding = "10px 20px";
  totalScoreDiv.style.background = "rgba(0, 0, 255, 0.8)";
  totalScoreDiv.style.color = "white";
  totalScoreDiv.style.borderRadius = "8px";
  totalScoreDiv.style.fontSize = "20px";
  totalScoreDiv.style.fontWeight = "bold";
  totalScoreDiv.style.zIndex = "10000";
  totalScoreDiv.style.cursor = "move";
  totalScoreDiv.style.userSelect = "none";

  // 添加唯一id
  totalScoreDiv.id = "total-score-div";

  // 从localStorage加载位置
  const positions = getStoredPositions();
  if (positions["total-score-div"]) {
    totalScoreDiv.style.left = `${positions["total-score-div"].left}px`;
    totalScoreDiv.style.top = `${positions["total-score-div"].top}px`;
    totalScoreDiv.style.transform = "none";
  }

  // 添加拖动功能
  makeDraggable(totalScoreDiv, "total-score-div");

  overlay.appendChild(totalScoreDiv);
};

// 键盘事件监听
const setupKeyboardListeners = (): void => {
  document.addEventListener("keydown", (e) => {
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        totalScore++;
        updateTotalScoreDisplay(totalScore);
        saveTotalScore(totalScore);
        break;
      case "ArrowDown":
        e.preventDefault();
        totalScore = Math.max(0, totalScore - 1);
        updateTotalScoreDisplay(totalScore);
        saveTotalScore(totalScore);
        break;
      case " ":
        e.preventDefault();
        totalScore = 0;
        updateTotalScoreDisplay(totalScore);
        saveTotalScore(totalScore);
        break;
      case "Enter":
        e.preventDefault();
        submit();
        break;
    }
  });
};

// 初始化键盘事件监听
setupKeyboardListeners();

// 拖动功能实现函数
const makeDraggable = (element: HTMLElement, id: string) => {
  element.style.cursor = "move";
  element.style.userSelect = "none";

  // 从localStorage加载位置
  const positions = getStoredPositions();
  if (positions[id]) {
    element.style.left = `${positions[id].left}px`;
    element.style.top = `${positions[id].top}px`;
  }

  element.addEventListener("mousedown", (e) => {
    isDragging = true;
    currentElement = element;
    startX = e.clientX;
    startY = e.clientY;
    initialX = parseInt(element.style.left || "0", 10);
    initialY = parseInt(element.style.top || "0", 10);

    // 防止文本选择
    e.preventDefault();
  });

  // 添加唯一id标识
  element.id = id;
};

// 全局事件监听器
document.addEventListener("mousemove", (e) => {
  if (!isDragging || !currentElement) return;

  const dx = e.clientX - startX;
  const dy = e.clientY - startY;

  currentElement.style.left = `${initialX + dx}px`;
  currentElement.style.top = `${initialY + dy}px`;
});

document.addEventListener("mouseup", () => {
  if (isDragging && currentElement && currentElement.id) {
    // 保存位置到localStorage
    const left = parseInt(currentElement.style.left || "0", 10);
    const top = parseInt(currentElement.style.top || "0", 10);
    savePosition(currentElement.id, left, top);
  }

  isDragging = false;
  currentElement = null;
});

const showAiResult = (result: string) => {
  try {
    const res = JSON.parse(result) as [string, number, string][];
    console.log(res);
    document.body.appendChild(overlay);

    // 清空之前的结果（但保留总分div）
    overlay.innerHTML = "";

    // 初始化总分div
    initializeTotalScoreDiv();

    // 计算并显示总分
    totalScore = calculateTotalScore(res);
    updateTotalScoreDisplay(totalScore);
    saveTotalScore(totalScore);

    res.forEach(([text, score, reason], index) => {
      const div = document.createElement("div");
      div.style.position = "absolute";
      div.style.left = `${10 + index * 20}px`; // 设置初始位置，避免堆叠
      div.style.top = `${10 + index * 40}px`;
      div.innerText = `${text}(${score}分,${reason})`;
      div.style.padding = "5px 10px"; // 添加内边距
      div.style.border = "1px solid #ccc"; // 添加边框
      div.style.borderRadius = "4px"; // 添加圆角
      div.style.fontSize = "14px";
      div.style.color = score === 0 ? "red" : "green";

      overlay.appendChild(div);

      // 创建唯一id，包含文本和索引以确保唯一性
      const uniqueId = `result-div-${index}`;

      // 添加拖动功能和本地存储
      makeDraggable(div, uniqueId);
    });
  } catch (e) {
    console.error(e);
  }
};

const h = async () => {
  const currentSrc = getImageSrc();
  if (currentSrc !== previousSrc) {
    console.log("Image src changed:", currentSrc);
    previousSrc = currentSrc;
    const res = await chrome.runtime.sendMessage({
      action: "getAIResult",
      url: currentSrc,
    });
    console.log(res);
    const result = res?.result;
    if (result) {
      const aiResult = parseAIResult2(result);
      showAiResult(aiResult);
    } else {
      console.error("No result from AI");
    }
  }
  setTimeout(h, 1000);
};

h();
