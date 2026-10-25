import { useEffect, useState } from "react";
import { checkUpdate, setUpdateIcon, type UpdateInfo } from "../update";
import { HOST } from "../constants";

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
      发现新版本 (v{chrome.runtime.getManifest().version} → v{update.version})<br />请重新下载并安装： <a href={`${HOST}/MarkingMaster.exe?t=${Date.now()}`} target="_blank" className="text-blue-700 underline cursor-pointer">MarkingMaster.exe</a>
    </div>
  );
};
