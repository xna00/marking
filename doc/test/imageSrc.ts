const imgs = import.meta.glob("./images/*.png", {
  eager: true,
});
console.log(imgs);
export const imageSrc = [
  ...Object.values(imgs).map((img) => (img as { default: string }).default),
];
