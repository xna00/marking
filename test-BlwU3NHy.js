const image1 = "" + new URL("image1-uM7CFn1S.png", import.meta.url).href;
const __vite_glob_0_0 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: image1
}, Symbol.toStringTag, { value: "Module" }));
const image2 = "" + new URL("image2-BpCNGNvs.png", import.meta.url).href;
const __vite_glob_0_1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: image2
}, Symbol.toStringTag, { value: "Module" }));
const image3 = "" + new URL("image3-BZqhA_5S.png", import.meta.url).href;
const __vite_glob_0_2 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: image3
}, Symbol.toStringTag, { value: "Module" }));
const image4 = "" + new URL("image4-BJOVlSdY.png", import.meta.url).href;
const __vite_glob_0_3 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: image4
}, Symbol.toStringTag, { value: "Module" }));
const image5 = "" + new URL("image5-BWzf0r5z.png", import.meta.url).href;
const __vite_glob_0_4 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: image5
}, Symbol.toStringTag, { value: "Module" }));
const image6 = "" + new URL("image6-Dh9Y4H7a.png", import.meta.url).href;
const __vite_glob_0_5 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: image6
}, Symbol.toStringTag, { value: "Module" }));
const image7 = "" + new URL("image7-BtMKUdxX.png", import.meta.url).href;
const __vite_glob_0_6 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: image7
}, Symbol.toStringTag, { value: "Module" }));
const imgs = /* @__PURE__ */ Object.assign({
  "./images/image1.png": __vite_glob_0_0,
  "./images/image2.png": __vite_glob_0_1,
  "./images/image3.png": __vite_glob_0_2,
  "./images/image4.png": __vite_glob_0_3,
  "./images/image5.png": __vite_glob_0_4,
  "./images/image6.png": __vite_glob_0_5,
  "./images/image7.png": __vite_glob_0_6
});
console.log(imgs);
const imageSrc = [
  ...Object.values(imgs).map((img) => img.default)
];
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
