import { useEffect, type ReactNode } from "react";

// 通用弹窗：点遮罩或按 Esc 关闭
export const Modal = ({ open, title, onClose, children }: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 md:items-center md:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90dvh] w-full overflow-y-auto overscroll-contain rounded-t-xl bg-white p-4 shadow-lg md:w-[420px] md:max-w-full md:rounded md:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-base font-bold">{title}</p>
          <button
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer text-lg leading-none md:h-auto md:w-auto"
            aria-label="关闭"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};
