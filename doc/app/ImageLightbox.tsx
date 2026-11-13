import { useEffect, useState } from "react";

// 图片放大弹层：点遮罩 / × / Esc 关闭；不做缩放平移，滚轮就是普通滚动，
// 长答题卡按原尺寸渲染在容器里上下滚动查看。
// src 为 null 时不渲染（与 Modal 的 open 语义一致）。
export const ImageLightbox = ({ src, alt, onClose }: {
  src: string | null;
  alt?: string;
  onClose: () => void;
}) => {
  // 记录加载失败的图片地址，而不是布尔值：换一张图（src 变化）自动恢复正常
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!src) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    // 打开时锁住页面滚动，关闭后恢复原值
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(0,0,0,0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="关闭"
        style={{
          position: "absolute",
          top: "12px",
          right: "16px",
          width: "32px",
          height: "32px",
          border: "none",
          borderRadius: "4px",
          background: "rgba(255,255,255,0.9)",
          color: "#333",
          fontSize: "20px",
          lineHeight: 1,
          cursor: "pointer",
        }}
      >
        ×
      </button>
      <div
        // 点图片/滚动条不触发遮罩关闭
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "92vw",
          maxHeight: "92vh",
          overflow: "auto",
          background: "#fff",
          borderRadius: "4px",
        }}
      >
        {failedSrc === src
          ? <div style={{ padding: "40px 60px", fontSize: "13px", color: "#9ca3af" }}>加载失败</div>
          : (
            <img
              src={src}
              alt={alt ?? ""}
              onError={() => setFailedSrc(src)}
              style={{ display: "block", maxWidth: "none" }}
            />
          )}
      </div>
    </div>
  );
};
