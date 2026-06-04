import { createHandler } from "@marking/api";
import { BACKEND_URL, storageKeys } from "./constants.js";

export const api = createHandler(`${BACKEND_URL}/api`, {
  beforeRequest: async (req) => {
    const token = await chrome.storage.local.get<{[storageKeys.AUTH_TOKEN]?: string}>(storageKeys.AUTH_TOKEN)
    if (token.authToken) {
      req.headers.set("Authorization", `Bearer ${token.authToken}`);
    }
    req.headers.set("Version", chrome.runtime.getManifest().version);
    return req;
  },
});
