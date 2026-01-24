import { useEffect } from "react";
import { storageKeys } from "../constants";
import type { InputRef } from ".";

type CriteriaTableCellSize = {
  colsWidth: {
    [key: string]: number | string | undefined;
  };
  rowsHeight: {
    [key: string]: number | string | undefined;
  };
};

export let cellSize: CriteriaTableCellSize = ((
  await chrome.storage.local.get(storageKeys.CRITERIA_TABLE_CELL_SIZE)
)[storageKeys.CRITERIA_TABLE_CELL_SIZE] as CriteriaTableCellSize) ?? {
  colsWidth: {
    0: 60,
    1: 100,
    2: 60,
    3: "auto",
  },
  rowsHeight: {
    0: 40,
  },
};

export const debounce = (func: Function, delay: number = 200) => {
  let timer: number;
  return function (this: any, ...args: any[]) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
};
export const CriteriaTable = ({
  criteriaHeader,
  criteriaRules,
  setCriteriaRules,
  setInputRef,
}: {
  criteriaHeader: string[];
  criteriaRules: string[][];
  setCriteriaRules: (rules: string[][]) => void;
  setInputRef: (ref: InputRef) => void;
}) => {
  const resizeObserver = new ResizeObserver(
    debounce((entries: ResizeObserverEntry[]) => {
      console.log(entries);

      const newCellSize = {
        colsWidth: { ...cellSize.colsWidth },
        rowsHeight: { ...cellSize.rowsHeight },
      };
      for (const entry of entries) {
        const target = entry.target as HTMLElement;
        const dataset = target.dataset;

        if (dataset.row) {
          newCellSize.rowsHeight[dataset.row] =
            entry.borderBoxSize[0].blockSize;
          console.log(dataset.row, entry.borderBoxSize[0].blockSize);
        }
        if (dataset.col && dataset.col !== criteriaHeader.length.toString()) {
          newCellSize.colsWidth[dataset.col] =
            entry.borderBoxSize[0].inlineSize;
          console.log(dataset.col, entry.borderBoxSize[0].inlineSize);
        }
      }

      cellSize = newCellSize;

      chrome.storage.local.set({
        [storageKeys.CRITERIA_TABLE_CELL_SIZE]: newCellSize,
      });
    })
  );

  const observe = (e: HTMLElement | null) => {
    if (e) {
      resizeObserver.observe(e);
    }
  };

  useEffect(() => {
    return () => {
      resizeObserver.disconnect();
    };
  });

  return (
    <div>
      <table id="criteriaTable">
        <thead>
          <tr id="tableHeadRow">
            <th
              ref={observe}
              data-row={"0"}
              data-col={"0"}
              style={{
                width: cellSize.colsWidth[0],
                height: cellSize.rowsHeight[0],
              }}
            >
              序号
              <div
                className="border rounded-full w-4 h-4 m-auto flex items-center justify-center cursor-pointer"
                onClick={() => {
                  const newRules = [...criteriaRules];
                  newRules.splice(
                    0,
                    0,
                    new Array(criteriaHeader.length).fill("")
                  );
                  setCriteriaRules(newRules);
                }}
              >
                +
              </div>
            </th>
            {criteriaHeader.map((head, index) => (
              <th
                key={head}
                ref={observe}
                data-col={index + 1}
                style={{
                  width: cellSize.colsWidth[index + 1],
                }}
              >
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody id="tableBody">
          {criteriaRules.map((rule, i) => (
            <tr key={i}>
              <td
                className="text-center"
                ref={observe}
                data-row={i + 1}
                style={{
                  height: cellSize.rowsHeight[i + 1] ?? cellSize.rowsHeight[0],
                }}
              >
                <div
                  className="border rounded-full w-4 h-4 m-auto flex items-center justify-center cursor-pointer"
                  onClick={() => {
                    const newRules = [...criteriaRules];
                    newRules.splice(i, 1);
                    setCriteriaRules(newRules);
                  }}
                >
                  -
                </div>
                {i + 1}
                <div
                  className="border rounded-full w-4 h-4 m-auto flex items-center justify-center cursor-pointer"
                  onClick={() => {
                    const newRules = [...criteriaRules];
                    newRules.splice(
                      i + 1,
                      0,
                      new Array(criteriaHeader.length).fill("")
                    );
                    setCriteriaRules(newRules);
                  }}
                >
                  +
                </div>
              </td>
              {rule.map((item, j) => (
                <td key={j} className="relative">
                  <textarea
                    className="absolute inset-0 border-none! outline-none rounded-none"
                    value={item}
                    onChange={(e) => {
                      const newRules = [...criteriaRules];
                      newRules[i][j] = e.target.value;
                      setCriteriaRules(newRules);
                    }}
                    onFocus={(e) => {
                      setInputRef({
                        e: e.target,
                        setValue: (value) => {
                          const newRules = [...criteriaRules];
                          newRules[i][j] = value;
                          setCriteriaRules(newRules);
                        },
                      });
                    }}
                  ></textarea>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
