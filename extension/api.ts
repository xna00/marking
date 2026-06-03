import { createHandler } from "@marking/api";
import { BACKEND_URL } from "./constants.js";
import { getAuthToken } from "./auth.js";

export const api = createHandler(`${BACKEND_URL}/api`, {
  beforeRequest: async (req) => {
    const token = getAuthToken();
    if (token) {
      req.headers.set("Authorization", `Bearer ${token}`);
    }
    req.headers.set("Version", chrome.runtime.getManifest().version);
    return req;
  },
});
