import { use, useEffect, useState } from "react";
import { HOST, storageKeys } from "../constants";
import UZIP from "uzip";

const fetchExtension = () =>
  fetch(new URL("/extension.zip", HOST), { cache: "no-cache" });

const directoryId = "directoryId";

enum Progress {
  IDLE = "IDLE",
  DOWNLOADING = "DOWNLOADING",
  SAVING = "SAVING",
}
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
  const update = use(chrome.storage.local.get(storageKeys.UPDATE_INFO)) as {
    [storageKeys.UPDATE_INFO]:
      | {
          version: string;
        }
      | undefined;
  };
  const [progress, setProgress] = useState(Progress.IDLE);

  console.log(update);
  const hasUpdate = !!update[storageKeys.UPDATE_INFO];

  const saveExtensionFiles = async (dirHandle: FileSystemDirectoryHandle) => {
    setProgress(Progress.DOWNLOADING);
    const buf = await (await fetchExtension()).arrayBuffer();
    setProgress(Progress.SAVING);
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
      chrome.runtime.reload();
    } catch (error) {
      console.error(error);
    }
  };
  useEffect(() => {
    if (hasUpdate) {
      fetchExtension();
    }
  }, []);

    if (!hasUpdate) {
      return null;
    }
  return (
    <div className="bg-red-500 p-3 rounded-md">
      {
        {
          [Progress.IDLE]: (
            <div className="">
              <span>
                发现新版本（ {update[storageKeys.UPDATE_INFO]?.version}
                ），请更新
              </span>
              <button
                className="small-btn ml-4"
                onClick={() => {
                  updateExtension();
                }}
              >
                更新
              </button>
            </div>
          ),
          [Progress.DOWNLOADING]: <span>正在下载...</span>,
          [Progress.SAVING]: <span>正在保存...</span>,
        }[progress]
      }
    </div>
  );
};
