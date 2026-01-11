import { jsonrepair } from "jsonrepair";
// // @ts-ignore
// import * as dirtyjson from "dirty-json";
export const repairJson = (str: string) => {
  return jsonrepair(str);
};
