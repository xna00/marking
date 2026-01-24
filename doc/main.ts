import UZIP from "uzip";

const fetchExtension = () => {
  return fetch("./update.json", {
    headers: {
      "Cache-Control": "no-cache",
    },
  })
    .then((res) => res.json())
    .then((updateInfo) => fetch(updateInfo.extensionUrl));
};
fetchExtension();
const downloadBtn = document.getElementById("download_btn")!;
const updateBtn = document.getElementById("update_btn")!;
const toast = document.getElementById("toast")!;

const showToast = (msg: string, duration = 2000) => {
  toast.innerHTML = msg;
  toast.style.display = "block";
  setTimeout(() => {
    toast.style.display = "none";
  }, duration);
};

console.log(UZIP);

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

const saveExtensionFiles = async (dirHandle: FileSystemDirectoryHandle) => {
  const buf = await (await fetchExtension()).arrayBuffer();
  showToast("下载完成，正在保存文件...");

  const files = UZIP.parse(buf);
  console.log(files);
  const f = Object.fromEntries(
    Object.entries(files)
      .filter(([k, v]) => !k.endsWith("/"))
      .map(([k, v]) => [k.replace("dist/extension/", ""), v])
  );
  await saveFilesInDirectory(dirHandle, f);
  showToast("更新完成，等待页面刷新...", 60000);
};

downloadBtn.addEventListener("click", async function () {
  try {
    const dirHandle = await window.showDirectoryPicker({
      id: directoryId,
      mode: "readwrite",
    });
    console.log(dirHandle);
    await saveExtensionFiles(dirHandle);
  } catch (error) {
    console.error(error);
  }
});

updateBtn.addEventListener("click", async function () {
  try {
    const dirHandle = await window.showDirectoryPicker({
      id: directoryId,
      mode: "readwrite",
    });
    await saveExtensionFiles(dirHandle);

    const event = new CustomEvent("reloadExtension");
    document.dispatchEvent(event);
  } catch (error) {
    console.error(error);
  }
});
