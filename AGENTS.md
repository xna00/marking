# Rules

## ⚠️ 最重要：commit 必须等用户确认

- **绝对禁止自动 commit 或 push。**
- 每次修改后，先用 `git diff` 检查改动，然后只写好 commit message 给用户看。
- commit message 必须根据 git diff 概括改了什么以及为什么，要具体（修改了哪个文件的哪个逻辑，解决了什么问题）。
- 等用户明确说"可以"或"commit"之后，才能执行 `git add` + `git commit` + `git push`。
