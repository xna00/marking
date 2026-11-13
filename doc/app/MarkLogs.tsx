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

const imageBoxStyle: React.CSSProperties = {
  height: `${THUMB_HEIGHT}px`,
  width: "auto",
  maxWidth: "240px",
  borderRadius: "4px",
  background: "#f3f4f6",
  display: "block",
  objectFit: "contain",
};

// 加载失败占位：固定宽度，避免宽度随空内容塌陷
const imageFallbackStyle: React.CSSProperties = {
  ...imageBoxStyle,
  width: "160px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#9ca3af",
  fontSize: "12px",
};

const ImagePreview = ({ src, onOpen }: { src: string; onOpen: () => void }) => {
  const [failed, setFailed] = useState(false);

  if (failed) return <div style={imageFallbackStyle}>加载失败</div>;
  return (
    <button
      type="button"
      onClick={onOpen}
      title="点击放大"
      style={{ padding: 0, border: "none", background: "none", cursor: "zoom-in", display: "block" }}
    >
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        style={imageBoxStyle}
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
      return <div style={{ maxWidth: "300px", whiteSpace: "pre-wrap" }}>{json}</div>;
    }

    const summary = items.map((item) => `${item.position} ${item.points}分: ${item.markingCriteria}`).join("  |  ");
    const needToggle = items.length > 1 || summary.length > CRITERIA_SUMMARY_MAX;

    return (
      <div>
        {needToggle && !expanded
          ? (
            <div style={{ maxWidth: "300px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={summary}>
              {summary}
            </div>
          )
          : (
            <div style={{ maxWidth: "300px", overflowX: "auto" }}>
              {items.map((item, i) => <div key={i}>{item.position} {item.points}分: {item.markingCriteria}</div>)}
            </div>
          )}
        {needToggle && (
          <button onClick={onToggle} style={toggleBtnStyle}>{expanded ? "收起" : "展开"}</button>
        )}
      </div>
    );
  };

  const formatResult = (json: string) => {
    try {
      const items: { text: string; score: number; reason: string }[] = JSON.parse(json);
      return items.map((item, i) => (
        // 简答题可能是分点作答（提示词要求每点一行），保留 \n 才会真的换行显示
        <div key={i} style={{ whiteSpace: "pre-wrap" }}>{item.text} {item.score}分 {item.reason}</div>
      ));
    } catch {
      return json;
    }
  };

  return (
    <>
      {error && <div style={{ color: "red", marginBottom: "12px", fontSize: "14px" }}>{error}</div>}

      <div style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
        <label style={{ fontSize: "13px" }}>每页条数:</label>
        <select value={limit} onChange={(e) => fetchLogs(Number(e.target.value), 0)} style={{ fontSize: "13px", padding: "2px 4px" }}>
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
        <button onClick={handlePrev} disabled={offset === 0} style={{ fontSize: "13px", padding: "2px 8px", cursor: offset === 0 ? "not-allowed" : "pointer" }}>
          上一页
        </button>
        <span style={{ fontSize: "13px" }}>第 {offset / limit + 1} 页</span>
        <button onClick={handleNext} disabled={logs.length < limit} style={{ fontSize: "13px", padding: "2px 8px", cursor: logs.length < limit ? "not-allowed" : "pointer" }}>
          下一页
        </button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: "#f5f5f5" }}>
              <th style={thStyle}>ID</th>
              <th style={thStyle}>记录ID</th>
              <th style={thStyle}>用户</th>
              <th style={thStyle}>模型</th>
              <th style={thStyle}>评分标准</th>
              <th style={thStyle}>图片</th>
              <th style={thStyle}>AI 结果</th>
              <th style={thStyle}>时间</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              // makeRequest 同步返回 Request，.url 已把 ?data= 编码好；认证靠浏览器自动带 cookie
              const imgSrc = api.logs.getMarkImage.makeRequest({ filename: log.imageFilename }).url;
              return (
                <tr key={log.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={tdStyle}>{log.id}</td>
                  <td style={tdStyle}>{log.markRecordId}</td>
                  <td style={tdStyle}>
                    <UserInfo username={log.username} nickname={log.nickname} avatar={log.avatar} title={log.userId} />
                  </td>
                  <td style={tdStyle} title={log.model}>{log.model.length > 20 ? log.model.slice(0, 20) + "..." : log.model}</td>
                  <td style={tdStyle}>
                    {formatCriteriaConfig(log.criteriaConfig, expandedIds.has(log.id), () => toggleExpanded(log.id))}
                  </td>
                  <td style={tdStyle}>
                    <ImagePreview src={imgSrc} onOpen={() => setPreview({ src: imgSrc, alt: log.imageFilename })} />
                  </td>
                  <td style={tdStyle}>
                    <div style={{ maxWidth: "300px", overflowX: "auto" }}>{formatResult(log.result)}</div>
                  </td>
                  <td style={tdStyle}>{formatTime(log.createdAt, { seconds: true })}</td>
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

const thStyle: React.CSSProperties = { textAlign: "left", padding: "8px 6px", borderBottom: "2px solid #ddd", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "8px 6px", verticalAlign: "top" };
const toggleBtnStyle: React.CSSProperties = {
  marginTop: "2px",
  padding: 0,
  border: "none",
  background: "none",
  color: "#2563eb",
  fontSize: "12px",
  cursor: "pointer",
};
