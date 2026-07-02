import { useEffect, useState } from "react";
import { api } from "./app.js";

type MarkLogEntry = {
  id: number;
  markRecordId: number;
  userId: string;
  model: string;
  criteriaConfig: string;
  imageFilename: string;
  result: string;
  createdAt: string;
};

const ImagePreview = ({ filename }: { filename: string }) => {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let cancelled = false;
    api.logs.getMarkImage({ filename }).then(
      (res) => {
        if (cancelled) return;
        (res as unknown as Response).blob().then((blob) => {
          if (!cancelled) setSrc(URL.createObjectURL(blob));
        });
      },
      () => {},
    );
    return () => { cancelled = true; };
  }, [filename]);
  if (!src) return <span style={{ fontSize: "11px", color: "#999" }}>加载中...</span>;
  return <img src={src} alt="" style={{ maxWidth: "240px", maxHeight: "160px", display: "block", borderRadius: "4px" }} />;
};

export const MarkLogs = () => {
  const [adminUsername, setAdminUsername] = useState("");
  const [logs, setLogs] = useState<MarkLogEntry[]>([]);
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState("");

  const fetchLogs = async (newLimit: number, newOffset: number) => {
    setError("");
    try {
      const data = await api.logs.markLogs({ limit: newLimit, offset: newOffset });
      setLogs(data as MarkLogEntry[]);
      setLimit(newLimit);
      setOffset(newOffset);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "获取日志失败");
    }
  };

  useEffect(() => {
    api.currentUser().then(
      (u) => {
        setAdminUsername(u.username);
        fetchLogs(limit, 0);
      },
      () => {},
    );
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem("authToken");
    location.hash = "#/login";
  };

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
      return items.map((item, i) => <div key={i}>{item.text} {item.score}分 {item.reason}</div>);
    } catch {
      return json;
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "bold" }}>AI 评分日志</h2>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {adminUsername && <span style={{ fontSize: "13px", color: "#666" }}>{adminUsername}</span>}
          <button onClick={handleLogout} style={{ fontSize: "13px", color: "red", cursor: "pointer", border: "none", background: "none" }}>
            退出登录
          </button>
        </div>
      </div>

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
                <td style={tdStyle}>{log.userId}</td>
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
                <td style={tdStyle}>{log.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const thStyle: React.CSSProperties = { textAlign: "left", padding: "8px 6px", borderBottom: "2px solid #ddd", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "8px 6px", verticalAlign: "top" };