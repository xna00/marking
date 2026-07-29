-- 001: 为 creditTransaction 表添加订单号和支付方式字段
--
-- 背景:
-- creditTransaction 表原本只记录充值金额和次数，没有关联支付订单。
-- 接入微信支付后，需要记录每笔充值对应的支付订单号，以便对账和查证。
--
-- orderNo:  我方生成的订单号，格式 "marking_{timestamp}_{4位hex}"
--            在微信商户后台搜索 orderNo 可定位到对应交易
-- payMethod: 支付方式标识，如 "wechat"、"alipay"
--            后续接入其他支付渠道时扩展用

ALTER TABLE creditTransaction ADD COLUMN orderNo TEXT;
ALTER TABLE creditTransaction ADD COLUMN payMethod TEXT;
