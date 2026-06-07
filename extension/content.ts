import { sendMessage, addEventListener } from "./message";
import { storageKeys } from "./constants";
import type { AIResultItem } from "@marking/server";
import { chromeStorageLocalGet } from "./storage";

console.log("content.ts loaded");

const testPageHandlers = {
  submit: () => {
    document.dispatchEvent(new CustomEvent("customSubmit"));
  },
  getImageSrc: () => {
    const cardImage = document.getElementById("cardImage") as HTMLImageElement;
    return cardImage.src;
  },
  setTotalScore: (score: number) => { },
};

const overlay = document.createElement("div");
overlay.style.top = "0";
overlay.style.left = "0";
overlay.style.zIndex = "9999";
document.body.appendChild(overlay);

const wyPageHandlers = {
  submit: () => {
    overlay.innerHTML = "";
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

let isDragging = false;
let currentElement: HTMLElement | null = null;
let startX = 0;
let startY = 0;
let initialX = 0;
let initialY = 0;

const POSITION_STORAGE_KEY = storageKeys.DIV_POSITIONS as string;
const TOTAL_SCORE_KEY = storageKeys.TOTAL_SCORE as string;

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

const savePosition = (id: string, left: number, top: number): void => {
  try {
    const positions = getStoredPositions();
    positions[id] = { left, top };
    localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(positions));
  } catch (e) {
    console.error("Error saving position:", e);
  }
};

let totalScore = 0;

const calculateTotalScore = (res: AIResultItem[]): number => {
  return res.reduce((sum, r) => sum + r.score, 0);
};

const saveTotalScore = (score: number): void => {
  try {
    localStorage.setItem(TOTAL_SCORE_KEY, score.toString());
  } catch (e) {
    console.error("Error saving total score:", e);
  }
};

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

setupKeyboardListeners();

const makeDraggable = (element: HTMLElement, id: string) => {
  element.style.cursor = "move";
  element.style.userSelect = "none";

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

    e.preventDefault();
  });

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
    const left = parseInt(currentElement.style.left || "0", 10);
    const top = parseInt(currentElement.style.top || "0", 10);
    savePosition(currentElement.id, left, top);
  }

  isDragging = false;
  currentElement = null;
});

let scores: number[] = [];

const showAiResult = (result: AIResultItem[]) => {
  try {
    console.log(result);
    overlay.innerHTML = "";

    totalScore = calculateTotalScore(result);
    setTotalScore(totalScore);

    result.forEach((r, index) => {
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
      } else if (!scores[index] || r.score === scores[index]) {
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

let lastResult: { result: AIResultItem[]; markRecordId: number } | { error: string } | null = null;

const startPolling = () => {
  let previousSrc = "";

  const poll = async () => {
    const currentSrc = getImageSrc();
    if (currentSrc && currentSrc !== previousSrc) {
      previousSrc = currentSrc;
      await handleImageSrcChange(currentSrc);
    }
    setTimeout(poll, 500);
  };

  poll();
};

const handleImageSrcChange = async (currentSrc: string) => {
  if (lastResult && "markRecordId" in lastResult) {
    sendMessage({
      action: "confirmMark",
      data: { markRecordId: lastResult.markRecordId },
    });
  }
  overlay.innerHTML = "";
  console.log("Image src changed:", currentSrc);
  lastResult = await sendMessage({
    action: "getAIResult",
    data: { url: currentSrc },
  });
  console.log(lastResult);
  if ("error" in lastResult) {
    if (lastResult.error === 'pending') return
    overlay.innerHTML = `<div style="color:red;padding:10px 20px;position:fixed;top:30vh;left:50%;transform:translateX(-50%);background:#fff;border:1px solid #ccc;border-radius:4px;z-index:10000;text-align:center">AI 评分失败：${lastResult.error}</div>`;
    console.error("AI result error:", lastResult.error);
  } else {
    const result = lastResult.result;
    const { [storageKeys.CRITERIA_CONFIG]: rules, [storageKeys.AI_DELAY]: delayRange = [0, 0] as const } = await chromeStorageLocalGet([storageKeys.CRITERIA_CONFIG, storageKeys.AI_DELAY]);
    scores = rules?.map(r => r.points) ?? [];
    const [min, max] = delayRange;
    const waitSeconds = Math.random() * (max - min) + min;
    console.log(`Delaying AI result by ${waitSeconds.toFixed(2)} seconds`);
    await new Promise(r => setTimeout(r, waitSeconds * 1000));
    showAiResult(result);
  }
};

startPolling();

chrome.storage.local.onChanged.addListener((changes) => {
  console.log(changes)
  if (storageKeys.AUTH_TOKEN in changes) {
    if (lastResult && "error" in lastResult) {
      const currentSrc = getImageSrc();
      if (currentSrc) handleImageSrcChange(currentSrc);
    }
  }
});

addEventListener('urlResponseUpdated', async (url) => {
  const currentSrc = getImageSrc()
  if (lastResult && 'error' in lastResult && url === currentSrc) {
    handleImageSrcChange(currentSrc)
  }
  return undefined
})
addEventListener("syncCurrentImage", async () => {
  const currentSrc = getImageSrc();
  const res = await sendMessage({
    action: "getResponse",
    data: { url: currentSrc },
  });
  return { dataUrl: res.dataUrl };
});
