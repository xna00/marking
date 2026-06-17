function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    console.log(`${name} 环境变量未设置`);
    process.exit(1);
  }
  return val;
}

export const API_KEY = requireEnv("DOUBAO_API_KEY");
export const LOGIN_KF_ID = requireEnv("LOGIN_KF_ID");
export const ADMIN_USERNAME = requireEnv("ADMIN_USERNAME");
export const DOUBAO_URL = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
