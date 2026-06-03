import { DOUBAO_URL, API_KEY } from "./constants.ts";

type ConfigItem = {
  position: string;
  points: number;
  markingCriteria: string;
};

type ChatBody = {
  model: string;
  config: ConfigItem[];
  imageUrl: string;
};

function log(...args: unknown[]) {
  console.log(`[${new Date().toLocaleString()}]`, ...args);
}

const SYSTEM_PROMPT = `你是一名老师，正在批改试卷，你要批改的题有多个空。这是评分标准：
{{评分标准}}

给你发答题卡的图片，你需要做：
1.识别出图片中每个空的内容
2.根据评分标准，判断每个空的得分
3.以[["1中识别出的内容",0(得分),"原因(尽量短)"],...]格式返回结果`;

function constructPrompt(config: ConfigItem[]): string {
  const header = "序号|位置|分值|评分标准";
  const separator = "-|-|-|-";
  const rows = config.map((item, i) => `${i + 1}|${item.position}|${item.points}|${item.markingCriteria}`).join("\n");
  const mdTable = [header, separator, rows].join("\n");
  return SYSTEM_PROMPT.replace("{{评分标准}}", mdTable);
}

export async function chat(body: ChatBody): Promise<unknown> {
  const id = Math.random().toString(36).slice(2, 8);
  const prompt = constructPrompt(body.config);

  const fetchBody = {
    model: body.model,
    messages: [
      {
        role: "system",
        content: [{ type: "text", text: prompt }],
      },
      {
        role: "user",
        content: [{ type: "image_url", image_url: { url: body.imageUrl } }],
      },
    ],
    thinking: { type: "disabled" },
    max_completion_tokens: 200,
  };

  const start = Date.now();
  const fetchPromise = fetch(DOUBAO_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(fetchBody),
    duplex: "half",
  });

  const res = await fetchPromise;
  const ms = Date.now() - start;
  log(`[${id}] <= ${res.status} (${ms}ms)`);

  res.clone().text()
    .then(body => log(`[${id}] body: ${body}`))
    .catch(err => log(`[${id}] body error: ${err}`));

  const outHeaders = new Headers(res.headers);
  outHeaders.delete("content-encoding");
  outHeaders.delete("content-length");

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: outHeaders,
  });
}
