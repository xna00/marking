import { getWechatPayApi } from "../wechat-pay/sdk.ts";
import { getCurrentUser } from "./auth.ts";
import { insertCreditTransaction, findUserByExternalUserId } from "../db.ts";
import { logger } from "../logger.ts";

const pendingOrders = new Map<string, { userId: string; amountMoney: number; amountCredits: number; status: "pending" | "success" }>();

const PRICE_PER_100 = 30;

function makeOrderNo(): string {
  const rand = Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0");
  return `marking_${Date.now()}_${rand}`;
}

export async function createOrder(body: { credits: number }) {
  const user = await getCurrentUser();
  const credits = body.credits;
  if (!credits || credits <= 0 || credits % 100 !== 0) {
    throw new Error("次数必须是 100 的倍数");
  }
  const amountMoney = (credits / 100) * PRICE_PER_100;
  const outTradeNo = makeOrderNo();

  const api = getWechatPayApi();
  const result = await api.native.createOrder({
    description: `改卷仙人充值 ${credits} 次`,
    out_trade_no: outTradeNo,
    amount: { total: amountMoney },
  });

  pendingOrders.set(outTradeNo, {
    userId: user.externalUserId,
    amountMoney,
    amountCredits: credits,
    status: "pending",
  });

  setTimeout(async () => {
    const o = pendingOrders.get(outTradeNo);
    if (o && o.status !== "success") {
      try {
        await getWechatPayApi().native.closeOrder(outTradeNo);
        logger.logWithId(`关闭超时订单: ${outTradeNo}`);
      } catch (e) {
        logger.logWithId(`关闭订单 ${outTradeNo} 失败: ${e}`);
      }
    }
    pendingOrders.delete(outTradeNo);
  }, 5 * 60 * 1000).unref();

  return { codeUrl: result.code_url, outTradeNo };
}

export async function getQuery(body: { outTradeNo: string }) {
  const user = await getCurrentUser();
  const order = pendingOrders.get(body.outTradeNo);
  if (!order || order.userId !== user.externalUserId) {
    return { status: "not_found" };
  }
  return { status: order.status };
}

export async function _outNotify(req: Request) {
  const headers: Record<string, string | string[] | undefined> = {};
  req.headers.forEach((v, k) => { headers[k] = v });
  const body = await req.text();

  try {
    const api = getWechatPayApi();
    const tx = await api.native.parseNotification(headers, body);
    logger.logWithId(`支付通知: out_trade_no=${tx.out_trade_no}, trade_state=${tx.trade_state}`);

    if (tx.trade_state !== "SUCCESS") {
      return new Response(JSON.stringify({ code: "FAIL", message: `state: ${tx.trade_state}` }), { status: 200 });
    }

    const order = pendingOrders.get(tx.out_trade_no);
    if (!order) {
      logger.logWithId(`支付通知: 订单 ${tx.out_trade_no} 不在内存中`);
      return new Response(JSON.stringify({ code: "SUCCESS", message: "ok" }), { status: 200 });
    }

    const user = findUserByExternalUserId(order.userId);
    if (!user) {
      logger.logWithId(`支付通知: 用户 ${order.userId} 不存在`);
      return new Response(JSON.stringify({ code: "SUCCESS", message: "ok" }), { status: 200 });
    }

    insertCreditTransaction(order.userId, order.amountMoney, order.amountCredits, undefined, tx.out_trade_no, "wechatPay");
    order.status = "success";
    logger.logWithId(`支付通知: 用户 ${order.userId} 充值 ${order.amountCredits} 次成功`);

    return new Response(JSON.stringify({ code: "SUCCESS", message: "成功" }), { status: 200 });
  } catch (err) {
    logger.logWithId(`支付通知处理失败: ${err}`);
    return new Response(JSON.stringify({ code: "FAIL", message: String(err) }), { status: 500 });
  }
}
