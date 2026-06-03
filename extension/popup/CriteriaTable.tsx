import type { InputRef } from ".";
import type { ConfigItem } from "../ai";

function CriteriaRow({
  item,
  index,
  onUpdate,
  onDelete,
  onInsertAbove,
  onInsertBelow,
  setInputRef,
}: {
  item: ConfigItem;
  index: number;
  onUpdate: (field: keyof ConfigItem, value: string | number) => void;
  onDelete: () => void;
  onInsertAbove: () => void;
  onInsertBelow: () => void;
  setInputRef: (ref: InputRef) => void;
}) {
  return (
    <tr>
      <td className="text-center align-top">{index + 1}</td>
      <td className="align-top">
        <textarea
          className="w-full border-none! outline-none rounded-none"
          value={item.position}
          onChange={e => onUpdate("position", e.target.value)}
          onFocus={e => setInputRef({ e: e.target, setValue: v => onUpdate("position", v) })}
        />
      </td>
      <td className="align-top">
        <input
          className="w-full"
          type="number"
          step="any"
          min={0}
          value={item.points}
          onChange={e => onUpdate("points", Math.max(0, Number(e.target.value)))}
          onFocus={e => setInputRef({ e: e.target, setValue: v => onUpdate("points", Number(v)) })}
        />
      </td>
      <td className="align-top">
        <textarea
          className="w-full border-none! outline-none rounded-none"
          value={item.markingCriteria}
          onChange={e => onUpdate("markingCriteria", e.target.value)}
          onFocus={e => setInputRef({ e: e.target, setValue: v => onUpdate("markingCriteria", v) })}
        />
      </td>
      <td className="align-top text-center whitespace-nowrap" style={{ overflow: 'visible' }}>
        <span className="add-btn">
          <span className="border rounded-full w-4 h-4 inline-flex items-center justify-center cursor-pointer text-sm leading-none">+</span>
          <span className="add-dropdown">
            <span className="add-dropdown-item" onClick={onInsertAbove}>在上方插入1行</span>
            <span className="add-dropdown-item" onClick={onInsertBelow}>在下方插入1行</span>
          </span>
        </span>
        <span
          className="border rounded-full w-4 h-4 inline-flex items-center justify-center cursor-pointer ml-1 text-red-500 leading-none text-sm"
          onClick={onDelete}
        >×</span>
      </td>
    </tr>
  );
}

export const CriteriaTable = ({
  config,
  onChange,
  setInputRef,
}: {
  config: ConfigItem[];
  onChange: (config: ConfigItem[]) => void;
  setInputRef: (ref: InputRef) => void;
}) => {
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
            <CriteriaRow
              key={i}
              index={i}
              item={item}
              setInputRef={setInputRef}
              onUpdate={(field, value) => {
                const next = [...config];
                next[i] = { ...next[i], [field]: value };
                onChange(next);
              }}
              onDelete={() => {
                const next = [...config];
                next.splice(i, 1);
                onChange(next);
              }}
              onInsertAbove={() => {
                const next = [...config];
                next.splice(i, 0, { position: "", points: 0, markingCriteria: "" });
                onChange(next);
              }}
              onInsertBelow={() => {
                const next = [...config];
                next.splice(i + 1, 0, { position: "", points: 0, markingCriteria: "" });
                onChange(next);
              }}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};
