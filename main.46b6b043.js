import { UZIP } from "./UZIP.d4a04b03.js";
fetch("./extension.zip", { cache: "no-cache" });
const downloadBtn = document.getElementById("download_btn");
const updateBtn = document.getElementById("update_btn");
const toast = document.getElementById("toast");
const showToast = (msg, duration = 2e3) => {
  toast.innerHTML = msg;
  toast.style.display = "block";
  setTimeout(() => {
    toast.style.display = "none";
  }, duration);
};
console.log(UZIP);
const directoryId = "directoryId";
const saveFilesInDirectory = async (dirHandle, files) => {
  return Promise.all(
    Object.entries(files).map(async ([p, fileContent]) => {
      if (!p) return;
      const filePath = p.split("/");
      if (filePath.length > 1) {
        const dir = await dirHandle.getDirectoryHandle(filePath[0], {
          create: true
        });
        await saveFilesInDirectory(dir, {
          [filePath.slice(1).join("/")]: fileContent
        });
      } else {
        const fileHandle = await dirHandle.getFileHandle(p, {
          create: true
        });
        const writable = await fileHandle.createWritable();
        await writable.write(fileContent.buffer);
        await writable.close();
      }
    })
  );
};
const saveExtensionFiles = async (dirHandle) => {
  const buf = await (await fetch("./extension.zip", {
    cache: "no-cache"
  })).arrayBuffer();
  showToast("\u4E0B\u8F7D\u5B8C\u6210\uFF0C\u6B63\u5728\u4FDD\u5B58\u6587\u4EF6...");
  const files = UZIP.parse(buf);
  console.log(files);
  const f = Object.fromEntries(
    Object.entries(files).filter(([k, v]) => !k.endsWith("/")).map(([k, v]) => [k.replace("dist/extension/", ""), v])
  );
  await saveFilesInDirectory(dirHandle, f);
  showToast("\u66F4\u65B0\u5B8C\u6210\uFF0C\u7B49\u5F85\u9875\u9762\u5237\u65B0...", 6e4);
};
downloadBtn.addEventListener("click", async function() {
  try {
    const dirHandle = await window.showDirectoryPicker({
      id: directoryId,
      mode: "readwrite"
    });
    console.log(dirHandle);
    await saveExtensionFiles(dirHandle);
  } catch (error) {
    console.error(error);
  }
});
updateBtn.addEventListener("click", async function() {
  try {
    const dirHandle = await window.showDirectoryPicker({
      id: directoryId,
      mode: "readwrite"
    });
    await saveExtensionFiles(dirHandle);
    const event = new CustomEvent("reloadExtension");
    document.dispatchEvent(event);
  } catch (error) {
    console.error(error);
  }
});
