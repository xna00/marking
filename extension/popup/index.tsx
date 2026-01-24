import {
  recognizeImage,
  parseAIResult,
  defaultAISettings,
  markByAI2,
  fillCriteriaPlaceholder,
  makeCriteriaMDTable,
} from "../ai.js";
import { blobToDataUrl, scaleImage } from "../image.js";
import { modelNames } from "../models.js";
import { storageKeys } from "../constants.js";
import { createRoot } from "react-dom/client";
import { useStateWithChromeStorage } from "./hooks/useStateWithStorage.js";
import { Suspense, use, useEffect, useRef, useState } from "react";
import { CriteriaTable } from "./CriteriaTable.js";
import { defaultImageUrl } from "./imageUrl.js";
import { Banner } from "./Banner.js";

const syncImageSrc = async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]) {
    const res = await chrome.tabs.sendMessage(tabs[0].id!, {
      action: "syncCurrentImage",
    });
    if (res?.dataUrl) {
      const _dataUrl = res.dataUrl;
      const dataUrl = await scaleImage(_dataUrl, 700);
      return dataUrl;
    }
  }
};

const pasteImageFromClipboard = async () => {
  const clipboardItems = await navigator.clipboard.read();
  for (const item of clipboardItems) {
    for (const type of item.types) {
      if (type.startsWith("image/")) {
        const blob = await item.getType(type);
        if (blob) {
          const _dataUrl = await blobToDataUrl(blob);
          const dataUrl = await scaleImage(_dataUrl, 700);
          return dataUrl;
        }
      }
    }
  }
};
const App = () => {
  const [apiKey, setApiKey] = useStateWithChromeStorage(
    storageKeys.API_KEY,
    ""
  );
  const [modelName, setModelName] = useStateWithChromeStorage(
    storageKeys.AI_MODEL,
    defaultAISettings.model
  );
  const [prompt, setPrompt] = useStateWithChromeStorage(
    storageKeys.AI_PROMPT,
    defaultAISettings.prompt
  );
  const criteriaHeader = ["位置", "分值", "评分标准"];
  const [criteriaRules, setCriteriaRules] = useStateWithChromeStorage(
    storageKeys.CRITERIA_RULES,
    [
      ["第一行左", "1", "500mL容量瓶(不写“500mL”0分，“容量瓶”写成“溶量瓶”0分)"],
      ["第一行右", "2", "13.6"],
      ["第二行", "1", "25"],
      [
        "第三行",
        "2",
        "将浓硫酸沿烧杯内壁缓慢注入水中(给分点一),并用玻璃棒不断搅拌(给分点二)",
      ],
      ["第四行", "2", "C"],
    ]
  );
  const [imageUrl, setImageUrl] = useStateWithChromeStorage(
    storageKeys.IMAGE_SRC,
    defaultImageUrl
  );
  const [imageSize, setImageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [result, setResult] = useState<{
    tag: "succeed" | "error";
    msg: string;
  }>({
    tag: "succeed",
    msg: "",
  });

  useEffect(() => {
    const control = new AbortController();
    document.addEventListener(
      "paste",
      () => {
        pasteImageFromClipboard().then((dataUrl) => {
          dataUrl && setImageUrl(dataUrl);
        });
      },
      {
        signal: control.signal,
      }
    );
    return () => {
      control.abort();
    };
  }, []);
  return (
    <div>
      <Suspense>
        <Banner></Banner>
      </Suspense>
      <label htmlFor="doubaoKeyInput">API Key</label>
      <input
        type="text"
        placeholder="请输入API Key"
        className="w-full"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
      />

      <label>选择模型</label>
      <select
        id="modelSelect"
        value={modelName}
        onChange={(e) => setModelName(e.target.value as any)}
      >
        {modelNames.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>

      <div>
        系统提示词
        <div className="inline-flex gap-x-2">
          <button popoverTarget="previewPopover" className="small-btn">
            预览
          </button>
          <div
            popover="auto"
            id="previewPopover"
            className="m-auto p-4 border-2"
          >
            <pre>
              {fillCriteriaPlaceholder(
                prompt,
                makeCriteriaMDTable({
                  criteriaHeader,
                  criteriaRules,
                })
              )}
            </pre>
          </div>
          <button
            id="resetPrompt"
            className="small-btn"
            onClick={() => setPrompt(defaultAISettings.prompt)}
          >
            重置
          </button>
        </div>
      </div>
      <textarea
        id="promptTextarea"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      ></textarea>
      <label>评分标准</label>
      <CriteriaTable
        criteriaHeader={criteriaHeader}
        criteriaRules={criteriaRules}
        setCriteriaRules={setCriteriaRules}
      ></CriteriaTable>
      <div>
        <label></label>
        <div className="inline-block">
          答题卡图片
          <span>
            {imageSize ? `(${imageSize.width}x${imageSize.height})` : ""}
          </span>
          <div className="inline-flex gap-x-2">
            <button
              className="small-btn"
              onClick={() => {
                syncImageSrc().then((dataUrl) => {
                  dataUrl && setImageUrl(dataUrl);
                });
              }}
            >
              同步
            </button>
            <button
              className="small-btn"
              onClick={() => {
                pasteImageFromClipboard().then((dataUrl) => {
                  dataUrl && setImageUrl(dataUrl);
                });
              }}
            >
              粘贴
            </button>
            <button
              className="small-btn"
              onClick={() => setImageUrl(defaultImageUrl)}
            >
              重置
            </button>
          </div>
        </div>
        <div>
          <img
            className="h-70"
            src={imageUrl}
            onLoad={(e) => {
              const img = e.target as HTMLImageElement;
              setImageSize({
                width: img.naturalWidth,
                height: img.naturalHeight,
              });
            }}
          />
        </div>
      </div>
      <div className={result.tag === "succeed" ? "" : "text-red-500"}>
        {result.msg}
      </div>
      <button
        className="w-full py-2"
        onClick={() => {
          markByAI2(imageUrl, {
            model: modelName,
            prompt: fillCriteriaPlaceholder(
              prompt,
              makeCriteriaMDTable({
                criteriaHeader,
                criteriaRules,
              })
            ),
            apiKey: apiKey,
          }).then(
            (res) => {
              setResult({
                tag: "succeed",
                msg: parseAIResult(res),
              });
            },
            (err) => {
              setResult({
                tag: "error",
                msg: err.message,
              });
            }
          );
        }}
      >
        评分
      </button>
    </div>
  );
};
const root = createRoot(document.getElementById("app")!);
root.render(<App></App>);

console.log("Marking extension popup loaded");
