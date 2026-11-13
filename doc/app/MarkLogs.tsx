import { useEffect, useState } from "react";
import { api } from "./app.js";
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

const imageBoxStyle: React.CSSProperties = {
  width: "240px",
  height: "160px",
  borderRadius: "4px",
  background: "#f3f4f6",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#9ca3af",
  fontSize: "12px",
};

const ImagePreview = ({ filename }: { filename: string }) => {
  const [failed, setFailed] = useState(false);
  // makeRequest 同步返回 Request，.url 已把 ?data= 编码好；认证靠浏览器自动带 cookie
  const src = api.logs.getMarkImage.makeRequest({ filename }).url;

  if (failed) return <div style={imageBoxStyle}>加载失败</div>;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      style={{ ...imageBoxStyle, objectFit: "contain" }}
    />
  );
};

export const MarkLogs = () => {
  const [logs, setLogs] = useState<MarkLogEntry[]>([]);
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState("");

  const fetchLogs = async (newLimit: number, newOffset: number) => {
    setError("");
    try {
      const data = await api.logs.markLogs({ limit: newLimit, offset: newOffset });
      setLogs(data);
      setLimit(newLimit);
      setOffset(newOffset);
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

  const formatCriteriaConfig = (json: string) => {
    try {
      const items: { position: string; points: number; markingCriteria: string }[] = JSON.parse(json);
      return items.map((item, i) => <div key={i}>{item.position} {item.points}分: {item.markingCriteria}</div>);
    } catch {
      return json;
    }
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
            {logs.map((log) => (
              <tr key={log.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={tdStyle}>{log.id}</td>
                <td style={tdStyle}>{log.markRecordId}</td>
                <td style={tdStyle}>
                  <UserInfo username={log.username} nickname={log.nickname} avatar={log.avatar} title={log.userId} />
                </td>
                <td style={tdStyle} title={log.model}>{log.model.length > 20 ? log.model.slice(0, 20) + "..." : log.model}</td>
                <td style={tdStyle}>
                  <div style={{ maxWidth: "300px", overflowX: "auto" }}>{formatCriteriaConfig(log.criteriaConfig)}</div>
                </td>
                <td style={tdStyle}>
                  <ImagePreview filename={log.imageFilename} />
                </td>
                <td style={tdStyle}>
                  <div style={{ maxWidth: "300px", overflowX: "auto" }}>{formatResult(log.result)}</div>
                </td>
                <td style={tdStyle}>{formatTime(log.createdAt, { seconds: true })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

const thStyle: React.CSSProperties = { textAlign: "left", padding: "8px 6px", borderBottom: "2px solid #ddd", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "8px 6px", verticalAlign: "top" };
