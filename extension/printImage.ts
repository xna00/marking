export const printImageInConsole = (
  url: string,
  width: number,
  height: number
) => {
  const num = ((width / height) | 0) *2;
  console.log(num)
  console.log(
    "%c" + " ".repeat(num),
    `font-size:${height}px;line-height:${height}px;background:url("${url}") no-repeat;background-size:contain;background-position:center;`
  );

  //   console.log(
  //     "%c",
  //     [
  //       "font-size: 1px;",
  //       "line-height: " + height + "px;",
  //       "padding: " + height * 0.5 + "px " + width * 0.5 + "px;",
  //       "background-size: " + width + "px " + height + "px;",
  //       "background: url(" + url + ");",
  //     ].join(" ")
  //   );
};
