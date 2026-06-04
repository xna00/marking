import { readFile } from "node:fs/promises";

const htmlUrl = new URL("../debug.html", import.meta.url);

export async function getDebug() {
  const html = await readFile(htmlUrl, "utf-8");
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
