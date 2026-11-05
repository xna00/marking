const AUTH_COOKIE = "authToken";

// 会话 cookie（不带 Max-Age）：关掉浏览器就失效，和原来 sessionStorage 的生命周期一致
export const setAuthCookie = (token: string) => {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${AUTH_COOKIE}=${token}; Path=/; SameSite=Lax${secure}`;
};

export const clearAuthCookie = () => {
  document.cookie = `${AUTH_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
};
