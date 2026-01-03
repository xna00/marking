import { UZIP } from "./UZIP.js";
const downloadBtn = document.getElementById("download_btn");
const updateBtn = document.getElementById("update_btn");
console.log(UZIP);
const directoryId = "directoryId";
const saveFilesInDirectory = async (dirHandle, files) => {
    for (const [fileName, fileContent] of Object.entries(files)) {
        if (!fileName)
            continue;
        const filePath = fileName.split("/");
        if (filePath.length > 1) {
            const dir = await dirHandle.getDirectoryHandle(filePath[0], {
                create: true,
            });
            await saveFilesInDirectory(dir, {
                [filePath.slice(1).join("/")]: fileContent,
            });
        }
        else {
            const fileHandle = await dirHandle.getFileHandle(fileName, {
                create: true,
            });
            const writable = await fileHandle.createWritable();
            await writable.write(fileContent.buffer);
            await writable.close();
        }
    }
};
const saveExtensionFiles = async (dirHandle) => {
    const buf = await (await fetch("./extension.zip")).arrayBuffer();
    const files = UZIP.parse(buf);
    console.log(files);
    const f = Object.fromEntries(Object.entries(files)
        .filter(([k, v]) => !k.endsWith("/"))
        .map(([k, v]) => [k.replace("dist/extension/", ""), v]));
    await saveFilesInDirectory(dirHandle, f);
};
downloadBtn.addEventListener("click", async function () {
    try {
        const dirHandle = await window.showDirectoryPicker({
            id: directoryId,
            mode: "readwrite",
        });
        console.log(dirHandle);
        await saveExtensionFiles(dirHandle);
    }
    catch (error) {
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
    }
    catch (error) {
        console.error(error);
    }
});
