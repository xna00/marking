-- 004: 为 prompt 表添加题型列（按题型区分评分提示词模板）
--
-- 背景：第 1 步题型已下发（getQuestionTypes），第 2 步起按题型取提示词模板，
--       prompt 表需要标记每条提示词属于哪个题型。已有数据（无题型概念）自动归
--       default，无需回填；新库由 PROMPT_SQL 直接建全列，不用跑本迁移。

ALTER TABLE prompt ADD COLUMN questionType TEXT NOT NULL DEFAULT 'default';
