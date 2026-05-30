import { HOST } from "./constants";

export type UpdateInfo = {
  version: string;
};

export const checkUpdate = async (): Promise<UpdateInfo | undefined> => {
  console.log("checkUpdate");
  const manifest = await (
    await fetch(new URL("/update.json?" + Date.now(), HOST), {
      headers: {
        "Cache-Control": "no-cache",
        "Version": chrome.runtime.getManifest().version,
      },
    })
  ).json();
  console.log(manifest);
  if (manifest.version !== chrome.runtime.getVersion()) {
    return { version: manifest.version };
  }
};
