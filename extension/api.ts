import { createHandler } from "@marking/api";
import { BACKEND_URL, storageKeys } from "./constants.js";
import { chromeStorageLocalGet } from "./storage.js";

export const api = createHandler(`${BACKEND_URL}/api`, {
  beforeRequest: async (req) => {
    const { [storageKeys.AUTH_TOKEN]: token } = await chromeStorageLocalGet(storageKeys.AUTH_TOKEN);
    if (token) {
      req.headers.set("Authorization", `Bearer ${token}`);
    }
    req.headers.set("Version", chrome.runtime.getManifest().version);
    return req;
  },
});
