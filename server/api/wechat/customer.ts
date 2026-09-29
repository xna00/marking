import { getAccessToken } from "./token.ts";
import { updateUserWxProfile } from "../../db.ts";
import { logger } from "../../logger.ts";

export type WxCustomer = {
  external_userid: string;
  nickname?: string;
  avatar?: string;
  gender?: number;
  unionid?: string;
};

export async function batchgetCustomerInfo(externalUserId: string): Promise<WxCustomer | null> {
  const accessToken = await getAccessToken();
  const url = `https://qyapi.weixin.qq.com/cgi-bin/kf/customer/batchget?access_token=${accessToken}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ external_userid_list: [externalUserId] }),
  });

  const data = await res.json() as {
    errcode: number;
    errmsg: string;
    customer_list?: WxCustomer[];
    invalid_external_userid?: string[];
  };

  if (data.errcode !== 0) {
    throw new Error(`获取客户信息失败: ${data.errmsg} (errcode: ${data.errcode})`);
  }

  const customer = data.customer_list?.find((c) => c.external_userid === externalUserId);
  if (!customer) {
    logger.log(`客户信息不存在: ${externalUserId} invalid=${JSON.stringify(data.invalid_external_userid)}`);
    return null;
  }

  updateUserWxProfile(
    externalUserId,
    customer.nickname || null,
    customer.avatar || null,
    typeof customer.gender === "number" ? customer.gender : null,
    customer.unionid || null,
  );
  logger.log(`已更新客户信息: ${externalUserId} nickname=${customer.nickname || ""} gender=${customer.gender ?? ""} unionid=${customer.unionid || ""}`);

  return customer;
}
