import { useEffect, useState } from "react";
import { api } from "./app.js";
import { UserInfo } from "./UserInfo.js";
import { formatTime } from "./utils.js";

type UserRow = {
  username: string;
  nickname: string | null;
  avatar: string | null;
  createdAt: string;
  lastActiveAt: string | null;
  totalCredits: number;
  consumedCredits: number;
  remainingCredits: number;
};

// 与 server/api/admin/index.ts 的 USER_SORT_KEYS 保持一致（不支持按用户名排序）
type SortKey = "totalCredits" | "consumedCredits" | "remainingCredits" | "createdAt" | "lastActiveAt";
type SortDir = "asc" | "desc";

const DEFAULT_SORT_BY: SortKey = "lastActiveAt";
const DEFAULT_SORT_DIR: SortDir = "desc";

const SortableTh = ({ label, sortKey, align, sortBy, sortDir, onSort }: {
  label: string;
  sortKey: SortKey;
  align: "left" | "right";
  sortBy: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}) => {
  const active = sortBy === sortKey;
  const arrow = active ? (sortDir === "asc" ? "↑" : "↓") : "↕";
  return (
    <th className={`px-3 py-2 border-b ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 cursor-pointer select-none ${active ? "text-blue-600" : "hover:text-gray-600"}`}
        title={active ? `当前${sortDir === "asc" ? "升序" : "降序"}，点击切换` : "点击排序"}
      >
        <span>{label}</span>
        <span className={active ? "" : "text-gray-300"}>{arrow}</span>
      </button>
    </th>
  );
};

export const AdminUsers = () => {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>(DEFAULT_SORT_BY);
  const [sortDir, setSortDir] = useState<SortDir>(DEFAULT_SORT_DIR);
  const [error, setError] = useState("");

  const fetchUsers = async (l: number, o: number, q: string, by: SortKey, dir: SortDir) => {
    setError("");
    try {
      const data = await api.admin.listUsers({ query: q || undefined, limit: l, offset: o, sortBy: by, sortDir: dir });
      setRows(data.rows);
      setTotal(data.total);
      setLimit(l);
      setOffset(o);
      setActiveQuery(q);
      setSortBy(by);
      setSortDir(dir);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "获取用户失败");
    }
  };

  useEffect(() => {
    fetchUsers(limit, 0, "", DEFAULT_SORT_BY, DEFAULT_SORT_DIR);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers(limit, 0, query, sortBy, sortDir);
  };

  // 同列切换方向；换列默认降序（都是数值/时间列）
  const handleSort = (key: SortKey) => {
    const nextDir: SortDir = key === sortBy ? (sortDir === "asc" ? "desc" : "asc") : "desc";
    fetchUsers(limit, 0, activeQuery, key, nextDir);
  };

  const handlePrev = () => fetchUsers(limit, Math.max(0, offset - limit), activeQuery, sortBy, sortDir);
  const handleNext = () => fetchUsers(limit, offset + limit, activeQuery, sortBy, sortDir);

  return (
    <>
      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

      <form onSubmit={handleSearch} className="flex gap-2 mb-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 border rounded px-3 py-2 text-sm"
          placeholder="按用户名搜索"
        />
        <button type="submit" className="bg-blue-600 text-white rounded px-4 py-2 text-sm cursor-pointer">
          搜索
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-3 py-2 border-b">用户</th>
              <SortableTh label="充值总量" sortKey="totalCredits" align="right" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortableTh label="已用" sortKey="consumedCredits" align="right" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortableTh label="剩余" sortKey="remainingCredits" align="right" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortableTh label="注册时间" sortKey="createdAt" align="left" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortableTh label="最后活跃" sortKey="lastActiveAt" align="left" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.username} className="border-b">
                <td className="px-3 py-2">
                  <UserInfo username={r.username} nickname={r.nickname} avatar={r.avatar} size={32} />
                </td>
                <td className="px-3 py-2 text-right">{r.totalCredits}</td>
                <td className="px-3 py-2 text-right">{r.consumedCredits}</td>
                <td className="px-3 py-2 text-right">{r.remainingCredits}</td>
                <td className="px-3 py-2">{formatTime(r.createdAt)}</td>
                <td className="px-3 py-2">{r.lastActiveAt ? formatTime(r.lastActiveAt) : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-gray-400">
                  无用户
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 mt-3 text-sm">
        <button
          onClick={handlePrev}
          disabled={offset === 0}
          className="px-3 py-1 border rounded cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          上一页
        </button>
        <span>
          第 {offset / limit + 1} 页 / 共 {Math.max(1, Math.ceil(total / limit))} 页（{total} 用户）
        </span>
        <button
          onClick={handleNext}
          disabled={offset + limit >= total}
          className="px-3 py-1 border rounded cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          下一页
        </button>
      </div>
    </>
  );
};
