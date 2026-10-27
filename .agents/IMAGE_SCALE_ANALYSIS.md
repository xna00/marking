# 图片缩放 base64 变短分析

## 现象

`marking-out.log` 中同一张测试图，不同代码版本下发给模型的 base64 长度差异巨大：

| 时间 | 代码 | model | base64 长度 |
|------|------|-------|-------------|
| 2026/10/28 00:39:09 [30] | 含 commit `978fd2b` | doubao-seed-2-0-lite-260428 | 13215 chars |
| 2026/10/28 00:45:12 [40] | revert `978fd2b` 后 | doubao-seed-2-0-mini-260428 | 24863 chars |

revert 之后 base64 反而**变长**，直觉与「缩图会更小」相悖，故排查。

## 根因：commit `978fd2b` 取消了强制缩到 700px

commit `978fd2b`（fix: 图片不再强制缩到 700px，超过 high 上限才缩、统一转 webp）把 `extension/image.ts` 的 `scaleImage` 从：

```ts
// 旧：无论原图多大，一律缩到宽度 700px
const canvasWidth = width;  // 700
```

改成：

```ts
// 新：只有超过 doubao high 上限 2,257,920 px 才等比缩小，否则保留原分辨率
const scale = srcPixels > maxPixels ? Math.sqrt(maxPixels / srcPixels) : 1;
```

测试图实际是 **1449×488 ≈ 70.7 万 px**，远低于 2,257,920 px，因此：

- 新代码：**保留原分辨率 1449×488**，不再缩放
- 旧代码（revert 后）：**缩到宽度 700px → 700×235**

## 服务器实测数据

对 `server/data/mark-images/` 落盘的 `.webp.br` 解压解析（VP8L 帧为权威尺寸），批次内所有图片头部一致，是系统性差异而非偶然：

| | 新代码（00:32–00:41） | 旧代码（00:45–00:48、10/27 22:59） |
|---|---|---|
| 实际尺寸 | **1449×488** | **700×235** |
| 像素数 | 70.7 万 | 16.5 万 |
| 落盘 webp 体积 | ~8 KB | ~18.6 KB |
| 日志 base64 长度 | 7.6K–13K chars | 20K–28K chars |
| VP8X/VP8L 尺寸头 | `qAUA5` → 1449 | `uwIA6` → 700 |

宽高比一致（≈2.97），且 700/1449 ≈ 0.483 恰好是 1449→700 的缩放系数，证明是**同一张源图**。

## 为什么「缩小了反而更大」

落盘 webp 是 VP8L 无损，大小由**熵**决定。文档截图大面积空白，原分辨率下平滑、压缩极好；缩到 700px 时，文字笔画被压成细锐反锯齿高对比边缘，产生大量高频细节，熵暴增，无损编码压不动。

受控复现（同一张图 `image.png`，仅换缩放，无损编码，method=6）：

```
原图 1449×488 as-is             → 6138 bytes
同一张图缩到 700×235 (LANCZOS)   → 18792 bytes   ← 像素少 4.3 倍，文件却大 3 倍
```

与日志方向（13215 vs 24863 chars）一致。

## 结论

- base64 变短**不是质量退化或 bug**，是 `978fd2b` 的预期效果：取消缩图后发给模型的**真实像素是旧的 4.3 倍**（1449×488 vs 700×235），正是该 commit 想要的识别精度提升。
- **不能用 base64 长度判断图片质量**。这里短的反而像素多、更清晰。
- 旧代码把 1449 宽的图压到 700，等于先砍一半细节再让平台插值到 1280 token，小字更容易识别错。

## 复现材料

`image-scale-analysis/` 目录，用单一源图 `image.png`（1449×488）一键复现：

| 文件 | 说明 |
|------|------|
| `image.png` | 源图（1449×488，即新代码保留的原分辨率） |
| `after_commit_keep_1449x488.webp` | 不缩放，直接无损编码（复现新代码，6138 B） |
| `before_commit_downscale_700x235.webp` | 缩到 700×235 再无损编码（复现旧代码，18792 B） |

复现熵对比：

```python
from PIL import Image
import io

def webp(im):
    b = io.BytesIO(); im.save(b, "WEBP", lossless=True, method=6); return len(b.getvalue())

img = Image.open("image-scale-analysis/image.png").convert("RGB")
down = img.resize((700, 235), Image.LANCZOS)   # 旧代码：缩到宽 700px
print("不缩放 1449x488:", webp(img))            # ~6 KB（复现新代码）
print("缩到 700x235    :", webp(down))           # ~19 KB（像素少 4.3 倍，文件大 3 倍）
```

> 注：`image.png` 取自服务端 `mark-images` 落盘文件；尺寸/体积数据另由 `marking-out.log` 实测交叉印证。含服务器地址的核对命令不写入本仓库。
