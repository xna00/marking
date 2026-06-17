import { useState } from "react";
import { api } from "./app.js";

export const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api.login({ username, password }) as any;
      sessionStorage.setItem("authToken", res.token);
      setUsername("");
      setPassword("");
    } catch (err: any) {
      setError(err.message || "登录失败");
    }
    setLoading(false);
  };

  return (
    <div className="p-5">
      <p className="text-lg font-bold mb-4">管理员登录</p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm text-gray-600 mb-1">用户名</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            autoComplete="username"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">密码</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            autoComplete="current-password"
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white rounded py-2 text-sm disabled:opacity-50 cursor-pointer"
        >
          {loading ? "登录中..." : "登录"}
        </button>
      </form>
      <p className="text-xs text-gray-400 mt-4 text-center">
        登录后请手动切换到 #/admin 进行充值
      </p>
    </div>
  );
};
