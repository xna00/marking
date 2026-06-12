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

function fmt(d: string) {
  const date = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

const Tabs = ["使用记录", "充值记录"] as const;

export const Usage = () => {
  const [tab, setTab] = useState<0 | 1>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [usageHistory, setUsageHistory] = useState<UsageRecord[]>([]);

  useEffect(() => {
    api.ai.getTransactions().then(setTransactions, () => {});
    api.ai.getUsageHistory().then(setUsageHistory, () => {});
  }, []);

  return (
    <div className="p-3">
      <div className="flex gap-2 border-b mb-3">
        {Tabs.map((label, i) => (
          <button
            key={i}
            className={`pb-1 cursor-pointer ${tab === i ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500"}`}
            onClick={() => setTab(i as 0 | 1)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 0 ? (
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="pb-1 pr-2">时间</th>
              <th className="pb-1">用量</th>
            </tr>
          </thead>
          <tbody>
            {usageHistory.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="py-1 pr-2 whitespace-nowrap">{fmt(r.createdAt)}</td>
                <td className="py-1">{r.costCredits}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="pb-1 pr-2">时间</th>
              <th className="pb-1 pr-2">金额</th>
              <th className="pb-1 pr-2">次数</th>
              <th className="pb-1">说明</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="py-1 pr-2 whitespace-nowrap">{fmt(t.createdAt)}</td>
                <td className="py-1 pr-2">¥{(t.amountMoney / 100).toFixed(2)}</td>
                <td className="py-1 pr-2">{t.amountCredits}</td>
                <td className="py-1">{t.description ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
