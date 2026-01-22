import { imageSrc } from "./imageSrc.f4503313.js";
console.log("main.ts");
const cardImage = document.getElementById("cardImage");
const submitBtn = document.getElementById("submitBtn");
let imageIndex = 0;
function changeImage() {
  imageIndex = (imageIndex + 1) % imageSrc.length;
  cardImage.src = imageSrc[imageIndex];
}
cardImage.src = imageSrc[imageIndex];
submitBtn.addEventListener("click", () => {
  changeImage();
});
document.addEventListener("customSubmit", () => {
  submitBtn.click();
});
