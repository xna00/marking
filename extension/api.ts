import { BACKEND_URL, storageKeys } from "./constants.js";

export type AuthResult = {
  token: string;
  user: {
    username: string;
    email: string | null;
    phone: string | null;
  };
};

export type UsageResult = {
  usage: {
    totalCalls: number;
    todayCalls: number;
  };
};

export async function register(
  username: string,
  password: string,
  email?: string,
  phone?: string,
): Promise<AuthResult> {
  const res = await fetch(`${BACKEND_URL}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, email, phone }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "注册失败");
  return data;
}

export async function login(
  username: string,
  password: string,
): Promise<AuthResult> {
  const res = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "登录失败");
  return data;
}

export async function getUsage(token: string): Promise<UsageResult> {
  const res = await fetch(`${BACKEND_URL}/api/v1/user/usage`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "查询失败");
  return data;
}

export async function getStoredToken(): Promise<string | null> {
  const result = await chrome.storage.local.get(storageKeys.USER_TOKEN as string);
  return (result[storageKeys.USER_TOKEN] as string) ?? null;
}

export async function setStoredToken(
  token: string,
  user: AuthResult["user"],
): Promise<void> {
  await chrome.storage.local.set({
    [storageKeys.USER_TOKEN]: token,
    [storageKeys.USER_INFO]: user,
  });
}

export async function clearStoredToken(): Promise<void> {
  await chrome.storage.local.remove([storageKeys.USER_TOKEN as string, storageKeys.USER_INFO as string]);
}

export async function getStoredUser(): Promise<AuthResult["user"] | null> {
  const result = await chrome.storage.local.get(storageKeys.USER_INFO as string);
  return (result[storageKeys.USER_INFO] as AuthResult["user"] | null) ?? null;
}
