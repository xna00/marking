import { useEffect, useState } from "react";
import { checkUpdate, setUpdateIcon, type UpdateInfo } from "../update";

export const Banner = () => {
  const [update, setUpdate] = useState<UpdateInfo>();

  useEffect(() => {
    checkUpdate().then((info) => {
      setUpdate(info);
      setUpdateIcon(!!info);
    });
  }, []);

  if (!update) return null;

  return (
    <div className="p-2.5 bg-red-300">
      发现新版本 (v{chrome.runtime.getManifest().version} → v{update.version})，请重新启动
    </div>
  );
};
