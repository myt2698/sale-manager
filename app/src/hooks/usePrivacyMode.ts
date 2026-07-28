import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "sales-sys-privacy-mode";

export function usePrivacyMode() {
  const [privacyMode, setPrivacyMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(privacyMode));
  }, [privacyMode]);

  const toggle = useCallback(() => {
    setPrivacyMode(prev => !prev);
  }, []);

  return { privacyMode, toggle };
}
