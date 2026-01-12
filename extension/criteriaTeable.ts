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
let criteria = [["", 1, ""]];

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
  const result = await chrome.storage.local.get(["criteria", "criteriaHeader"]);
  if (result.criteria && result.criteriaHeader) {
    criteria = result.criteria as string[][];
    criteriaHeader = result.criteriaHeader as string[];
  }
  renderCriteriaTable();
};

const renderCriteriaTable = () => {
  tableHeadRow.innerHTML = "";
  tableBody.innerHTML = "";
  const th = document.createElement("th");
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
  criteriaHeader.forEach((header) => {
    const th = document.createElement("th");
    th.innerText = header;
    tableHeadRow.appendChild(th);
  });
  criteria.forEach((row, i) => {
    const rowtr = document.createElement("tr");
    tableBody.appendChild(rowtr);
    const td = document.createElement("td");
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
      const input = document.createElement("textarea");
      input.rows = 1;
      input.value = cell.toString();
      input.onchange = (e) => {
        const value = (e.target as HTMLInputElement).value;
        criteria[i][j] = value;
        console.log(criteria);
        saveCriteriaData();
      };
      td.appendChild(input);
      rowtr.appendChild(td);
    });
  });
};

loadCriteriaData();
