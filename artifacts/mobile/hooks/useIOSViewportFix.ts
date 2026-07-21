import { useEffect } from "react";
import { Platform } from "react-native";

/**
 * Fixes an iOS-only bug in the installed ("Add to Home Screen") PWA: iOS
 * Safari never resizes the layout viewport when the on-screen keyboard
 * opens — it only shrinks `window.visualViewport` and pans the page. In
 * standalone display mode there's no browser chrome to reclaim the pan, so
 * on keyboard close the header/menu/buttons can stay shifted upward.
 *
 * Android and iOS Safari in a normal browser tab already handle this
 * correctly (Android via the `interactive-widget=resizes-visual` viewport
 * meta tag already set in app/+html.tsx), so this hook detects iOS and
 * no-ops everywhere else to avoid touching already-working behavior.
 */
export function useIOSViewportFix() {
  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const nav = window.navigator;
    const isIOS =
      /iP(hone|od|ad)/.test(nav.platform) ||
      // iPadOS 13+ reports as "MacIntel" but is touch-capable, unlike a real Mac.
      (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);

    if (!isIOS) return;

    // Scopes the CSS lock (position: fixed body/html, #root height clamp)
    // in app/+html.tsx to iOS only — see the `.ios-vh-fix` selectors there.
    const root = document.documentElement;
    root.classList.add("ios-vh-fix");

    const getViewportHeight = () =>
      window.visualViewport ? window.visualViewport.height : window.innerHeight;

    // Baseline height with no keyboard visible, used to detect keyboard close.
    const initialHeight = getViewportHeight();

    const updateAppHeight = () => {
      root.style.setProperty("--app-height", `${getViewportHeight()}px`);
    };

    updateAppHeight();

    const restoreScrollPosition = () => {
      // Undo any scroll/pan iOS applied while bringing the focused input
      // above the keyboard — nothing in this app's layout should be
      // scrollable at the html/body level, so (0,0) is always correct.
      window.scrollTo(0, 0);
      document.body.style.transform = "";
      document.body.style.top = "";
    };

    const handleViewportChange = () => {
      updateAppHeight();
      // Keyboard is considered closed once the visible height is back near
      // its original value — restore scroll so nothing stays displaced.
      if (Math.abs(getViewportHeight() - initialHeight) < 2) {
        restoreScrollPosition();
      }
    };

    const handleFocusOut = () => {
      // iOS fires focusout before the keyboard has finished collapsing, so
      // the restore has to happen a tick later, once the viewport has
      // actually resized back.
      setTimeout(() => {
        restoreScrollPosition();
        updateAppHeight();
      }, 100);
    };

    const handleOrientationChange = () => {
      setTimeout(updateAppHeight, 300);
    };

    window.visualViewport?.addEventListener("resize", handleViewportChange);
    window.visualViewport?.addEventListener("scroll", updateAppHeight);
    window.addEventListener("focusout", handleFocusOut);
    window.addEventListener("orientationchange", handleOrientationChange);

    return () => {
      window.visualViewport?.removeEventListener("resize", handleViewportChange);
      window.visualViewport?.removeEventListener("scroll", updateAppHeight);
      window.removeEventListener("focusout", handleFocusOut);
      window.removeEventListener("orientationchange", handleOrientationChange);
      root.classList.remove("ios-vh-fix");
      root.style.removeProperty("--app-height");
    };
  }, []);
}
