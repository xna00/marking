import { sendMessage, addEventListener } from "../message.js";
import {
  defaultModel,
} from "../ai.js";
import type { ConfigItem, ModelName } from "../models.js";
import { blobToDataUrl, scaleImage } from "../image.js";
import { storageKeys, shouldReloadOnMismatch, EXTENSION_VERSION, HOST, MARKING_PAGE_URLS } from "../constants.js";
import { createRoot } from "react-dom/client";
import { useEffect, useRef, useState } from "react";
import { CriteriaTable } from "./CriteriaTable.js";

import { defaultImageUrl } from "./imageUrl.js";
import { Banner } from "./Banner.js";
import { specialChars } from "./specialChars.js";
import { Login } from "./Login.js";
import { api } from "../api.js";
import { SYNC_KEYS } from "../settingsSync.js";
import { chromeStorageLocalGet, chromeStorageLocalSet, chromeStorageLocalRemove } from "../storage.js";
import { Router, Route, Switch } from "wouter";
import { navigate, useHashLocation } from "wouter/use-hash-location";

chrome.storage.local.get('reloadSentinel').then(async ({ reloadSentinel }) => {
  if (shouldReloadOnMismatch(reloadSentinel as string | undefined)) {
    try {
      const bgVersion = await sendMessage({ action: "getBackgroundVersion" });
      if (bgVersion === chrome.runtime.getManifest().version) {
        chrome.storage.local.set({ reloadSentinel: chrome.runtime.getManifest().version });
        return;
      }
    } catch {
      // background not responding, treat as stale → reload
    }
    chrome.storage.local.set({ reloadSentinel: chrome.runtime.getManifest().version });
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        func: () => {
          setTimeout(() => location.reload(), 3000);
        },
      });
    }
    chrome.runtime.reload();
  }
});

export type InputRef = {
  e: HTMLTextAreaElement | HTMLInputElement;
  setValue: (value: string) => void;
};
// 读取单个 tab 的答题卡图片 src；注入失败或页面无该元素都算"这个不行"。
const readImgSrc = async (tabId: number): Promise<string | null> => {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "ISOLATED",
    func: () => {
      const img = document.querySelector('.imgSection.clear>img') as HTMLImageElement;
      return img?.src ?? null;
    },
  });
  return typeof result === "string" && result ? result : null;
};

const syncImageSrc = async () => {
  // 候选：当前窗口的改卷页面，无则全局兜底
  const inWin = await chrome.tabs.query({ currentWindow: true, url: MARKING_PAGE_URLS });
  const pool = inWin.length ? inWin : await chrome.tabs.query({ url: MARKING_PAGE_URLS });
  if (pool.length === 0) throw new Error("未找到改卷页面，请先打开试卷页面再同步");
  // 其余候选从右到左（index 降序，最近开的改卷页通常在右边）
  const ordered = [...pool].sort((a, b) => b.index - a.index);
  // 当前正在看的改卷页优先（哪怕它在更左）
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true, url: MARKING_PAGE_URLS });
  const candidates = [
    ...(active?.id ? ordered.filter((t) => t.id === active.id) : []),
    ...ordered.filter((t) => t.id !== active?.id),
  ];
  // 逐个试，哪个成功用哪个（成功 = 读到非空图片 src 且取到响应并缩放成功）
  let sawImage = false; // 读到过图片 src
  let responseMissing = false; // 读到过 src 但 getResponse 无响应
  for (const tab of candidates) {
    if (tab.id == null) continue;
    try {
      const url = await readImgSrc(tab.id);
      if (!url) continue; // 该页没有答题卡图片（加载中/非做题页）→ 试下一个
      sawImage = true;
      const res = await sendMessage({ action: "getResponse", data: { url } });
      if ("error" in res) continue; // 该页图片无缓存响应 → 试下一个
      if (!res.dataUrl) { responseMissing = true; continue; }
      return await scaleImage(res.dataUrl);
    } catch {
      // 注入失败（如 popup 自身 chrome-extension 页、tab 已关闭）→ 试下一个
    }
  }
  if (responseMissing) throw new Error("已找到改卷页面，但图片响应未抓到，请先刷新改卷页面加载图片后重试");
  if (sawImage) throw new Error("改卷页面未显示答题卡图片，请刷新改卷页面后重试");
  throw new Error("未找到可用的改卷页面，请先打开试卷页面再同步");
};

const pasteImageFromClipboard = async () => {
  const clipboardItems = await navigator.clipboard.read();
  for (const item of clipboardItems) {
    for (const type of item.types) {
      if (type.startsWith("image/")) {
        const blob = await item.getType(type);
        if (blob) {
          const _dataUrl = await blobToDataUrl(blob);
          const dataUrl = await scaleImage(_dataUrl);
          return dataUrl;
        }
      }
    }
  }
};

type Settings = {
  [storageKeys.AI_MODEL]: ModelName;
  [storageKeys.CRITERIA_CONFIG]: ConfigItem[];
  [storageKeys.IMAGE_SRC]: string;
  [storageKeys.AI_DELAY]: [number, number];
};

const defaultSettings: Settings = {
  [storageKeys.AI_MODEL]: defaultModel,
  [storageKeys.CRITERIA_CONFIG]: [
    { position: "①左", points: 1, markingCriteria: "500mL容量瓶(不写“500mL”0分，“容量瓶”写成“溶量瓶”0分)" },
    { position: "①右", points: 2, markingCriteria: "13.6" },
    { position: "②", points: 1, markingCriteria: "25" },
    { position: "③", points: 2, markingCriteria: "将浓硫酸沿烧杯内壁缓慢注入水中(给分点一),并用玻璃棒不断搅拌(给分点二)" },
    { position: "④", points: 2, markingCriteria: "C" },
  ],
  [storageKeys.IMAGE_SRC]: defaultImageUrl,
  [storageKeys.AI_DELAY]: [0, 0],
};

const Main = () => {
  const [settings, setSettings] = useState(defaultSettings);
  const [models, setModels] = useState<{ id: string; label: string }[]>([]);
  const [imageSize, setImageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => { api.ai.getModels().then(setModels).catch(() => {}); }, []);

  useEffect(() => {
    chromeStorageLocalGet(null).then(r => {
      setSettings({
        [storageKeys.AI_MODEL]: r[storageKeys.AI_MODEL] ?? defaultSettings[storageKeys.AI_MODEL],
        [storageKeys.CRITERIA_CONFIG]: r[storageKeys.CRITERIA_CONFIG] ?? defaultSettings[storageKeys.CRITERIA_CONFIG],
        [storageKeys.IMAGE_SRC]: r[storageKeys.IMAGE_SRC] ?? defaultSettings[storageKeys.IMAGE_SRC],
        [storageKeys.AI_DELAY]: r[storageKeys.AI_DELAY] ?? defaultSettings[storageKeys.AI_DELAY],
      });
    });
  }, []);

  // 云同步：登录后 background 拉取并写回本地，popup 需感知并刷新，否则停留默认值。
  // 与自身写入做深比较，相同则不动，避免 setState → 写本地 → onChanged 死循环。
  useEffect(() => {
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== "local") return;
      if (!SYNC_KEYS.some((key) => key in changes)) return;
      chromeStorageLocalGet(null).then(r => {
        setSettings(prev => {
          const next = {
            [storageKeys.AI_MODEL]: r[storageKeys.AI_MODEL] ?? defaultSettings[storageKeys.AI_MODEL],
            [storageKeys.CRITERIA_CONFIG]: r[storageKeys.CRITERIA_CONFIG] ?? defaultSettings[storageKeys.CRITERIA_CONFIG],
            [storageKeys.IMAGE_SRC]: r[storageKeys.IMAGE_SRC] ?? defaultSettings[storageKeys.IMAGE_SRC],
            [storageKeys.AI_DELAY]: r[storageKeys.AI_DELAY] ?? defaultSettings[storageKeys.AI_DELAY],
          };
          return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
        });
      });
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);
  useEffect(() => { chromeStorageLocalSet(settings); }, [settings]);
  const [result, setResult] = useState<{
    tag: "succeed" | "error";
    msg: string;
  }>({
    tag: "succeed",
    msg: "",
  });
  const [grading, setGrading] = useState(false);
  const [username, setUsername] = useState<string | null | undefined>(undefined);
  const [consumedCredits, setConsumedCredits] = useState<number | null>(null);
  const [remainingCredits, setRemainingCredits] = useState<number | null>(null);

  useEffect(() => {
    api.currentUser().then(
      user => {
        setUsername(user.username);
        api.ai.getBalance().then(
          (b) => {
            setConsumedCredits(b.consumedCredits);
            setRemainingCredits(b.remainingCredits);
          },
          () => {}
        );
      },
      (e) => {
        console.log(e);
        setUsername(null);
      }
    );
  }, []);

  useEffect(() => {
    return addEventListener("usageUpdated", async (data) => {
      setConsumedCredits(data.usage.consumedCredits);
      setRemainingCredits(data.usage.remainingCredits);
      return undefined;
    });
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
          dataUrl && setSettings(s => ({ ...s, [storageKeys.IMAGE_SRC]: dataUrl }));
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
      <div className="px-3 py-2 text-sm bg-blue-50 rounded-lg">
        {username === undefined ? (
          <span className="text-gray-500">检查登录状态...</span>
        ) : username ? (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>用户名：{username}</span>
                <button
                  className="text-gray-400 hover:text-red-500 text-xs px-2 py-0.5 rounded hover:bg-gray-100"
                  onClick={() => {
                    chromeStorageLocalRemove(storageKeys.AUTH_TOKEN);
                    setUsername(null);
                  }}
                >
                  退出
                </button>
              </div>
              <div className="flex items-center gap-4">
                <a href={HOST} target="_blank" rel="noopener noreferrer" className="text-blue-500 text-xs underline">使用说明</a>
              </div>
            </div>
            {consumedCredits !== null && remainingCredits !== null && (
              <div className="flex items-center justify-between mt-1">
                <span className="text-gray-600 text-xs">
                  已用 {consumedCredits} 份 / 剩余 {remainingCredits} 份
                </span>
                <div className="flex gap-3">
                  <span className="text-blue-500 text-xs underline cursor-pointer" onClick={() => {
                    chromeStorageLocalGet(storageKeys.AUTH_TOKEN).then(r => {
                      const t = r[storageKeys.AUTH_TOKEN];
                      window.open(`${HOST}/app/?token=${t}#/usage`, "_blank");
                    });
                  }}>详情</span>
                  <span className="text-blue-500 text-xs underline cursor-pointer" onClick={() => {
                    chromeStorageLocalGet(storageKeys.AUTH_TOKEN).then(r => {
                      const t = r[storageKeys.AUTH_TOKEN];
                      window.open(`${HOST}/app/?token=${t}#/recharge`, "_blank");
                    });
                  }}>充值(0.3元/100份)</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-red-500">未登录</span>
              <button className="text-white bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded text-xs" onClick={() => navigate("/login")}>去登录</button>
            </div>
            <div className="flex items-center gap-4">
              <a href={HOST} target="_blank" rel="noopener noreferrer" className="text-blue-500 text-xs underline">使用说明</a>
            </div>
          </div>
        )}
      </div>
      <Banner />
      <div className="p-2.5">
        <label>模型</label>
        <select
          id="modelSelect"
          value={settings[storageKeys.AI_MODEL]}
          onChange={(e) => setSettings(s => ({ ...s, [storageKeys.AI_MODEL]: e.target.value }))}
        >
          <option key="auto" value="auto">自动选择</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
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
              value={settings[storageKeys.AI_DELAY][0]}
              onChange={e => {
                const val = Math.max(0, Number(e.target.value));
                setSettings(s => ({ ...s, [storageKeys.AI_DELAY]: [val, Math.max(val, s[storageKeys.AI_DELAY][1])] }));
              }}
            />
          </label>
          <label className="flex items-center gap-x-1">
            最大
            <input
              type="number"
              min={0}
              className="!w-28"
              value={settings[storageKeys.AI_DELAY][1]}
              onChange={e => {
                const val = Math.max(0, Number(e.target.value));
                setSettings(s => ({ ...s, [storageKeys.AI_DELAY]: [Math.min(s[storageKeys.AI_DELAY][0], val), val] }));
              }}
            />
          </label>
        </div>
        <div className="flex items-center gap-2">
          <label className="!inline !mb-0">评分标准</label>
          <button
            className="small-btn"
            onClick={() => setSettings(s => ({ ...s, [storageKeys.CRITERIA_CONFIG]: defaultSettings[storageKeys.CRITERIA_CONFIG] }))}
          >
            重置
          </button>
        </div>
        <CriteriaTable
          config={settings[storageKeys.CRITERIA_CONFIG]}
          onChange={(v) => setSettings(s => ({ ...s, [storageKeys.CRITERIA_CONFIG]: v }))}
          setInputRef={setInputRef}
        />
        <div className="fixed right-0 top-2/3">
          <button
            popoverTarget="specialKeyboard"
            className="[anchor-name:--specialKeyboard-button] px-[8.6px] py-1"
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
                gridTemplateColumns: "1fr ".repeat(specialChars[0].length - 2),
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
        <div className="mt-2">
          <div className="flex items-center gap-2">
            <label className="!inline !mb-0">
              答题卡图片
              <span>
                {imageSize ? `(${imageSize.width}x${imageSize.height})` : ""}
              </span>
            </label>
            <div className="inline-flex gap-x-3">
              <button
                className="small-btn"
                onClick={async () => {
                  try {
                    const dataUrl = await syncImageSrc()
                    if (dataUrl) {
                      setSettings(s => ({ ...s, [storageKeys.IMAGE_SRC]: dataUrl }));
                      setResult({ tag: "succeed", msg: "" });
                    }
                  } catch (e) {
                    const msg = e instanceof Error ? e.message : String(e)
                    const ver = navigator.userAgent.match(/(Chrome|Edg|Firefox)\/([\d.]+)/)
                    const browser = ver ? `${ver[1]} ${ver[2]}` : navigator.userAgent
                    setResult({ tag: "error", msg: `${msg}\n扩展版本: ${chrome.runtime.getManifest().version} (build: ${EXTENSION_VERSION})\n浏览器: ${browser}` })
                  }
                }}
              >
                同步
              </button>
              <button
                className="small-btn"
                onClick={() => {
                  pasteImageFromClipboard().then((dataUrl) => {
                    dataUrl && setSettings(s => ({ ...s, [storageKeys.IMAGE_SRC]: dataUrl }));
                  });
                }}
              >
                粘贴
              </button>
              <button
                className="small-btn"
                onClick={() => setSettings(s => ({ ...s, [storageKeys.IMAGE_SRC]: defaultImageUrl }))}
              >
                重置
              </button>
            </div>
          </div>
          <div>
            <img
              className="max-h-70"
              src={settings[storageKeys.IMAGE_SRC]}
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
              model: settings[storageKeys.AI_MODEL],
              config: settings[storageKeys.CRITERIA_CONFIG],
              imageUrl: settings[storageKeys.IMAGE_SRC],
            }).then(
              (res) => {
                setResult({
                  tag: "succeed",
                  msg: res.map((r, i) => `${i + 1}. ${r.text}（${r.score}分，${r.reason}）`).join("\n"),
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
    chromeStorageLocalGet(storageKeys.AUTH_TOKEN).then((result) => {
      const t = result[storageKeys.AUTH_TOKEN];
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-5 text-center text-gray-500">加载中...</div>;

  return (
    <Router hook={useHashLocation}>
      <Switch>
        <Route path="/login">
          <Login onLogin={(t) => {
            chrome.action.setBadgeText({ text: "" });
            chromeStorageLocalSet({ [storageKeys.AUTH_TOKEN]: t }).then(() => {
              navigate("/");
            })
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
