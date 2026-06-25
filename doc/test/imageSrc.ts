const imgs = import.meta.glob(["./images/*.png", "!./images/*A.png", "!./images/*B.png"], {
  eager: true,
});
console.log(imgs);
export const imageSrc = [
  ...Object.values(imgs).map((img) => (img as { default: string }).default),
];
