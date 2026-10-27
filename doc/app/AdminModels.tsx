import { useEffect, useState } from "react";
import { api } from "./app.js";
import { AdminNav } from "./AdminNav.js";

type ModelRow = {
  id: string;
  label: string;
  inputPrice: number;
  outputPrice: number;
  cacheHitPrice: number;
  detail: "low" | "high";
  enabled: boolean;
  isDefault: boolean;
};

type EditablePatch = Partial<Pick<ModelRow, "label" | "inputPrice" | "outputPrice" | "cacheHitPrice" | "detail" | "enabled">>;

const RowEditor = ({ model, saving, onSave, onSetDefault }: {
  model: ModelRow;
  saving: boolean;
  onSave: (id: string, patch: EditablePatch) => void;
  onSetDefault: (id: string) => void;
}) => {
  const [label, setLabel] = useState(model.label);
  const [inputPrice, setInputPrice] = useState(String(model.inputPrice));
  const [outputPrice, setOutputPrice] = useState(String(model.outputPrice));
  const [cacheHitPrice, setCacheHitPrice] = useState(String(model.cacheHitPrice));
  const [detail, setDetail] = useState<"low" | "high">(model.detail);
  const [enabled, setEnabled] = useState(model.enabled);
  const [localError, setLocalError] = useState("");

  const toNum = (s: string): number | null => {
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  const handleSave = () => {
    const ip = toNum(inputPrice);
    const op = toNum(outputPrice);
    const chp = toNum(cacheHitPrice);
    if (ip === null || op === null || chp === null || ip < 0 || op < 0 || chp < 0) {
      setLocalError("价格需为非负数字");
      return;
    }
    setLocalError("");
    onSave(model.id, { label: label.trim() || model.label, inputPrice: ip, outputPrice: op, cacheHitPrice: chp, detail, enabled });
  };

  const inputCls = "w-24 border rounded px-2 py-1 text-sm";

  return (
    <tr className="border-b align-top">
      <td className="px-2 py-2 font-mono text-xs break-all">{model.id}</td>
      <td className="px-2 py-2">
        <input value={label} onChange={(e) => setLabel(e.target.value)} className="w-44 border rounded px-2 py-1 text-sm" />
      </td>
      <td className="px-2 py-2">
        <input value={inputPrice} onChange={(e) => setInputPrice(e.target.value)} className={inputCls} />
      </td>
      <td className="px-2 py-2">
        <input value={outputPrice} onChange={(e) => setOutputPrice(e.target.value)} className={inputCls} />
      </td>
      <td className="px-2 py-2">
        <input value={cacheHitPrice} onChange={(e) => setCacheHitPrice(e.target.value)} className={inputCls} />
      </td>
      <td className="px-2 py-2">
        <select
          value={detail}
          onChange={(e) => setDetail(e.target.value === "low" ? "low" : "high")}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="low">low</option>
          <option value="high">high</option>
        </select>
      </td>
      <td className="px-2 py-2">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
      </td>
      <td className="px-2 py-2">
        {model.isDefault ? (
          <span className="text-green-600 text-xs font-bold">默认</span>
        ) : (
          <button onClick={() => onSetDefault(model.id)} disabled={saving} className="text-xs text-blue-600 cursor-pointer disabled:opacity-40">
            设为默认
          </button>
        )}
      </td>
      <td className="px-2 py-2">
        <button onClick={handleSave} disabled={saving} className="px-3 py-1 rounded bg-blue-600 text-white text-xs cursor-pointer disabled:opacity-40">
          保存
        </button>
        {localError && <p className="text-red-500 text-xs mt-1">{localError}</p>}
      </td>
    </tr>
  );
};

export const AdminModels = () => {
  const [adminUsername, setAdminUsername] = useState("");
  const [models, setModels] = useState<ModelRow[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchModels = async () => {
    setError("");
    try {
      const data = await api.admin.listModels();
      setModels(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "获取模型失败");
    }
  };

  useEffect(() => {
    api.currentUser().then(
      (u) => {
        setAdminUsername(u.username);
        fetchModels();
      },
      () => {},
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem("authToken");
    location.hash = "#/login";
  };

  const handleSave = async (id: string, patch: EditablePatch) => {
    setSavingId(id);
    setError("");
    setNotice("");
    try {
      await api.admin.updateModel({ id, ...patch });
      setNotice("已保存");
      await fetchModels();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "保存失败");
    }
    setSavingId(null);
  };

  const handleSetDefault = async (id: string) => {
    setSavingId(id);
    setError("");
    setNotice("");
    try {
      await api.admin.setDefaultModel({ id });
      setNotice("已设为默认模型");
      await fetchModels();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "设置默认失败");
    }
    setSavingId(null);
  };

  return (
    <div className="p-5">
      <div className="flex justify-between items-center mb-4">
        <p className="text-lg font-bold">模型管理</p>
        <div className="flex items-center gap-2">
          {adminUsername && <span className="text-sm text-gray-500">{adminUsername}</span>}
          <button onClick={handleLogout} className="text-sm text-red-500 cursor-pointer">
            退出登录
          </button>
        </div>
      </div>

      <AdminNav />

      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
      {notice && <p className="text-green-600 text-sm mb-3">{notice}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-2 py-2 border-b">模型</th>
              <th className="text-left px-2 py-2 border-b">label</th>
              <th className="text-left px-2 py-2 border-b">输入价</th>
              <th className="text-left px-2 py-2 border-b">输出价</th>
              <th className="text-left px-2 py-2 border-b">缓存命中价</th>
              <th className="text-left px-2 py-2 border-b">图片细节</th>
              <th className="text-left px-2 py-2 border-b">启用</th>
              <th className="text-left px-2 py-2 border-b">默认</th>
              <th className="text-left px-2 py-2 border-b"></th>
            </tr>
          </thead>
          <tbody>
            {models.map((m) => (
              <RowEditor key={m.id} model={m} saving={savingId === m.id} onSave={handleSave} onSetDefault={handleSetDefault} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
