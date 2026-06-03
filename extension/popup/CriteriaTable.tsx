import { useLayoutEffect } from "react";
import type { InputRef } from ".";
import type { ConfigItem } from "../ai";

export const CriteriaTable = ({
  config,
  onChange,
  setInputRef,
}: {
  config: ConfigItem[];
  onChange: (config: ConfigItem[]) => void;
  setInputRef: (ref: InputRef) => void;
}) => {
  useLayoutEffect(() => {
    const MAX_HEIGHT = 120;
    document.querySelectorAll("#criteriaTable textarea").forEach(el => {
      const ta = el as HTMLTextAreaElement;
      ta.style.height = "auto";
      const h = ta.scrollHeight;
      ta.style.height = Math.min(h, MAX_HEIGHT) + "px";
      ta.style.overflowY = h > MAX_HEIGHT ? "auto" : "hidden";
    });
  });

  const insertAbove = (i: number) => {
    const next = [...config];
    next.splice(i, 0, { position: "", points: 0, markingCriteria: "" });
    onChange(next);
  };
  const insertBelow = (i: number) => {
    const next = [...config];
    next.splice(i + 1, 0, { position: "", points: 0, markingCriteria: "" });
    onChange(next);
  };
  const deleteRow = (i: number) => {
    const next = [...config];
    next.splice(i, 1);
    onChange(next);
  };
  const update = (i: number, field: keyof ConfigItem, value: string | number) => {
    const next = [...config];
    next[i] = { ...next[i], [field]: value };
    onChange(next);
  };

  return (
    <div>
      <table id="criteriaTable">
        <thead>
          <tr id="tableHeadRow">
            <th style={{ width: 36, height: 40 }}>序号</th>
            <th style={{ width: 80 }}>位置</th>
            <th style={{ width: 60 }}>分值</th>
            <th style={{ width: "auto" }}>评分标准</th>
            <th style={{ width: 50, height: 40 }}>操作</th>
          </tr>
        </thead>
        <tbody id="tableBody">
          {config.map((item, i) => (
            <tr key={i}>
              <td className="text-center align-top">{i + 1}</td>
              <td className="align-top">
                <textarea
                  className="w-full border-none! outline-none rounded-none resize-none overflow-hidden"
                  rows={1}
                  value={item.position}
                  onChange={e => update(i, "position", e.target.value)}
                  onFocus={e => setInputRef({ e: e.target, setValue: v => update(i, "position", v) })}
                />
              </td>
              <td className="align-top">
                <input
                  className="w-full"
                  type="number"
                  step="any"
                  min={0}
                  value={item.points}
                  onChange={e => update(i, "points", Math.max(0, Number(e.target.value)))}
                  onFocus={e => setInputRef({ e: e.target, setValue: v => update(i, "points", Number(v)) })}
                />
              </td>
              <td className="align-top">
                <textarea
                  className="w-full border-none! outline-none rounded-none resize-none overflow-hidden"
                  rows={1}
                  value={item.markingCriteria}
                  onChange={e => update(i, "markingCriteria", e.target.value)}
                  onFocus={e => setInputRef({ e: e.target, setValue: v => update(i, "markingCriteria", v) })}
                />
              </td>
              <td className="align-top text-center whitespace-nowrap" style={{ overflow: 'visible' }}>
                <span className="add-btn">
                  <span className="border rounded-full w-4 h-4 inline-flex items-center justify-center cursor-pointer text-sm leading-none">+</span>
                  <span className="add-dropdown">
                    <span className="add-dropdown-item" onClick={() => insertAbove(i)}>在上方插入1行</span>
                    <span className="add-dropdown-item" onClick={() => insertBelow(i)}>在下方插入1行</span>
                  </span>
                </span>
                <span
                  className="border rounded-full w-4 h-4 inline-flex items-center justify-center cursor-pointer ml-1 text-red-500 leading-none text-sm"
                  onClick={() => deleteRow(i)}
                >×</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
