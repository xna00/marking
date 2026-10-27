import { useEffect, useState } from "react";
import { api } from "./app.js";
import { AdminNav } from "./AdminNav.js";

type UserRow = {
  username: string;
  nickname: string | null;
  avatar: string | null;
  createdAt: string;
  totalCredits: number;
  consumedCredits: number;
  remainingCredits: number;
};

export const AdminUsers = () => {
  const [adminUsername, setAdminUsername] = useState("");
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [error, setError] = useState("");

  const fetchUsers = async (l: number, o: number, q: string) => {
    setError("");
    try {
      const data = await api.admin.listUsers({ query: q || undefined, limit: l, offset: o });
      setRows(data.rows);
      setTotal(data.total);
      setLimit(l);
      setOffset(o);
      setActiveQuery(q);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "获取用户失败");
    }
  };

  useEffect(() => {
    api.currentUser().then(
      (u) => {
        setAdminUsername(u.username);
        fetchUsers(limit, 0, "");
      },
      () => {},
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem("authToken");
    location.hash = "#/login";
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers(limit, 0, query);
  };

  const handlePrev = () => fetchUsers(limit, Math.max(0, offset - limit), activeQuery);
  const handleNext = () => fetchUsers(limit, offset + limit, activeQuery);

  return (
    <div className="p-5">
      <div className="flex justify-between items-center mb-4">
        <p className="text-lg font-bold">用户管理</p>
        <div className="flex items-center gap-2">
          {adminUsername && <span className="text-sm text-gray-500">{adminUsername}</span>}
          <button onClick={handleLogout} className="text-sm text-red-500 cursor-pointer">
            退出登录
          </button>
        </div>
      </div>

      <AdminNav />

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
              <th className="text-left px-3 py-2 border-b">头像</th>
              <th className="text-left px-3 py-2 border-b">昵称</th>
              <th className="text-left px-3 py-2 border-b">用户名</th>
              <th className="text-right px-3 py-2 border-b">充值总量</th>
              <th className="text-right px-3 py-2 border-b">已用</th>
              <th className="text-right px-3 py-2 border-b">剩余</th>
              <th className="text-left px-3 py-2 border-b">注册时间</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.username} className="border-b">
                <td className="px-3 py-2">
                  {r.avatar ? (
                    <img src={r.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <span className="inline-block w-8 h-8 rounded-full bg-gray-200" />
                  )}
                </td>
                <td className="px-3 py-2">{r.nickname || "—"}</td>
                <td className="px-3 py-2">{r.username}</td>
                <td className="px-3 py-2 text-right">{r.totalCredits}</td>
                <td className="px-3 py-2 text-right">{r.consumedCredits}</td>
                <td className="px-3 py-2 text-right">{r.remainingCredits}</td>
                <td className="px-3 py-2">{new Date(r.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-gray-400">
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
    </div>
  );
};
