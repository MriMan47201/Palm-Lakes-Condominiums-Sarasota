---
name: iOS PWA keyboard page-pan fix
description: Pinning <body> with position:fixed prevents iOS Safari/PWA from panning the whole document when a TextInput is focused, which otherwise can get stuck overlapping the status bar / Dynamic Island.
---

## iOS scrolls/pans the whole document to reveal a focused input, and the pan can get stuck
On iOS Safari (including installed/"Add to Home Screen" standalone PWAs), when a focused `TextInput`/`<input>` is covered by the on-screen keyboard, WebKit scrolls the *document* upward to bring it into view. If nothing else prevents document scrolling (e.g. only `html { overflow: hidden }` without also pinning `body`), the pan can fail to fully reverse when the keyboard closes — leaving the whole page shifted up, overlapping the status bar / Dynamic Island / notch. Existing mitigations like resetting `window.scrollTo(0,0)` on blur are not always sufficient, because the stuck offset isn't always a plain document scroll position.

**Why:** User reported the entire app page shifting upward when the keyboard opened and not returning down all the way after closing, overlapping the Dynamic Island — despite `html { height: 100dvh; overflow: hidden }` and a blur-triggered `window.scrollTo(0,0)` already being in place.

**How to apply:** Pin `<body>` (not just `<html>`) so the document has zero scrollable area at all: `body { position: fixed; top: 0; left: 0; right: 0; bottom: 0; width: 100%; overflow: hidden; }`. With no scrollable document, iOS can no longer pan the page on input focus — it can only resize the visual viewport, which safe-area-aware layout (`useSafeAreaInsets()`) already handles correctly. This is a static HTML/CSS fix (not app JS), so for Expo static web export it belongs in the post-export HTML patch step alongside the existing `viewport-fit=cover` / `100dvh` fixes, not in React code.
