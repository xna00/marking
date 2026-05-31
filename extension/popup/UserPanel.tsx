import { useState, useEffect } from "react";
import { register, login, getUsage, getStoredToken, setStoredToken, clearStoredToken, getStoredUser } from "../api.js";
import type { AuthResult, UsageResult } from "../api.js";

type Props = {
  onLoginChange?: (loggedIn: boolean) => void;
};

export function UserPanel({ onLoginChange }: Props) {
  const [user, setUser] = useState<AuthResult["user"] | null>(null);
  const [usage, setUsage] = useState<UsageResult["usage"] | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const token = await getStoredToken();
      const storedUser = await getStoredUser();
      if (token && storedUser) {
        setUser(storedUser);
        try {
          const u = await getUsage(token);
          setUsage(u.usage);
        } catch { }
      }
    })();
  }, []);

  const handleSubmit = async () => {
    setError("");
    if (!username || !password) {
      setError("用户名和密码不能为空");
      return;
    }
    setLoading(true);
    try {
      let result: AuthResult;
      if (mode === "register") {
        result = await register(username, password, email || undefined, phone || undefined);
      } else {
        result = await login(username, password);
      }
      await setStoredToken(result.token, result.user);
      setUser(result.user);
      onLoginChange?.(true);
      try {
        const u = await getUsage(result.token);
        setUsage(u.usage);
      } catch { }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await clearStoredToken();
    setUser(null);
    setUsage(null);
    onLoginChange?.(false);
  };

  if (user) {
    return (
      <div className="border-b pb-2 mb-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold">{user.username}</span>
          <button className="small-btn !bg-gray-500" onClick={handleLogout}>退出</button>
        </div>
        {usage && (
          <div className="text-xs text-gray-600 mt-1">
            剩余可用量: {usage.remainingQuota} | 今日已用: {usage.todayUsed}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="border-b pb-2 mb-2">
      <div className="flex gap-x-2 mb-1">
        <button
          className={`small-btn flex-1 ${mode === "login" ? "!bg-blue-600" : "!bg-gray-400"}`}
          onClick={() => { setMode("login"); setError(""); }}
        >
          登录
        </button>
        <button
          className={`small-btn flex-1 ${mode === "register" ? "!bg-blue-600" : "!bg-gray-400"}`}
          onClick={() => { setMode("register"); setError(""); }}
        >
          注册
        </button>
      </div>
      <input
        placeholder="用户名"
        value={username}
        onChange={e => setUsername(e.target.value)}
      />
      <input
        type="password"
        placeholder="密码"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />
      {mode === "register" && (
        <>
          <input
            placeholder="邮箱（选填）"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <input
            placeholder="手机号（选填）"
            value={phone}
            onChange={e => setPhone(e.target.value)}
          />
        </>
      )}
      {error && <div className="text-red-500 text-xs mb-1">{error}</div>}
      <button
        className="w-full py-1 text-sm"
        disabled={loading}
        onClick={handleSubmit}
      >
        {loading ? "..." : (mode === "register" ? "一键注册" : "登录")}
      </button>
    </div>
  );
}
