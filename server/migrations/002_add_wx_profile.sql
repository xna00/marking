-- 002: 为 user 表添加微信客服客户信息字段
--
-- 背景:
-- 用户经微信客服注册后只能靠随机 4 位数字用户名识别，管理员后台无法区分真人。
-- 微信客服 API (kf/customer/batchget) 可返回客户的 nickname / avatar / gender / unionid，
-- 在用户进入客服会话 (enter_session) 时拉取并落库。
--
-- 注意:
-- 微信客服不提供手机号和邮箱，原有 email / phone 列保留但持续为空。
-- unionid 需企业微信与公众号完成绑定后才可能返回，否则为 NULL。

ALTER TABLE user ADD COLUMN nickname TEXT;
ALTER TABLE user ADD COLUMN avatar TEXT;
ALTER TABLE user ADD COLUMN gender INTEGER;
ALTER TABLE user ADD COLUMN unionid TEXT;
