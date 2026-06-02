import { getAccessToken } from "../wechat/token.ts";

const accessToken = await getAccessToken();

const res = await fetch(
  `https://qyapi.weixin.qq.com/cgi-bin/kf/account/list?access_token=${accessToken}`,
  { method: "POST" },
);

const data = await res.json() as {
  errcode: number;
  errmsg: string;
  account_list?: Array<{
    open_kfid: string;
    name: string;
    avatar_url: string;
  }>;
};

if (data.errcode !== 0) {
  console.error("获取客服列表失败:", data.errmsg);
  process.exit(1);
}

if (!data.account_list || data.account_list.length === 0) {
  console.log("暂无客服账号");
} else {
  for (const acc of data.account_list) {
    console.log(`${acc.name} (${acc.open_kfid})`);
  }
}
