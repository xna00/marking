import { useEffect, useState } from "react";
import { api } from "./app.js";
import { Modal } from "./Modal.js";
import { UserInfo } from "./UserInfo.js";
import { formatTime } from "./utils.js";

type RechargeRow = {
  id: number;
  username: string;
  nickname: string | null;
  avatar: string | null;
  amountMoney: number;
  amountCredits: number;
  description: string | null;
  payMethod: string | null;
  createdAt: string;
};

type DateRange = { start?: string; end?: string };

// amountMoney 统一存分
const formatMoney = (cents: number) => `¥${(cents / 100).toFixed(2)}`;

// <input type="date"> 用本地日期；createdAt 存的是 UTC ISO，这里换算成本地日界
const toInputDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const toIsoRange = (from: string, to: string): DateRange => {
  const range: DateRange = {};
  if (from) range.start = new Date(`${from}T00:00:00`).toISOString();
  if (to) {
    const nextDay = new Date(`${to}T00:00:00`);
    nextDay.setDate(nextDay.getDate() + 1);
    range.end = nextDay.toISOString();
  }
  return range;
};

export const AdminRecharge = () => {
  const [rows, setRows] = useState<RechargeRow[]>([]);
  const [total, setTotal] = useState(0);
  const [amountMoney, setAmountMoney] = useState(0);
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [range, setRange] = useState<DateRange>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const fetchRecharges = async (l: number, o: number, r: DateRange) => {
    setError("");
    try {
      const data = await api.admin.listRecharges({ limit: l, offset: o, ...r });
      setRows(data.rows);
      setTotal(data.total);
      setAmountMoney(data.amountMoney);
      setLimit(l);
      setOffset(o);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "获取充值记录失败");
    }
  };

  useEffect(() => {
    fetchRecharges(limit, 0, {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyRange = (nextFrom: string, nextTo: string) => {
    if (nextFrom && nextTo && nextFrom > nextTo) {
      setError("开始日期不能晚于结束日期");
      return;
    }
    setFrom(nextFrom);
    setTo(nextTo);
    const nextRange = toIsoRange(nextFrom, nextTo);
    setRange(nextRange);
    fetchRecharges(limit, 0, nextRange);
  };

  const today = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(today.getDate() - 6);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        />
        <span className="text-sm text-gray-500">~</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        />
        <button
          onClick={() => applyRange(from, to)}
          className="px-3 py-1 bg-blue-600 text-white rounded text-sm cursor-pointer"
        >
          查询
        </button>
        <button
          onClick={() => applyRange("", "")}
          className="px-3 py-1 border rounded text-sm cursor-pointer"
        >
          清空
        </button>
        <span className="flex gap-1 ml-1">
          <button
            onClick={() => applyRange(toInputDate(today), toInputDate(today))}
            className="px-2 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
          >
            今天
          </button>
          <button
            onClick={() => applyRange(toInputDate(weekAgo), toInputDate(today))}
            className="px-2 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
          >
            近 7 天
          </button>
          <button
            onClick={() => applyRange(toInputDate(monthStart), toInputDate(today))}
            className="px-2 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
          >
            本月
          </button>
        </span>

        <span className="ml-auto text-sm text-gray-500">
          共 {total} 条记录 · 合计 {formatMoney(amountMoney)}
        </span>
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
              <th className="text-left px-3 py-2 border-b">备注</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="px-3 py-2 whitespace-nowrap">{formatTime(r.createdAt)}</td>
                <td className="px-3 py-2">
                  <UserInfo username={r.username} nickname={r.nickname} avatar={r.avatar} />
                </td>
                <td className="px-3 py-2 text-right">{r.amountCredits}</td>
                <td className="px-3 py-2 text-right">{formatMoney(r.amountMoney)}</td>
                <td className="px-3 py-2">{r.description ?? "-"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-gray-400">
                  暂无充值记录
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 mt-3 text-sm">
        <button
          onClick={() => fetchRecharges(limit, Math.max(0, offset - limit), range)}
          disabled={offset === 0}
          className="px-3 py-1 border rounded cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          上一页
        </button>
        <span>
          第 {offset / limit + 1} 页 / 共 {Math.max(1, Math.ceil(total / limit))} 页
        </span>
        <button
          onClick={() => fetchRecharges(limit, offset + limit, range)}
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
            fetchRecharges(limit, 0, range);
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
