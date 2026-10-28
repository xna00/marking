-- 003: 为 user 表添加最后活跃时间
--
-- 目的：admin 用户管理页区分活跃/流失用户。
--
-- 背景：客户端把 Bearer token 存进 chrome storage 长期复用，用户几乎不重复
--       密码登录，若记 lastLoginAt 会 ≈ createdAt、信息量低，且微信客服注册的
--       用户可能不走密码登录而为 NULL。故改为记录「最后活跃」：每次认证请求
--       由服务端节流更新（见 server/api/auth.ts，5 分钟写一次）。

ALTER TABLE user ADD COLUMN lastActiveAt TEXT;
