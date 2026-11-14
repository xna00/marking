import { useEffect, useRef, useState } from "react";

// 图片放大弹层：用原生 <dialog> modal，自带焦点陷阱、Esc、::backdrop 和焦点回归；
// 不做缩放平移，滚轮就是普通滚动，长答题卡按原尺寸渲染在弹层里滚动查看。
// 仅管理页（doc/app）使用：目标浏览器为最新版 Chrome，不做跨浏览器兜底。
// src 为 null 时不打开。
export const ImageLightbox = ({ src, alt, onClose }: {
  src: string | null;
  alt?: string;
  onClose: () => void;
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  // 记录加载失败的图片地址，而不是布尔值：换一张图（src 变化）自动恢复正常
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  // src 变化 → 打开/关闭原生 modal
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (src && !dialog.open) {
      dialog.showModal();
      // React 的 autoFocus 只在挂载时生效，这里显式聚焦关闭按钮（安全操作）
      closeBtnRef.current?.focus();
    } else if (!src && dialog.open) {
      dialog.close();
    }
  }, [src]);

  return (
    <dialog
      ref={dialogRef}
      // 没有可见标题，用图片文件名作为可访问名称
      aria-label={alt ? `图片：${alt}` : "图片预览"}
      // 点遮罩也能关
      closedby="any"
      onClose={onClose}
      className="m-auto w-fit max-h-[92vh] max-w-[92vw] overflow-auto overscroll-contain rounded bg-white backdrop:overflow-hidden backdrop:overscroll-contain backdrop:bg-black/80"
    >
      <button
        ref={closeBtnRef}
        type="button"
        onClick={() => dialogRef.current?.close()}
        aria-label="关闭"
        className="fixed right-4 top-3 grid h-8 w-8 cursor-pointer place-items-center rounded bg-white/90 text-xl leading-none text-gray-800"
      >
        ×
      </button>
      {src && (failedSrc === src
        ? <div className="px-16 py-10 text-[13px] text-gray-400">加载失败</div>
        : (
          <img
            src={src}
            alt={alt ?? ""}
            onError={() => setFailedSrc(src)}
            className="block max-w-none"
          />
        ))}
    </dialog>
  );
};
