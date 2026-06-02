import { createLoginSession } from "./login.ts";
import { getKfServiceUrl } from "./contact.ts";
import { LOGIN_KF_ID } from "../constants.ts";

export async function qr(data: { sceneParam: string }) {
  createLoginSession(data.sceneParam);
  const { url } = await getKfServiceUrl(LOGIN_KF_ID, "login", data.sceneParam);
  return { url };
}
