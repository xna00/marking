import { getAccessToken } from "./token.ts";

export async function getKfServiceUrl(
  openKfId: string,
  scene?: string,
  sceneParam?: string,
): Promise<{ url: string; scene?: string; sceneParam?: string }> {
  const accessToken = await getAccessToken();
  const body: Record<string, string> = { open_kfid: openKfId };
  if (scene) body.scene = scene;

  const res = await fetch(
    `https://qyapi.weixin.qq.com/cgi-bin/kf/add_contact_way?access_token=${accessToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  const data = await res.json() as { errcode: number; errmsg: string; url: string };
  if (data.errcode !== 0) {
    throw new Error(`获取客服链接失败: ${data.errmsg} (errcode: ${data.errcode})`);
  }

  let url = data.url;
  if (scene && sceneParam) {
    url += `&scene_param=${encodeURIComponent(sceneParam)}`;
  }

  return { url, ...(scene && { scene }), ...(sceneParam && { sceneParam }) };
}
