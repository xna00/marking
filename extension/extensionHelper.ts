console.log("updater.ts loaded");
console.log(chrome);

window.document.addEventListener("reloadExtension", async () => {
  console.log("Reloading extension...");
  await chrome.runtime.sendMessage({ action: "reloadExtensionAfterUpgrade" });
  setTimeout(() => {
    window.location.reload();
  }, 1000);
});

const updateBtn = document.getElementById("update_btn");

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
  const buf = await (await fetch("./extension.zip")).arrayBuffer();

  const files: Record<string, Uint8Array> = {};
  console.log(files);
  const f = Object.fromEntries(
    Object.entries(files)
      .filter(([k, v]) => !k.endsWith("/"))
      .map(([k, v]) => [k.replace("dist/extension/", ""), v])
  );
  await saveFilesInDirectory(dirHandle, f);
};

updateBtn?.addEventListener("click", async function () {
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
