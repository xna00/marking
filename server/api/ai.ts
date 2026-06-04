import { jsonrepair } from "jsonrepair";
import { DOUBAO_URL, API_KEY } from "./constants.ts";
import { ApiError } from "./utils.ts";
import { getCurrentUser, getUserIfLoggedIn } from "./auth.ts";

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

type AIResultItem = [string, number, string];

function log(...args: unknown[]) {
  console.log(`[${new Date().toLocaleString()}]`, ...args);
}

const SYSTEM_PROMPT = `你是一名老师，正在批改试卷，你要批改的题有多个空。这是评分标准：
{{评分标准}}

给你发答题卡的图片，你需要做：
1.识别出图片中每个空填写的内容(排除被划掉的内容)
2.根据评分标准，判断每个空的得分
3.以[["1中识别出的内容",0(得分),"原因"],...]格式返回结果，其中原因不超过15字;识别出的内容完整返回`;

function constructPrompt(config: ConfigItem[]): string {
  const header = "序号|位置|分值|评分标准";
  const separator = "-|-|-|-";
  const rows = config.map((item, i) => `${i + 1}|${item.position}|${item.points}|${item.markingCriteria}`).join("\n");
  const mdTable = [header, separator, rows].join("\n");
  return SYSTEM_PROMPT.replace("{{评分标准}}", mdTable);
}

function resolveModel(model: string): string {
  return model === "auto" ? "doubao-seed-2-0-lite-260428" : model;
}

function resolveDetail(model: string): "low" | "high" {
  const resolved = resolveModel(model);
  return resolved === "doubao-seed-2-0-pro-260215" ? "low" : "high";
}

async function doChat(body: ChatBody): Promise<AIResultItem[]> {
  const prompt = constructPrompt(body.config);
  const resolvedModel = resolveModel(body.model);

  const fetchBody = {
    model: resolvedModel,
    messages: [
      {
        role: "system",
        content: [{ type: "text", text: prompt }],
      },
      {
        role: "user",
        content: [{
          type: "image_url",
          image_url: {
            url: body.imageUrl,
            detail: resolveDetail(body.model),
          },
        }],
      },
    ],
    thinking: { type: "disabled" },
    max_completion_tokens: 200,
  };

  const errors: unknown[] = [];

  for (let attempt = 0; attempt < 3; attempt++) {
    const id = Math.random().toString(36).slice(2, 8);
    try {
      const start = Date.now();
      const res = await fetch(DOUBAO_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify(fetchBody),
        duplex: "half",
      });
      const ms = Date.now() - start;
      log(`[${id}] <= ${res.status} (${ms}ms)`);

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(`AI API error ${res.status}: ${JSON.stringify(errorBody)}`);
      }

      const data = await res.json() as any;
      const content = data.choices?.[0]?.message?.content;

      log(`[${id}] body: ${content}`);

      if (!content) {
        throw new Error(`Unexpected AI response: ${JSON.stringify(data)}`);
      }

      const repaired = jsonrepair(content);
      return JSON.parse(repaired);
    } catch (e) {
      log(`[${id}] attempt ${attempt + 1} failed:`, e);
      errors.push(e);
    }
  }

  throw new ApiError(502, {}, `3 次重试均失败: ${errors.map(e => String(e)).join("; ")}`);
}

export async function markImage(body: ChatBody): Promise<AIResultItem[]> {
  await getCurrentUser();
  return doChat(body);
}

export async function testMarkImage(body: ChatBody): Promise<AIResultItem[]> {
  await getUserIfLoggedIn();
  return doChat(body);
}
