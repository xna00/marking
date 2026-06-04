import {
  defaultModel,
  type ConfigItem,
} from "../ai.js";
import { blobToDataUrl, scaleImage } from "../image.js";
import { modelNames } from "../models.js";
import { storageKeys } from "../constants.js";
import { createRoot } from "react-dom/client";
import { useStateWithChromeStorage } from "./hooks/useStateWithStorage.js";
import { useEffect, useRef, useState } from "react";
import { CriteriaTable } from "./CriteriaTable.js";
import { defaultImageUrl } from "./imageUrl.js";
import { Banner } from "./Banner.js";
import { specialChars } from "./specialChars.js";
import { Login } from "./Login.js";
import { setAuthToken } from "../auth.js";
import { api } from "../api.js";
import { Router, Route, Switch } from "wouter";
import { navigate, useHashLocation } from "wouter/use-hash-location";

export type InputRef = {
  e: HTMLTextAreaElement | HTMLInputElement;
  setValue: (value: string) => void;
};
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

const Main = () => {
  const [modelName, setModelName] = useStateWithChromeStorage(
    storageKeys.AI_MODEL,
    defaultModel
  );
  const [criteriaConfig, setCriteriaConfig] = useStateWithChromeStorage<ConfigItem[]>(
    storageKeys.CRITERIA_CONFIG,
    [
      { position: "①左", points: 1, markingCriteria: "500mL容量瓶(不写“500mL”0分，“容量瓶”写成“溶量瓶”0分)" },
      { position: "①右", points: 2, markingCriteria: "13.6" },
      { position: "②", points: 1, markingCriteria: "25" },
      { position: "③", points: 2, markingCriteria: "将浓硫酸沿烧杯内壁缓慢注入水中(给分点一),并用玻璃棒不断搅拌(给分点二)" },
      { position: "④", points: 2, markingCriteria: "C" },
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
  const [aiDelay, setAiDelay] = useStateWithChromeStorage<[number, number]>(storageKeys.AI_DELAY, [0, 0]);
  const [result, setResult] = useState<{
    tag: "succeed" | "error";
    msg: string;
  }>({
    tag: "succeed",
    msg: "",
  });
  const [grading, setGrading] = useState(false);
  const [username, setUsername] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    api.currentUser().then(
      user => setUsername(user.username),
      (e) => {
        console.log(e)
        setUsername(null)
      }
    );
  }, []);

  const inputRef = useRef<InputRef>(null);

  const setInputRef = (o: InputRef) => {
    inputRef.current = o;
  };

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
    <>
      <div className="flex items-center justify-between px-2.5 py-1 border-b text-sm">
        {username === undefined ? (
          <span className="text-gray-500">检查登录状态...</span>
        ) : username ? (
          <div className="flex items-center gap-2">
            <span>当前用户：{username}</span>
            <button
              className="text-red-500 underline text-xs"
              onClick={() => {
                setAuthToken(null);
                chrome.storage.local.remove<{
                  [storageKeys.AUTH_TOKEN]: string
                }>(storageKeys.AUTH_TOKEN);
                setUsername(null);
              }}
            >
              退出登录
            </button>
          </div>
        ) : (
          <>
            <span className="text-red-500">未登录</span>
            <button className="text-blue-500 underline" onClick={() => navigate("/login")}>去登录</button>
          </>
        )}
      </div>
      <Banner />
      <div className="p-2.5">
        <label>模型</label>
        <select
          id="modelSelect"
          value={modelName}
          onChange={(e) => setModelName(e.target.value as any)}
        >
          {modelNames.map((name) => (
            <option key={name} value={name}>
              {name === "auto" ? "自动选择" : name}
            </option>
          ))}
        </select>

        <label>AI 结果延迟 (秒)</label>
        <div className="flex gap-x-2 items-center">
          <label className="flex items-center gap-x-1">
            最小
            <input
              type="number"
              min={0}
              className="!w-28"
              value={aiDelay[0]}
              onChange={e => {
                const val = Math.max(0, Number(e.target.value));
                setAiDelay([val, Math.max(val, aiDelay[1])]);
              }}
            />
          </label>
          <label className="flex items-center gap-x-1">
            最大
            <input
              type="number"
              min={0}
              className="!w-28"
              value={aiDelay[1]}
              onChange={e => {
                const val = Math.max(0, Number(e.target.value));
                setAiDelay([Math.min(aiDelay[0], val), val]);
              }}
            />
          </label>
        </div>
        <label>评分标准</label>
        <CriteriaTable
          config={criteriaConfig}
          onChange={setCriteriaConfig}
          setInputRef={setInputRef}
        />
        <div className="fixed right-0 top-2/3">
          <button
            popoverTarget="specialKeyboard"
            className="[anchor-name:--specialKeyboard-button] p-1"
          >
            特殊
            <br />
            键盘
          </button>
          <div
            popover="manual"
            id="specialKeyboard"
            className="[position-anchor:--specialKeyboard-button] ml-auto top-[anchor(top)] right-[anchor(left)] border"
          >
            <div
              className="grid p-2 gap-2"
              style={{
                gridTemplateColumns: "1fr ".repeat(specialChars[0].length),
              }}
            >
              {specialChars.flat().map((c) => (
                <div
                  key={c}
                  className="border rounded-sm w-5 h-5 p-0.5 cursor-pointer"
                  onClick={() => {
                    if (!inputRef.current) {
                      return;
                    }
                    const textarea = inputRef.current.e;
                    const currentValue = textarea.value;
                    const cursorPosition =
                      textarea.selectionStart ?? currentValue.length;
                    const newValue =
                      currentValue.slice(0, cursorPosition) +
                      c +
                      currentValue.slice(cursorPosition);
                    inputRef.current.setValue(newValue);
                    setTimeout(() => {
                      textarea.setSelectionRange(
                        cursorPosition + c.length,
                        cursorPosition + c.length
                      );
                      textarea.focus();
                    }, 0);
                  }}
                >
                  {c}
                </div>
              ))}
            </div>
            <a href="https://symboltown.com/zh/" target="_blank" className="text-blue-500 underline ml-2">更多符号</a>
          </div>
        </div>
        <div>
          <label />
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
              className="max-h-70"
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
        <div className={result.tag === "succeed" ? "" : "text-red-500"} style={{ whiteSpace: 'pre-wrap' }}>
          {result.msg}
        </div>
        <button
          className="w-full py-2 disabled:opacity-60 disabled:cursor-not-allowed"
          disabled={grading}
          onClick={() => {
            setGrading(true);
            api.ai.testMarkImage({
              model: modelName,
              config: criteriaConfig,
              imageUrl,
            }).then(
              (res) => {
                setResult({
                  tag: "succeed",
                  msg: res.map(([text, score, reason], i) => `${i + 1}. ${text}（${score}分，${reason}）`).join("\n"),
                });
              },
              (err) => {
                setResult({
                  tag: "error",
                  msg: err.message,
                });
              }
            ).finally(() => setGrading(false));
          }}
        >
          {grading ? "评分中..." : "评分"}
        </button>
      </div>
    </>
  );
};

const App = () => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    chrome.storage.local.get(storageKeys.AUTH_TOKEN).then((result) => {
      const t = result[storageKeys.AUTH_TOKEN] as string | undefined;
      if (t) setAuthToken(t);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-5 text-center text-gray-500">加载中...</div>;

  return (
    <Router hook={useHashLocation}>
      <Switch>
        <Route path="/login">
          <Login onLogin={(t) => {
            chrome.storage.local.set({ [storageKeys.AUTH_TOKEN]: t });
            setAuthToken(t);
            navigate("/");
          }} />
        </Route>
        <Route path="/">
          <Main />
        </Route>
      </Switch>
    </Router>
  );
};
const root = createRoot(document.getElementById("app")!);
root.render(<App />);

console.log("Marking extension popup loaded");
