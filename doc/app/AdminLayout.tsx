import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { api } from "./app.js";
import { ADMIN_TABS, AdminNav } from "./AdminNav.js";

// admin 各页共用的外壳：标题 + 当前管理员 + 退出登录 + 导航
export const AdminLayout = ({ children }: { children: ReactNode }) => {
  const [path] = useLocation();
  const [adminUsername, setAdminUsername] = useState("");

  useEffect(() => {
    api.currentUser().then(
      (u) => setAdminUsername(u.username),
      () => {
        // token 失效或未登录时统一回登录页，省得每个页面各自处理 401
        window.location.hash = "#/admin/login";
      },
    );
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem("authToken");
    window.location.hash = "#/admin/login";
  };

  const title = ADMIN_TABS.find((t) => t.to === path)?.label ?? "";

  return (
    <div className="p-5">
      <div className="flex justify-between items-center mb-4">
        <p className="text-lg font-bold">{title}</p>
        <div className="flex items-center gap-2">
          {adminUsername && (
            <span className="text-sm text-gray-500">{adminUsername}</span>
          )}
          <button
            onClick={handleLogout}
            className="text-sm text-red-500 cursor-pointer"
          >
            退出登录
          </button>
        </div>
      </div>

      <AdminNav />

      {children}
    </div>
  );
};
