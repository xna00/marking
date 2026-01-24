import { use, useEffect, useState } from "react";

export const useStateWithChromeStorage = <T>(key: string, initialValue: T) => {
  const [value, setValue] = useState<T>(initialValue);

  useEffect(() => {
    chrome.storage.local.get<{
      [key: string]: T | undefined;
    }>(key, (result) => {
      setValue(result[key] ?? initialValue);
    });
  }, []);

  useEffect(() => {
    chrome.storage.local.set({ [key]: value });
  }, [value]);

  return [value, setValue] as const;
};
