import { useState, useEffect } from "react";
import { Platform } from "react-native";

/**
 * Tracks the browser online/offline state on web.
 * On native (iOS/Android) always returns true — the OS handles connectivity UI.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (Platform.OS !== "web" || typeof navigator === "undefined") return true;
    return navigator.onLine;
  });

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
