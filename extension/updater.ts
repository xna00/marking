console.log("updater.ts loaded");
console.log(chrome);

document.addEventListener("reloadExtension", async () => {
  console.log("Reloading extension...");
  await chrome.runtime.sendMessage({ action: "reloadExtension" });
  setTimeout(() => {
    location.reload();
  }, 1000);
});
