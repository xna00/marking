import { useEffect, useState } from "react";
import { api } from "./app.js";
import { formatTime } from "./utils.js";

type PromptRow = {
  id: string;
  content: string;
  isDefault: boolean;
  createdAt: string;
};

const PLACEHOLDER = "{{评分标准}}";
const MAX_CONTENT_LENGTH = 8000;

// 预览用的示例评分标准，格式与 ai.ts 的 constructPrompt 生成的 md 表格一致
const SAMPLE_TABLE = [
  "序号|位置|分值|评分标准",
  "-|-|-|-",
  "1|第1空|2|写出正确答案",
  "2|第2空|3|步骤完整，结果正确",
].join("\n");

// 列表里用内容摘要代替名称
const excerpt = (content: string): string => {
  const oneLine = content.replace(/\s+/g, " ").trim();
  return oneLine.length > 48 ? `${oneLine.slice(0, 48)}…` : oneLine;
};

export const AdminPrompts = () => {
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  // 非 null 表示正在新建（提示词创建后不可改，要改就新建一条）
  const [draft, setDraft] = useState<{ content: string } | null>(null);

  const fetchPrompts = async () => {
    setError("");
    try {
      const data = await api.admin.listPrompts();
      setPrompts(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "获取提示词失败");
    }
  };

  useEffect(() => {
    fetchPrompts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetMessages = () => {
    setError("");
    setNotice("");
  };

  // 新建时用当前默认提示词做底稿，方便在其基础上改
  const startCreate = () => {
    resetMessages();
    const base = prompts.find((p) => p.isDefault) ?? prompts[0];
    setDraft({ content: base?.content ?? "" });
  };

  const handleCreate = async () => {
    if (!draft) return;
    if (!draft.content.includes(PLACEHOLDER)) {
      setError(`内容必须包含占位符 ${PLACEHOLDER}`);
      return;
    }

    setSaving(true);
    resetMessages();
    try {
      await api.admin.createPrompt({ content: draft.content });
      setDraft(null);
      setNotice("已创建，如需生效请设为默认");
      await fetchPrompts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "创建失败");
    }
    setSaving(false);
  };

  const handleSetDefault = async (id: string) => {
    setSaving(true);
    resetMessages();
    try {
      await api.admin.setDefaultPrompt({ id });
      setNotice("已设为默认提示词");
      await fetchPrompts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "设置默认失败");
    }
    setSaving(false);
  };

  const handleDelete = async (p: PromptRow) => {
    if (!window.confirm(`确定删除这条提示词？\n\n${excerpt(p.content)}`)) return;
    setSaving(true);
    resetMessages();
    try {
      await api.admin.deletePrompt({ id: p.id });
      setNotice("已删除");
      await fetchPrompts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
    setSaving(false);
  };

  return (
    <>
      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
      {notice && <p className="text-green-600 text-sm mb-3">{notice}</p>}

      <div className="flex items-start justify-between gap-4 mb-3">
        <p className="text-sm text-gray-500">
          评分时使用「默认」提示词，{PLACEHOLDER} 会被替换成评分标准表格。提示词创建后不可修改，
          需要调整就新建一条并设为默认。
        </p>
        <button
          onClick={startCreate}
          disabled={saving}
          className="shrink-0 px-3 py-1 rounded bg-blue-600 text-white text-xs cursor-pointer disabled:opacity-40"
        >
          新建提示词
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-2 py-2 border-b">内容</th>
              <th className="text-left px-2 py-2 border-b">默认</th>
              <th className="text-left px-2 py-2 border-b">字数</th>
              <th className="text-left px-2 py-2 border-b">创建时间</th>
              <th className="text-left px-2 py-2 border-b"></th>
            </tr>
          </thead>
          <tbody>
            {prompts.map((p) => (
              <tr key={p.id} className="border-b align-top">
                <td className="px-2 py-2">
                  <div className="whitespace-pre-wrap break-words text-xs font-mono text-gray-700">{p.content}</div>
                </td>
                <td className="px-2 py-2">
                  {p.isDefault ? (
                    <span className="text-green-600 text-xs font-bold">默认</span>
                  ) : (
                    <button
                      onClick={() => handleSetDefault(p.id)}
                      disabled={saving}
                      className="text-xs text-blue-600 cursor-pointer disabled:opacity-40"
                    >
                      设为默认
                    </button>
                  )}
                </td>
                <td className="px-2 py-2 text-gray-500">{p.content.length}</td>
                <td className="px-2 py-2 text-gray-500">{formatTime(p.createdAt)}</td>
                <td className="px-2 py-2 whitespace-nowrap">
                  <button
                    onClick={() => handleDelete(p)}
                    disabled={saving || p.isDefault}
                    title={p.isDefault ? "默认提示词不能删除，请先把其他提示词设为默认" : ""}
                    className="text-xs text-red-500 cursor-pointer disabled:opacity-40"
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
            {prompts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-2 py-6 text-center text-gray-400 text-sm">
                  暂无提示词
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {draft && (
        <div className="mt-4 border rounded p-3">
          <p className="text-sm font-bold mb-2">新建提示词</p>
          <textarea
            value={draft.content}
            onChange={(e) => setDraft({ ...draft, content: e.target.value })}
            spellCheck={false}
            className="w-full h-64 border rounded px-2 py-1 font-mono text-xs"
          />
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={handleCreate}
              disabled={saving}
              className="px-3 py-1 rounded bg-blue-600 text-white text-xs cursor-pointer disabled:opacity-40"
            >
              创建
            </button>
            <button onClick={() => setDraft(null)} disabled={saving} className="px-3 py-1 rounded border text-xs cursor-pointer disabled:opacity-40">
              取消
            </button>
            <span className={draft.content.length > MAX_CONTENT_LENGTH ? "text-xs text-red-500" : "text-xs text-gray-400"}>
              {draft.content.length} / {MAX_CONTENT_LENGTH} 字符
            </span>
          </div>
          <details className="mt-3">
            <summary className="text-xs text-gray-500 cursor-pointer select-none">预览（用示例评分标准渲染）</summary>
            <pre className="mt-2 max-h-56 overflow-auto bg-gray-50 border rounded p-2 text-xs whitespace-pre-wrap">
              {draft.content.replace(PLACEHOLDER, SAMPLE_TABLE)}
            </pre>
          </details>
        </div>
      )}
    </>
  );
};
