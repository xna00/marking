import { sendMessage, addEventListener } from "./message";
import { storageKeys } from "./constants";
import type { AIResultItem } from "@marking/server";

console.log("content.ts loaded");

const testPageHandlers = {
  submit: () => {
    document.dispatchEvent(new CustomEvent("customSubmit"));
  },
  getImageSrc: () => {
    const cardImage = document.getElementById("cardImage") as HTMLImageElement;
    return cardImage.src;
  },
  setTotalScore: (score: number) => {},
};

const overlay = document.createElement("div");
overlay.style.top = "0";
overlay.style.left = "0";
overlay.style.zIndex = "9999";

const wyPageHandlers = {
  submit: () => {
    overlay.remove();
  },
  getImageSrc: () => {
    const targetElement = document.querySelector(
      ".imgSection.clear>img"
    ) as HTMLImageElement;
    return targetElement?.src;
  },
  setTotalScore: (score: number) => {
    const inputOne = document.getElementById("inputOne") as HTMLInputElement;
    if (inputOne) {
      inputOne.value = score.toString();
      inputOne.dispatchEvent(new Event("input", { bubbles: true }));
    }
  },
};

const { submit, getImageSrc, setTotalScore } = location.host.includes("wylkyj.com")
  ? wyPageHandlers
  : testPageHandlers;

let previousSrc = "";

// 拖动功能相关变量
let isDragging = false;
let currentElement: HTMLElement | null = null;
let startX = 0;
let startY = 0;
let initialX = 0;

let initialY = 0;

// 存储div位置的键名
const POSITION_STORAGE_KEY = storageKeys.DIV_POSITIONS as string;
// 总分存储键名
const TOTAL_SCORE_KEY = storageKeys.TOTAL_SCORE as string;

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

// 计算总分
const calculateTotalScore = (res: AIResultItem[]): number => {
  return res.reduce((sum, r) => sum + r.score, 0);
};

// 更新总分显示

// 保存总分到localStorage
const saveTotalScore = (score: number): void => {
  try {
    localStorage.setItem(TOTAL_SCORE_KEY, score.toString());
  } catch (e) {
    console.error("Error saving total score:", e);
  }
};

// 键盘事件监听
const setupKeyboardListeners = (): void => {
  document.addEventListener("keydown", (e) => {
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        totalScore++;
        setTotalScore(totalScore);
        saveTotalScore(totalScore);
        break;
      case "ArrowDown":
        e.preventDefault();
        totalScore = Math.max(0, totalScore - 1);
        setTotalScore(totalScore);
        saveTotalScore(totalScore);
        break;
      case " ":
        e.preventDefault();
        totalScore = 0;
        setTotalScore(totalScore);
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

let scores: string[] = [];
chrome.storage.local.get(storageKeys.CRITERIA_CONFIG).then((res) => {
  const rules = res[storageKeys.CRITERIA_CONFIG] as { points: number }[] | undefined;
  if (rules) {
    scores = rules.map(r => r.points.toString());
    console.log(scores);
  }
});

const showAiResult = (result: AIResultItem[]) => {
  try {
    const res = result;
    console.log(res);
    document.body.appendChild(overlay);

    overlay.innerHTML = "";

    totalScore = calculateTotalScore(res);
    setTotalScore(totalScore);

    res.forEach((r, index) => {
      const div = document.createElement("div");
      div.style.position = "absolute";
      div.style.left = `${50 + index * 20}px`;
      div.style.top = `${150 + index * 40}px`;
      div.innerText = `${r.text}(${r.score}分,${r.reason})`;
      div.style.padding = "5px 10px";
      div.style.border = "1px solid #ccc";
      div.style.borderRadius = "4px";
      div.style.fontSize = "14px";
      let color = "";

      if (r.score === 0) {
        color = "red";
      } else if (!scores[index] || r.score === Number(scores[index])) {
        color = "green";
      } else {
        color = "blue";
      }
      div.style.color = color;

      overlay.appendChild(div);

      const uniqueId = `result-div-${index}`;

      makeDraggable(div, uniqueId);
    });
  } catch (e) {
    console.error(e);
  }
};

let showedResult = false;
let markRecordId: number | null = null;
const h = async () => {
  let delay = 500;
  const currentSrc = getImageSrc();
  if (currentSrc && (currentSrc !== previousSrc || !showedResult)) {
    if (previousSrc && markRecordId !== null) {
      sendMessage({
        action: "confirmMark",
        data: { markRecordId: markRecordId },
      });
      markRecordId = null;
    }
    overlay.remove();
    showedResult = false;
    delay = 1000;
    console.log("Image src changed:", currentSrc);
    previousSrc = currentSrc;
    const res = await sendMessage({
      action: "getAIResult",
      data: { url: currentSrc },
    });
    console.log(res);
    const result = "result" in res ? res.result : undefined;
    markRecordId = "markRecordId" in res ? res.markRecordId : null;
    if (result) {
      showedResult = true;
      const aiResult = result;
      const { [storageKeys.AI_DELAY]: delayRange = [0, 0] } = await chrome.storage.local.get(storageKeys.AI_DELAY);
      const [min, max] = delayRange as [number, number];
      const delay = Math.random() * (max - min) + min;
      console.log(`Delaying AI result by ${delay.toFixed(2)} seconds`);
      await new Promise(r => setTimeout(r, delay * 1000));
      showAiResult(aiResult);
    } else {
      console.error("No result from AI");
    }
  }
  setTimeout(h, delay);
};

h();

addEventListener("syncCurrentImage", async () => {
  const currentSrc = getImageSrc();
  const res = await sendMessage({
    action: "getResponse",
    data: { url: currentSrc },
  });
  return { dataUrl: res.dataUrl };
});
