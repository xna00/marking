const criteriaTable = document.getElementById(
  "criteriaTable"
) as HTMLDivElement;

console.log(criteriaTable);

let criteria = [
  ["序号", "位置", "分值", "步长", "评分标准"],
  [1, "", 1, 1, ""],
];

const renderCriteriaTable = () => {
  criteria.forEach((row, i) => {
    const div = document.createElement("div");
  });
};
