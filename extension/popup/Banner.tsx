import { use, useEffect, useState } from "react";
import { HOST, storageKeys } from "../constants";
import UZIP from "uzip";
import { checkUpdate, type UpdateInfo } from "../update";

const fetchExtension = () =>
  fetch(new URL("/extension.zip", HOST), { cache: "no-cache" });

const directoryId = "directoryId";

const saveFilesInDirectory = async (
  dirHandle: FileSystemDirectoryHandle,
  files: Record<string, Uint8Array>
) => {
  return Promise.all(
    Object.entries(files).map(async ([p, fileContent]) => {
      if (!p) return;
      const filePath = p.split("/");
      if (filePath.length > 1) {
        const dir = await dirHandle.getDirectoryHandle(filePath[0], {
          create: true,
        });
        await saveFilesInDirectory(dir, {
          [filePath.slice(1).join("/")]: fileContent,
        });
      } else {
        const fileHandle = await dirHandle.getFileHandle(p, {
          create: true,
        });
        const writable = await fileHandle.createWritable();
        await writable.write(fileContent.buffer as ArrayBuffer);
        await writable.close();
      }
    })
  );
};
export const Banner = () => {
  const [update, setUpdate] = useState<{
    version: string;
  }>();
  const [progress, setProgress] = useState<string>();

  const msg = progress ?? (update ? `发现新版本${update.version}，请更新` : "");

  const saveExtensionFiles = async (dirHandle: FileSystemDirectoryHandle) => {
    setProgress("正在下载...");
    const buf = await (await fetchExtension()).arrayBuffer();
    setProgress("正在保存...");
    const files = UZIP.parse(buf);
    console.log(files);
    const f = Object.fromEntries(
      Object.entries(files)
        .filter(([k, v]) => !k.endsWith("/"))
        .map(([k, v]) => [k.replace("dist/extension/", ""), v])
    );
    await saveFilesInDirectory(dirHandle, f);
  };
  const updateExtension = async () => {
    try {
      const dirHandle = await window.showDirectoryPicker({
        id: directoryId,
        mode: "readwrite",
      });
      console.log(dirHandle);
      await saveExtensionFiles(dirHandle);
      await chrome.storage.local.set({
        [storageKeys.UPDATE_INFO]: null,
      });
      chrome.runtime.reload();
    } catch (error) {
      console.error(error);
    }
  };
  useEffect(() => {
    chrome.storage.local.get(storageKeys.UPDATE_INFO).then((res) => {
      if (res[storageKeys.UPDATE_INFO]) {
        fetchExtension();
      }
      setUpdate(res[storageKeys.UPDATE_INFO] as UpdateInfo | undefined);
    });
  }, []);

  return (
    <div
      className={`p-2.5 rounded-md flex items-center ${update ? "bg-red-300" : ""}`}
    >
      <h1 className="text-2xl">阅卷仙人</h1>
      <span>{msg}</span>
      <button
        className="small-btn ml-4"
        onClick={() => {
          if (update) {
            updateExtension();
            return;
          }
          checkUpdate().then((res) => {
            if (res) {
              setUpdate(res);
              updateExtension();
            } else {
              setProgress("已是最新版本");
              setTimeout(() => {
                setProgress(undefined);
              }, 3000);
            }
          });
        }}
      >
        更新
      </button>
    </div>
  );
};
