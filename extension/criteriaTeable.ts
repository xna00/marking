const criteriaTable = document.getElementById(
  "criteriaTable"
) as HTMLDivElement;
const tableHeadRow = document.getElementById(
  "tableHeadRow"
) as HTMLTableRowElement;
const tableBody = document.getElementById(
  "tableBody"
) as HTMLTableSectionElement;

const previewPopover = document.getElementById(
  "previewPopover"
) as HTMLDivElement;
const promptTextarea = document.getElementById(
  "promptTextarea"
) as HTMLTextAreaElement;

console.log(criteriaTable);

let criteriaHeader = ["位置", "分值", "评分标准"];
let criteria = [
  ["第一行左", 1, "500mL容量瓶(不写“500mL”0分，“容量瓶”写成“溶量瓶”0分)"],
  ["第一行右", 2, "13.6"],
  ["第二行", 1, "25"],
  ["第三行", 2, "将浓硫酸沿烧杯内壁缓慢注入水中(给分点一),并用玻璃棒不断搅拌(给分点二)"],
  ["第四行", 2, "C"],
];

let colsWidth: Record<string, string | undefined> = {
    0: "60px",
    1: "100px",
    2: "60px",
    3: "auto",
  },
  rowsHeight: Record<string, string | undefined> = {
    "0": "40px",
  };

const debounce = (func: Function, delay: number = 200) => {
  let timer: number;
  return function (this: any, ...args: any[]) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
};

const resizeObserverCallback = (entries: ResizeObserverEntry[]) => {
  console.log(entries);
  entries.forEach((entry) => {
    const col = entry.target.getAttribute("data-col");
    const row = entry.target.getAttribute("data-row");

    if (col !== null) {
      if (col === criteriaHeader.length.toString()) {
        colsWidth[col] = "auto";
      } else {
        colsWidth[col] = entry.borderBoxSize[0].inlineSize + "px";
      }
    }
    if (row !== null) {
      rowsHeight[row] = entry.borderBoxSize[0].blockSize + "px";
    }
    chrome.storage.local.set({ colsWidth });
    chrome.storage.local.set({ rowsHeight });
    (
      [
        ...document.querySelectorAll("#criteriaTable th,td"),
      ] as HTMLTableCellElement[]
    ).forEach((th) => {
      const col = th.getAttribute("data-col");
      const row = th.getAttribute("data-row");
      if (col !== null) {
        th.style.width = colsWidth[col] ?? "auto";
      }
      if (row !== null) {
        th.style.height = rowsHeight[row] ?? "auto";
      }
    });
  });
};

const resizeObserver = new ResizeObserver(debounce(resizeObserverCallback));

previewPopover.addEventListener("toggle", () => {
  const mdTable = `
${["序号", ...criteriaHeader].join("|")}
-|${criteriaHeader.map(() => "-").join("|")}
${criteria.map((row, index) => `${index + 1}|${row.join("|")}`).join("\n")}
`.trim();
  const realPrompt = promptTextarea.value.replace("{{评分标准}}", mdTable);
  previewPopover.innerText = realPrompt;
});

const saveCriteriaData = () => {
  chrome.storage.local.set({ criteria });
  chrome.storage.local.set({ criteriaHeader });
};

const loadCriteriaData = async () => {
  const result = await chrome.storage.local.get([
    "criteria",
    "criteriaHeader",
    "colsWidth",
    "rowsHeight",
  ]);
  if (result.criteria && result.criteriaHeader) {
    criteria = result.criteria as string[][];
    criteriaHeader = result.criteriaHeader as string[];
  }
  if (result.colsWidth) {
    colsWidth = result.colsWidth as Record<string, string | undefined>;
  }
  if (result.rowsHeight) {
    rowsHeight = result.rowsHeight as Record<string, string | undefined>;
  }
  renderCriteriaTable();
  saveCriteriaData();
};

const renderCriteriaTable = () => {
  resizeObserver.disconnect();
  tableHeadRow.innerHTML = "";
  tableBody.innerHTML = "";
  const th = document.createElement("th");
  th.setAttribute("data-col", "0");
  th.setAttribute("data-row", "0");
  th.style.width = colsWidth["0"] ?? "auto";
  th.style.height = rowsHeight["0"] ?? "auto";
  resizeObserver.observe(th);
  th.innerText = "序号";
  const btn2 = document.createElement("button");
  btn2.classList.add("small-btn");
  btn2.innerText = "+";
  btn2.onclick = () => {
    criteria.unshift(["", 1, ""]);
    renderCriteriaTable();
    saveCriteriaData();
  };
  th.appendChild(btn2);

  tableHeadRow.appendChild(th);
  criteriaHeader.forEach((header, i) => {
    const th = document.createElement("th");
    th.setAttribute("data-col", (i + 1).toString());
    th.setAttribute("data-row", "0");
    th.style.width = colsWidth[(i + 1).toString()] ?? "auto";
    th.style.height = rowsHeight["0"] ?? "auto";
    resizeObserver.observe(th);
    th.innerText = header;
    tableHeadRow.appendChild(th);
  });
  criteria.forEach((row, i) => {
    const rowtr = document.createElement("tr");
    tableBody.appendChild(rowtr);
    const td = document.createElement("td");
    td.setAttribute("data-col", "0");
    td.setAttribute("data-row", (i + 1).toString());
    td.style.width = colsWidth["0"] ?? "auto";
    td.style.height = rowsHeight[(i + 1).toString()] ?? "60px";
    resizeObserver.observe(td);
    td.innerText = (i + 1).toString();
    const btn1 = document.createElement("button");
    btn1.classList.add("small-btn");
    btn1.innerText = "-";
    btn1.onclick = () => {
      criteria.splice(i, 1);
      renderCriteriaTable();
      saveCriteriaData();
    };
    td.insertBefore(btn1, td.firstChild);
    const btn2 = document.createElement("button");
    btn2.classList.add("small-btn");
    btn2.innerText = "+";
    btn2.onclick = () => {
      criteria.splice(i + 1, 0, ["", 1, ""]);
      renderCriteriaTable();
      saveCriteriaData();
    };
    td.appendChild(btn2);
    rowtr.appendChild(td);

    row.forEach((cell, j) => {
      const td = document.createElement("td");
      td.style.position = "relative";
      // td.setAttribute("data-col", (j + 1).toString());
      // td.setAttribute("data-row", (i + 1).toString());
      // td.style.width = colsWidth[(j + 1).toString()] ?? "auto";
      // td.style.height = rowsHeight[(i + 1).toString()] ?? "60px";
      // td.contentEditable = "plaintext-only";
      // td.innerText = cell.toString();

      // td.addEventListener("input", () => {
      //   criteria[i][j] = td.innerText;
      //   saveCriteriaData();
      // });
      const div = document.createElement("div");
      div.style.position = "absolute";
      div.style.top = "4px";
      div.style.left = "0";
      div.style.bottom = "4px";
      div.style.right = "0";

      div.classList.add("criteria-cell");
      td.appendChild(div);
      const input = document.createElement("textarea");
      input.value = cell.toString();
      input.onchange = (e) => {
        const value = (e.target as HTMLInputElement).value;
        criteria[i][j] = value;
        console.log(criteria);
        saveCriteriaData();
      };
      div.appendChild(input);
      rowtr.appendChild(td);
    });
  });
};

loadCriteriaData();