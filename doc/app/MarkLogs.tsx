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

export const MarkLogs = () => {
  const [adminUsername, setAdminUsername] = useState("");
  const [logs, setLogs] = useState<MarkLogEntry[]>([]);
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [imageModal, setImageModal] = useState<string | null>(null);
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

  const toggleRow = (id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleLogout = () => {
    sessionStorage.removeItem("authToken");
    location.hash = "#/login";
  };

  const handlePrev = () => fetchLogs(limit, Math.max(0, offset - limit));
  const handleNext = () => fetchLogs(limit, offset + limit);

  const viewImage = async (filename: string) => {
    try {
      const res = await api.logs.markImage({ filename });
      const blob = await (res as unknown as Response).blob();
      setImageModal(URL.createObjectURL(blob));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载图片失败");
    }
  };

  const formatJson = (json: string) => {
    try {
      return JSON.stringify(JSON.parse(json), null, 2);
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
                  <button onClick={() => toggleRow(log.id)} style={{ cursor: "pointer", border: "none", background: "none", color: "#2563eb", fontSize: "12px", padding: 0 }}>
                    {expandedRows.has(log.id) ? "收起" : "展开"}
                  </button>
                  {expandedRows.has(log.id) && (
                    <pre style={{ maxWidth: "300px", overflow: "auto", fontSize: "11px", background: "#f9f9f9", padding: "4px", margin: "4px 0 0 0", borderRadius: "2px" }}>{formatJson(log.criteriaConfig)}</pre>
                  )}
                </td>
                <td style={tdStyle}>
                  <button onClick={() => viewImage(log.imageFilename)} style={{ cursor: "pointer", border: "none", background: "none", color: "#2563eb", fontSize: "12px", padding: 0 }}>
                    {log.imageFilename}
                  </button>
                </td>
                <td style={tdStyle}>
                  <button onClick={() => toggleRow(-log.id)} style={{ cursor: "pointer", border: "none", background: "none", color: "#2563eb", fontSize: "12px", padding: 0 }}>
                    {expandedRows.has(-log.id) ? "收起" : "展开"}
                  </button>
                  {expandedRows.has(-log.id) && (
                    <pre style={{ maxWidth: "300px", overflow: "auto", fontSize: "11px", background: "#f9f9f9", padding: "4px", margin: "4px 0 0 0", borderRadius: "2px" }}>{formatJson(log.result)}</pre>
                  )}
                </td>
                <td style={tdStyle}>{log.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {imageModal && (
        <div
          onClick={() => { URL.revokeObjectURL(imageModal); setImageModal(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, cursor: "pointer" }}
        >
          <img src={imageModal} alt="评分图片" style={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain" }} />
        </div>
      )}
    </div>
  );
};

const thStyle: React.CSSProperties = { textAlign: "left", padding: "8px 6px", borderBottom: "2px solid #ddd", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "8px 6px", verticalAlign: "top" };