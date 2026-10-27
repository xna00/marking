const TABS = [
  { href: "#/admin", label: "充值管理" },
  { href: "#/admin/mark-logs", label: "评分日志" },
  { href: "#/admin/users", label: "用户管理" },
  { href: "#/admin/models", label: "模型管理" },
];

export const AdminNav = () => {
  const hash = window.location.hash;
  return (
    <nav className="flex gap-1 mb-4 border-b pb-2">
      {TABS.map((t) => {
        const active = hash === t.href;
        return (
          <a
            key={t.href}
            href={t.href}
            className={
              active
                ? "px-3 py-1.5 text-sm rounded bg-blue-600 text-white"
                : "px-3 py-1.5 text-sm rounded text-gray-600 hover:bg-gray-100"
            }
          >
            {t.label}
          </a>
        );
      })}
    </nav>
  );
};
