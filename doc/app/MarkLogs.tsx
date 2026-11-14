import { useEffect, useState } from "react";
import { api } from "./app.js";
import { ImageLightbox } from "./ImageLightbox.js";
import { UserInfo } from "./UserInfo.js";
import { formatTime } from "./utils.js";

type MarkLogEntry = {
  id: number;
  markRecordId: number;
  userId: string;
  username: string;
  nickname: string | null;
  avatar: string | null;
  model: string;
  criteriaConfig: string;
  imageFilename: string;
  result: string;
  createdAt: string;
};

// 缩略图高度：表格行高主要由它决定，点开弹层看原图
const THUMB_HEIGHT = 100;

const imageBaseStyle: React.CSSProperties = {
  borderRadius: "4px",
  background: "#f3f4f6",
  display: "block",
  objectFit: "contain",
};

const imageBoxStyle: React.CSSProperties = {
  ...imageBaseStyle,
  height: `${THUMB_HEIGHT}px`,
  width: "auto",
  maxWidth: "240px",
};

// 卡片里图片撑满整行宽度；高度按比例，过高的长图截到 200px，
// 内容用 contain 完整缩放（不裁剪），点开灯箱看原图
const cardImageStyle: React.CSSProperties = {
  ...imageBaseStyle,
  width: "100%",
  height: "auto",
  maxHeight: "200px",
};

const imageFallbackBaseStyle: React.CSSProperties = {
  ...imageBaseStyle,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#9ca3af",
  fontSize: "12px",
};

// 加载失败占位：固定宽度，避免宽度随空内容塌陷
const imageFallbackStyle: React.CSSProperties = {
  ...imageFallbackBaseStyle,
  height: `${THUMB_HEIGHT}px`,
  width: "160px",
};

const cardFallbackStyle: React.CSSProperties = {
  ...imageFallbackBaseStyle,
  width: "100%",
  height: "160px",
};

const ImagePreview = ({ src, onOpen, fill = false }: {
  src: string;
  onOpen: () => void;
  fill?: boolean;
}) => {
  const [failed, setFailed] = useState(false);

  if (failed) return <div style={fill ? cardFallbackStyle : imageFallbackStyle}>加载失败</div>;
  return (
    <button
      type="button"
      onClick={onOpen}
      title="点击放大"
      aria-label="查看原图"
      className={`block cursor-zoom-in border-0 bg-transparent p-0 ${fill ? "w-full" : "min-w-11"}`}
    >
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        style={fill ? cardImageStyle : imageBoxStyle}
      />
    </button>
  );
};

// 评分标准摘要超过这个字数（或条目超过 1 条）才给「展开」
const CRITERIA_SUMMARY_MAX = 40;

export const MarkLogs = () => {
  const [logs, setLogs] = useState<MarkLogEntry[]>([]);
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState("");
  // 点击放大的图片；null 表示不显示弹层
  const [preview, setPreview] = useState<{ src: string; alt: string } | null>(null);
  // 已展开评分标准的日志 id
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());

  const toggleExpanded = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const fetchLogs = async (newLimit: number, newOffset: number) => {
    setError("");
    try {
      const data = await api.logs.markLogs({ limit: newLimit, offset: newOffset });
      setLogs(data);
      setLimit(newLimit);
      setOffset(newOffset);
      // 换页后旧 id 不再出现，清空避免残留状态
      setExpandedIds(new Set());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "获取日志失败");
    }
  };

  useEffect(() => {
    fetchLogs(limit, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePrev = () => fetchLogs(limit, Math.max(0, offset - limit));
  const handleNext = () => fetchLogs(limit, offset + limit);

  // 评分标准默认折叠成一行（超出省略），点「展开」看完整细则
  const formatCriteriaConfig = (json: string, expanded: boolean, onToggle: () => void) => {
    let items: { position: string; points: number; markingCriteria: string }[];
    try {
      items = JSON.parse(json);
      if (!Array.isArray(items)) throw new Error("not array");
    } catch {
      // 解析失败就把原文铺开，避免后台看不到任何信息
      return <div className="max-w-[300px] whitespace-pre-wrap">{json}</div>;
    }

    const summary = items.map((item) => `${item.position} ${item.points}分: ${item.markingCriteria}`).join("  |  ");
    const needToggle = items.length > 1 || summary.length > CRITERIA_SUMMARY_MAX;

    return (
      <div>
        {needToggle && !expanded
          ? <div className="max-w-[300px] truncate" title={summary}>{summary}</div>
          : (
            <div className="max-w-[300px] overflow-x-auto">
              {items.map((item, i) => <div key={i}>{item.position} {item.points}分: {item.markingCriteria}</div>)}
            </div>
          )}
        {needToggle && (
          <button
            onClick={onToggle}
            className="mt-0.5 cursor-pointer border-0 bg-transparent p-0 text-xs text-blue-600"
          >
            {expanded ? "收起" : "展开"}
          </button>
        )}
      </div>
    );
  };

  const formatResult = (json: string) => {
    try {
      const items: { text: string; score: number; reason: string }[] = JSON.parse(json);
      return items.map((item, i) => (
        // 简答题可能是分点作答（提示词要求每点一行），保留 \n 才会真的换行显示
        <div key={i} className="whitespace-pre-wrap">{item.text} {item.score}分 {item.reason}</div>
      ));
    } catch {
      return json;
    }
  };

  const openPreview = (log: MarkLogEntry, imgSrc: string) =>
    setPreview({ src: imgSrc, alt: log.imageFilename });

  return (
    <>
      {error && <div className="mb-3 text-sm text-red-500">{error}</div>}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="text-[13px]">每页条数:</label>
        <select
          value={limit}
          onChange={(e) => fetchLogs(Number(e.target.value), 0)}
          className="min-h-9 rounded border px-1 text-[13px] md:min-h-0 md:py-0.5"
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
        <button
          onClick={handlePrev}
          disabled={offset === 0}
          className="min-h-9 cursor-pointer rounded border px-2 text-[13px] disabled:cursor-not-allowed md:min-h-0 md:py-0.5"
        >
          上一页
        </button>
        <span className="text-[13px]">第 {offset / limit + 1} 页</span>
        <button
          onClick={handleNext}
          disabled={logs.length < limit}
          className="min-h-9 cursor-pointer rounded border px-2 text-[13px] disabled:cursor-not-allowed md:min-h-0 md:py-0.5"
        >
          下一页
        </button>
      </div>

      {/* 手机端：每条日志一张卡片，避免 8 列表格左右拖 */}
      <ul className="space-y-3 md:hidden">
        {logs.map((log) => {
          const imgSrc = api.logs.getMarkImage.makeRequest({ filename: log.imageFilename }).url;
          return (
            <li key={log.id} className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between gap-2 text-xs text-gray-500">
                <span>#{log.id} · 记录 {log.markRecordId}</span>
                <span className="shrink-0">{formatTime(log.createdAt, { seconds: true })}</span>
              </div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <UserInfo
                  username={log.username}
                  nickname={log.nickname}
                  avatar={log.avatar}
                  title={log.userId}
                  size={28}
                />
                <span className="min-w-0 truncate text-xs text-gray-500" title={log.model}>{log.model}</span>
              </div>
              <ImagePreview fill src={imgSrc} onOpen={() => openPreview(log, imgSrc)} />
              <div className="mt-2 text-[13px]">{formatResult(log.result)}</div>
              <div className="mt-2 text-[13px]">
                {formatCriteriaConfig(log.criteriaConfig, expandedIds.has(log.id), () => toggleExpanded(log.id))}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-gray-50">
              <th className={thCls}>ID</th>
              <th className={thCls}>记录ID</th>
              <th className={thCls}>用户</th>
              <th className={thCls}>模型</th>
              <th className={thCls}>评分标准</th>
              <th className={thCls}>图片</th>
              <th className={thCls}>AI 结果</th>
              <th className={thCls}>时间</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              // makeRequest 同步返回 Request，.url 已把 ?data= 编码好；认证靠浏览器自动带 cookie
              const imgSrc = api.logs.getMarkImage.makeRequest({ filename: log.imageFilename }).url;
              return (
                <tr key={log.id} className="border-b border-gray-100">
                  <td className={tdCls}>{log.id}</td>
                  <td className={tdCls}>{log.markRecordId}</td>
                  <td className={tdCls}>
                    <UserInfo username={log.username} nickname={log.nickname} avatar={log.avatar} title={log.userId} />
                  </td>
                  <td className={tdCls} title={log.model}>{log.model.length > 20 ? log.model.slice(0, 20) + "..." : log.model}</td>
                  <td className={tdCls}>
                    {formatCriteriaConfig(log.criteriaConfig, expandedIds.has(log.id), () => toggleExpanded(log.id))}
                  </td>
                  <td className={tdCls}>
                    <ImagePreview src={imgSrc} onOpen={() => openPreview(log, imgSrc)} />
                  </td>
                  <td className={tdCls}>
                    <div className="max-w-[300px] overflow-x-auto">{formatResult(log.result)}</div>
                  </td>
                  <td className={tdCls}>{formatTime(log.createdAt, { seconds: true })}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ImageLightbox
        src={preview?.src ?? null}
        alt={preview?.alt}
        onClose={() => setPreview(null)}
      />
    </>
  );
};

const thCls = "whitespace-nowrap border-b-2 border-gray-300 px-1.5 py-2 text-left";
const tdCls = "px-1.5 py-2 align-top";
