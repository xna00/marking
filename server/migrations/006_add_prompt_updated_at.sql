-- 006: 为 prompt 表添加更新时间列
--
-- 背景：提示词内容直接影响改卷结果，管理页之前只有创建时间，编辑后无法
--       判断何时生效。本次支持编辑提示词，需要记录最近一次修改时间。
--       历史记录未改过，保持 NULL；新库由 PROMPT_SQL 直接建全列。

ALTER TABLE prompt ADD COLUMN updatedAt TEXT;
