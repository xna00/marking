import { useEffect, useState } from "react";
import { api } from "./app.js";
import { Modal } from "./Modal.js";

type RechargeRow = {
  id: number;
  username: string;
  amountMoney: number;
  amountCredits: number;
  description: string | null;
  payMethod: string | null;
  createdAt: string;
};

const formatTime = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

// amountMoney 统一存分
const formatMoney = (cents: number) => `¥${(cents / 100).toFixed(2)}`;

const formatType = (row: RechargeRow) => {
  if (row.payMethod === "wechatPay") return "微信支付";
  if (row.payMethod === "alipay") return "支付宝";
  if (row.payMethod) return row.payMethod;
  if (row.description === "新用户赠送") return "赠送";
  return "手工充值";
};

export const AdminRecharge = () => {
  const [rows, setRows] = useState<RechargeRow[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const fetchRecharges = async (l: number, o: number) => {
    setError("");
    try {
      const data = await api.admin.listRecharges({ limit: l, offset: o });
      setRows(data.rows);
      setTotal(data.total);
      setLimit(l);
      setOffset(o);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "获取充值记录失败");
    }
  };

  useEffect(() => {
    fetchRecharges(limit, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">共 {total} 条记录</span>
        <button
          onClick={() => {
            setNotice("");
            setFormOpen(true);
          }}
          className="bg-blue-600 text-white rounded px-4 py-2 text-sm cursor-pointer"
        >
          + 新增充值
        </button>
      </div>

      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
      {notice && <p className="text-green-600 text-sm mb-3">{notice}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-3 py-2 border-b">时间</th>
              <th className="text-left px-3 py-2 border-b">用户</th>
              <th className="text-right px-3 py-2 border-b">份数</th>
              <th className="text-right px-3 py-2 border-b">金额</th>
              <th className="text-left px-3 py-2 border-b">类型</th>
              <th className="text-left px-3 py-2 border-b">备注</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="px-3 py-2 whitespace-nowrap">{formatTime(r.createdAt)}</td>
                <td className="px-3 py-2">{r.username}</td>
                <td className="px-3 py-2 text-right">{r.amountCredits}</td>
                <td className="px-3 py-2 text-right">{r.amountMoney ? formatMoney(r.amountMoney) : "—"}</td>
                <td className="px-3 py-2">{formatType(r)}</td>
                <td className="px-3 py-2">{r.description ?? ""}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-gray-400">
                  暂无充值记录
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 mt-3 text-sm">
        <button
          onClick={() => fetchRecharges(limit, Math.max(0, offset - limit))}
          disabled={offset === 0}
          className="px-3 py-1 border rounded cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          上一页
        </button>
        <span>
          第 {offset / limit + 1} 页 / 共 {Math.max(1, Math.ceil(total / limit))} 页
        </span>
        <button
          onClick={() => fetchRecharges(limit, offset + limit)}
          disabled={offset + limit >= total}
          className="px-3 py-1 border rounded cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          下一页
        </button>
      </div>

      <Modal open={formOpen} title="新增充值" onClose={() => setFormOpen(false)}>
        <RechargeForm
          onSuccess={(message) => {
            setFormOpen(false);
            setNotice(message);
            fetchRecharges(limit, 0);
          }}
        />
      </Modal>
    </>
  );
};

const RechargeForm = ({ onSuccess }: { onSuccess: (message: string) => void }) => {
  const [targetUsername, setTargetUsername] = useState("");
  const [credits, setCredits] = useState("");
  const [amountMoney, setAmountMoney] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api.admin.recharge({
        targetUsername,
        credits: Number(credits),
        amountMoney: Number(amountMoney),
        description: description || undefined,
      });
      onSuccess(`已为 ${res.user} 充值 ${res.addedCredits} 份，当前余额 ${res.remainingCredits} 份`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "充值失败");
    }
    setLoading(false);
  };

  return (
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
        <label className="block text-sm text-gray-600 mb-1">充值数量</label>
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
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-green-600 text-white rounded py-2 text-sm disabled:opacity-50 cursor-pointer"
      >
        {loading ? "提交中..." : "提交充值"}
      </button>
    </form>
  );
};
