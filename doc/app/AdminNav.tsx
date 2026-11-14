import { Link, useLocation } from "wouter";

// to 是相对 /admin 的路径：嵌套路由里 useLocation() 返回的是去掉 /admin 后的部分
export const ADMIN_TABS = [
  { to: "/", label: "充值管理" },
  { to: "/mark-logs", label: "评分日志" },
  { to: "/users", label: "用户管理" },
  { to: "/models", label: "模型管理" },
  { to: "/prompts", label: "提示词管理" },
] as const;

export const AdminNav = () => {
  const [path] = useLocation();
  return (
    <nav className="flex gap-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] mb-4 border-b pb-2">
      {ADMIN_TABS.map((t) => {
        const active = path === t.to;
        return (
          <Link
            key={t.to}
            href={t.to}
            className={`inline-flex shrink-0 min-h-11 items-center whitespace-nowrap px-3 text-sm rounded md:min-h-0 md:py-1.5 ${
              active
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
};
