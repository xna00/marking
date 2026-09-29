import { initDb, listAllUsers } from "../db.ts";
import { batchgetCustomerInfo } from "../api/wechat/customer.ts";

// 一次性回填：为库中已有用户补全微信客服客户信息（nickname / avatar / gender / unionid）
// 用法: node --env-file=.env scripts/backfill-wx-profile.ts

try {
  initDb();
  const users = listAllUsers();
  console.log(`共 ${users.length} 个用户，开始回填`);

  let updated = 0;
  let missing = 0;
  for (const user of users) {
    if (await batchgetCustomerInfo(user.externalUserId)) updated++;
    else missing++;
  }

  console.log(`完成: 成功 ${updated}，未找到 ${missing}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("no such column")) {
    console.error("user 表缺列，先跑: node migrations/migrate.ts 002_add_wx_profile.sql");
  } else {
    console.error("回填失败:", message);
  }
  process.exit(1);
}
