---
name: Expo-print web bug + scrollable overlays
description: expo-print ignores the html option on web, and fixed-height RN Animated.View overlay panels silently clip content as sections are added.
---

## expo-print's `Print.printAsync({ html })` ignores `html` on web
On the web platform, `expo-print`'s `ExponentPrint.web.ts` implementation does not use the `html` argument at all — it just calls `window.print()` on the current page. This means any code that builds custom HTML (e.g. a printable notes/report view) and passes it to `Print.printAsync({ html })` will silently print whatever is currently on screen instead, with no error.

**Why:** Discovered by reading the library's web source directly after a print feature produced the wrong output with no console errors — the bug is invisible from the call site.

**How to apply:** For any "generate custom HTML and print it" feature that must also work on web, branch on `Platform.OS === "web"`. Do NOT use `window.open("", "_blank")` + `document.write` — in a mobile PWA/webview context there is often no real separate tab, so `window.open` just navigates the *current* window to the blank document, replacing the whole app with the printout and leaving the user stuck with no way back (no close button, restart required). A hidden off-screen `<iframe>` + `iframe.contentWindow.print()` (cleaned up on `afterprint`) works for regular browser tabs, but **`window.print()` does nothing at all (no error, no dialog) when the page is running as an installed/"Add to Home Screen" standalone PWA on iOS** — there's no browser chrome to host the print sheet. For that case, generate a real PDF client-side (e.g. with `jsPDF`) and hand it to the native OS via `navigator.share({ files: [pdfFile] })` (Web Share API level 2) — this works even in standalone mode, surfaces "Print"/AirPrint as a share option, and always returns the user to the exact same app screen whether they print, save, or cancel. Detect share support via `navigator.share && navigator.canShare({ files: [...] })` and fall back to the iframe-print approach when unsupported (e.g. desktop browsers). Reserve `Print.printAsync` for true native (iOS/Android app store) builds only.

## Fixed-height overlay panels need an internal ScrollView
RN `Animated.View`-based slide-in panels/drawers with `position: absolute` and fixed `top/bottom` (i.e. filling the screen height) do not automatically scroll. If you add a new section to such a panel without wrapping the content in a `ScrollView`, later sections (e.g. an "About" footer) can silently overflow off-screen with no way to reach them — this is easy to miss because it will look fine in initial testing before content grows.

**Why:** A previously-passing hamburger menu drawer broke after adding a new section; root cause was overflow, not the new section's code itself.

**How to apply:** When building any absolutely-positioned, screen-height overlay panel with multiple stacked sections, wrap the scrollable content region in a `ScrollView` (with `flex: 1` on the ScrollView's `style` and bottom safe-area inset padding moved into `contentContainerStyle`) from the start, keeping only persistent chrome (e.g. a close button row) outside/above it.
