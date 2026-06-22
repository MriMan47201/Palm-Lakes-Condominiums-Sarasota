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

// ── 0. Remove legacy height-lock script (caused header to get stuck off-screen)
const LEGACY_LOCK_RE = /<script id="vh-lock-script">[\s\S]*?<\/script>\s*/;
if (LEGACY_LOCK_RE.test(html)) {
  html = html.replace(LEGACY_LOCK_RE, "");
  changed = true;
  console.log("patch-web-dist: removed legacy height-lock script");
}

// ── 1. html { overflow: hidden } ────────────────────────────────────────────
// Injected as a <style> inside <head>. Idempotent via marker class.
const OVERFLOW_MARKER = "plc-html-overflow-fix";
const OVERFLOW_STYLE = `<style class="${OVERFLOW_MARKER}">html{overflow:hidden;}</style>`;

if (!html.includes(OVERFLOW_MARKER)) {
  html = html.replace("</head>", `  ${OVERFLOW_STYLE}\n</head>`);
  changed = true;
  console.log("patch-web-dist: injected html{overflow:hidden} style");
}

// ── 2. interactive-widget=resizes-visual ────────────────────────────────────
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
