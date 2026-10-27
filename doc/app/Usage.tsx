import { useEffect, useState } from "react";
import { api } from "./app.js";

type Transaction = {
  id: number;
  amountMoney: number;
  amountCredits: number;
  description: string | null;
  createdAt: string;
};

type UsageRecord = {
  id: number;
  createdAt: string;
  confirmedAt: string;
  costCredits: number;
};

const Tabs = ["使用记录", "充值记录"];
const PAGE_SIZES = [10, 20, 50];

function fmt(d: string) {
  const date = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export const Usage = () => {
  const [tab, setTab] = useState<0 | 1>(0);
  const [limit, setLimit] = useState(10);
  const [page, setPage] = useState(0);
  const [usageHistory, setUsageHistory] = useState<UsageRecord[]>([]);
  const [usageTotal, setUsageTotal] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const offset = page * limit;
    const load = async () => {
      try {
        if (tab === 0) {
          const res = await api.ai.getUsageHistory({ limit, offset });
          if (cancelled) return;
          setUsageHistory(res.rows);
          setUsageTotal(res.total);
        } else {
          const res = await api.ai.getTransactions({ limit, offset });
          if (cancelled) return;
          setTransactions(res.rows);
          setTxTotal(res.total);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "获取记录失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [tab, page, limit]);

  const total = tab === 0 ? usageTotal : txTotal;
  const rows = tab === 0 ? usageHistory : transactions;
  const pageCount = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="min-h-screen bg-gray-100 p-3 md:p-5">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex gap-2 border-b px-4 pt-3">
          {Tabs.map((label, i) => (
            <button
              key={i}
              className={`pb-2 px-1 cursor-pointer text-sm ${tab === i ? "text-blue-600 border-b-2 border-blue-600 font-medium" : "text-gray-500"}`}
              onClick={() => { setTab(i === 0 ? 0 : 1); setPage(0); }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

          {loading ? (
            <p className="text-gray-400 text-sm text-center py-8">加载中...</p>
          ) : rows.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">暂无记录</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-gray-500 bg-gray-50">
                    <th className="py-2 px-3 font-medium">时间</th>
                    {tab === 0 ? (
                      <th className="py-2 px-3 font-medium">用量</th>
                    ) : (
                      <>
                        <th className="py-2 px-3 font-medium">金额</th>
                        <th className="py-2 px-3 font-medium">次数</th>
                        <th className="py-2 px-3 font-medium">说明</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {tab === 0
                    ? usageHistory.map((r) => (
                        <tr key={r.id} className="border-t border-gray-100 odd:bg-white even:bg-gray-50 hover:bg-blue-50">
                          <td className="py-2 px-3 whitespace-nowrap">{fmt(r.createdAt)}</td>
                          <td className="py-2 px-3">{r.costCredits}</td>
                        </tr>
                      ))
                    : transactions.map((t) => (
                        <tr key={t.id} className="border-t border-gray-100 odd:bg-white even:bg-gray-50 hover:bg-blue-50">
                          <td className="py-2 px-3 whitespace-nowrap">{fmt(t.createdAt)}</td>
                          <td className="py-2 px-3">¥{(t.amountMoney / 100).toFixed(2)}</td>
                          <td className="py-2 px-3">{t.amountCredits}</td>
                          <td className="py-2 px-3">{t.description ?? ""}</td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          )}

          {total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 mt-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span>每页</span>
                <select
                  value={limit}
                  onChange={(e) => { setLimit(Number(e.target.value)); setPage(0); }}
                  className="border rounded px-1 py-0.5 text-sm"
                >
                  {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <span>条</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-2 py-1 border rounded disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:bg-gray-50"
                >
                  上一页
                </button>
                <span>第 {page + 1} / {pageCount} 页（共 {total} 条）</span>
                <button
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={page >= pageCount - 1}
                  className="px-2 py-1 border rounded disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:bg-gray-50"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
