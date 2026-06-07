import { imageSrc } from "./imageSrc.js";

const originals = imageSrc.filter(s => /image\d\.png$/.test(s));
const partA = originals.map(s => s.replace(/\.png$/, "A.png"));
const partB = originals.map(s => s.replace(/\.png$/, "B.png"));

const container = document.getElementById("imageContainer")!;
const currentLabel = document.getElementById("currentLabel")!;

let index = 0;

function render(i: number) {
  container.innerHTML = `
    <div class="outBox">
      <div class="imgSection clear">
        <img src="${partA[i]}" />
      </div>
    </div>
    <div class="outBox">
      <div class="imgSection clear">
        <img src="${partB[i]}" />
      </div>
    </div>
  `;
  currentLabel.textContent = `${i + 1} / ${originals.length}`;
}

render(0);

document.getElementById("prevBtn")!.onclick = () => {
  index = (index - 1 + originals.length) % originals.length;
  render(index);
};
document.getElementById("nextBtn")!.onclick = () => {
  index = (index + 1) % originals.length;
  render(index);
};
document.getElementById("submitBtn")!.onclick = () => {
  render(index = (index + 1) % originals.length);
};

document.addEventListener("customSubmit", () => {
  (document.getElementById("submitBtn") as HTMLButtonElement).click();
});
