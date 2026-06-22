#!/usr/bin/env node
/**
 * Post-export patch for dist/index.html.
 *
 * Expo's static exporter ignores app/+html.tsx for the HTML shell, so we
 * post-process it here. Run via `pnpm run export` (chains after expo export).
 *
 * Patches applied:
 *
 * 1. overflow: hidden on <html> — the expo-reset CSS already sets this on
 *    <body>, but mobile browsers (especially Chrome Android) can still scroll
 *    the document element when an input is focused, panning the whole page up.
 *    Locking <html> as well prevents that document-level pan.
 *
 * 2. interactive-widget=resizes-visual — viewport hint for Chrome 108+ Android:
 *    tells the browser to overlay the keyboard instead of resizing the layout
 *    viewport, so absolutely-positioned elements (tab bar, hamburger) don't
 *    shift when the keyboard opens.
 */

const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "dist", "index.html");

if (!fs.existsSync(htmlPath)) {
  console.error("patch-web-dist: dist/index.html not found — run expo export first");
  process.exit(1);
}

let html = fs.readFileSync(htmlPath, "utf-8");
let changed = false;

// ── 0. Remove legacy height-lock scripts (old approaches)
const LEGACY_LOCK_RE = /<script id="vh-lock-script">[\s\S]*?<\/script>\s*/;
if (LEGACY_LOCK_RE.test(html)) {
  html = html.replace(LEGACY_LOCK_RE, "");
  changed = true;
  console.log("patch-web-dist: removed legacy height-lock script");
}

// ── 1. Keyboard-stable root height ──────────────────────────────────────────
// iOS Safari resizes the layout viewport when the keyboard opens, shrinking
// html/body/#root (all height:100%) and shifting everything upward.
// `height: 100lvh` (large viewport height) is defined as the viewport height
// WITHOUT the keyboard — it stays constant when the keyboard appears.
// Supported: iOS Safari 15.4+ (iPhone 15 = iOS 17 ✓), Chrome 108+.
// Fallback: ignored by older browsers, which keep the existing height:100%.
//
// `overflow: hidden` on html prevents document-level panning/scroll on both
// iOS Safari and Android Chrome when an input is focused.
const KEYBOARD_FIX_MARKER = "plc-keyboard-fix";
const KEYBOARD_FIX_STYLE = `<style class="${KEYBOARD_FIX_MARKER}">html{height:100lvh;overflow:hidden;}</style>`;

// Remove old overflow-only fix if present from a previous patch run
html = html.replace(/<style class="plc-html-overflow-fix">[\s\S]*?<\/style>\s*/g, "");

if (!html.includes(KEYBOARD_FIX_MARKER)) {
  html = html.replace("</head>", `  ${KEYBOARD_FIX_STYLE}\n</head>`);
  changed = true;
  console.log("patch-web-dist: injected keyboard-stable height (100lvh) + overflow:hidden");
}

// ── 2. iOS Safari keyboard height-lock script ───────────────────────────────
// `100lvh` is defined for the URL bar, NOT the keyboard. On iOS Safari in
// regular browser mode (not installed PWA), the keyboard still shrinks the
// layout viewport, so `height:100%` chains (html→body→#root) all shrink and
// everything shifts upward.
//
// Fix: capture window.innerHeight at load time on iOS only and lock
// html/body/root to that pixel value. A resize listener updates the lock only
// for URL-bar changes (~50 px) and ignores keyboard open/close (~290 px).
// Chrome/Android is unaffected (interactive-widget handles it instead).
const IOS_LOCK_MARKER = "plc-ios-keyboard-lock";
const IOS_LOCK_SCRIPT = `<script class="${IOS_LOCK_MARKER}">(function(){var ua=navigator.userAgent;if(!/iP(hone|ad|od)/.test(ua)||window.MSStream)return;var h=window.innerHeight;window.__PLC_BASE_HEIGHT=h;var s=document.createElement('style');s.className='plc-ios-lock-style';function apply(){s.textContent='html,body,#root{height:'+h+'px!important;max-height:'+h+'px!important;}'}apply();document.head.appendChild(s);window.addEventListener('resize',function(){var n=window.innerHeight,d=Math.abs(n-h);if(d>0&&d<150){h=n;window.__PLC_BASE_HEIGHT=h;apply();}},{passive:true});document.addEventListener('focusout',function(){setTimeout(function(){window.scrollTo(0,0);},150);},true);})();</script>`;

// Remove stale copies from previous patch runs
html = html.replace(/<script class="plc-ios-keyboard-lock">[\s\S]*?<\/script>\s*/g, "");

if (!html.includes(IOS_LOCK_MARKER)) {
  html = html.replace("</head>", `  ${IOS_LOCK_SCRIPT}\n</head>`);
  changed = true;
  console.log("patch-web-dist: injected iOS Safari keyboard height-lock script");
}

// ── 3. interactive-widget=resizes-visual ────────────────────────────────────
const VIEWPORT_RE = /(<meta\s+name="viewport"\s+content=")([^"]*)(")/;
const match = html.match(VIEWPORT_RE);
if (match && !match[2].includes("interactive-widget")) {
  html = html.replace(
    VIEWPORT_RE,
    (_, open, content, close) =>
      open + content + ", interactive-widget=resizes-visual" + close
  );
  changed = true;
  console.log("patch-web-dist: added interactive-widget=resizes-visual to viewport");
}

if (changed) {
  fs.writeFileSync(htmlPath, html, "utf-8");
  console.log("patch-web-dist: dist/index.html updated");
} else {
  console.log("patch-web-dist: dist/index.html already up to date");
}
