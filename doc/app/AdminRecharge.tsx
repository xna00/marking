import { useEffect, useState } from "react";
import { api } from "./app.js";

export const AdminRecharge = () => {
  const [adminUsername, setAdminUsername] = useState("");
  const [targetUsername, setTargetUsername] = useState("");
  const [credits, setCredits] = useState("");
  const [amountMoney, setAmountMoney] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ user: string; addedCredits: number; remainingCredits: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.currentUser().then(
      (u) => setAdminUsername(u.username),
      () => {},
    );
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await api.admin.recharge({
        targetUsername,
        credits: Number(credits),
        amountMoney: Number(amountMoney),
        description: description || undefined,
      });
      setResult(res);
      setTargetUsername("");
      setCredits("");
      setAmountMoney("");
      setDescription("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "充值失败");
    }
    setLoading(false);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("authToken");
    location.hash = "#/login";
  };

  return (
    <div className="p-5">
      <div className="flex justify-between items-center mb-4">
        <p className="text-lg font-bold">充值管理</p>
        <div className="flex items-center gap-2">
          {adminUsername && (
            <span className="text-sm text-gray-500">{adminUsername}</span>
          )}
          <button
            onClick={handleLogout}
            className="text-sm text-red-500 cursor-pointer"
          >
            退出登录
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm text-gray-600 mb-1">目标用户名</label>
          <input
            value={targetUsername}
            onChange={(e) => setTargetUsername(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="如 0156"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">充值次数</label>
          <input
            type="number"
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="如 300"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">转账金额（元）</label>
          <input
            type="number"
            step="0.01"
            value={amountMoney}
            onChange={(e) => setAmountMoney(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="如 50"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">备注（可选）</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="如：用户要求续费"
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        {result && (
          <p className="text-green-600 text-sm">
            充值成功！{result.user}: {result.remainingCredits - result.addedCredits} → {result.remainingCredits} 次，金额 ¥{Number(amountMoney).toFixed(2)}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 text-white rounded py-2 text-sm disabled:opacity-50 cursor-pointer"
        >
          {loading ? "提交中..." : "提交充值"}
        </button>
      </form>
    </div>
  );
};
