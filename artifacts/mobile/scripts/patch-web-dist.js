#!/usr/bin/env node
/**
 * Post-export patch for dist/index.html.
 *
 * Expo's static exporter ignores app/+html.tsx when generating the web
 * index.html shell, so we post-process it here. Run this after every
 * `expo export --platform web` invocation (see the "export" script in
 * package.json).
 *
 * Patches applied:
 *
 * 1. Height-lock script — captures window.innerHeight BEFORE the virtual
 *    keyboard ever appears and locks that pixel value into CSS. This prevents
 *    the entire app from shifting up when the keyboard opens on mobile, which
 *    happens because the browser resizes the layout viewport (shrinking
 *    html/body/root with it).
 *
 * 2. interactive-widget=resizes-visual — bonus viewport hint for Chrome 108+
 *    Android: tells the browser to overlay the keyboard instead of resizing
 *    the layout viewport. Belt-and-suspenders alongside the height-lock.
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

// ── 1. Height-lock script ────────────────────────────────────────────────────
// Inject as the very first child of <head> so it runs before any styles or
// framework code. Idempotent: skipped if the marker id is already present.
const VH_LOCK_ID = "vh-lock-script";
const VH_LOCK = [
  `<script id="${VH_LOCK_ID}">`,
  "(function(){",
  "var h=window.innerHeight;",
  "var s=document.createElement('style');",
  "s.id='vh-lock-style';",
  "s.textContent='html,body,#root{height:'+h+'px!important;",
  "max-height:'+h+'px!important;overflow:hidden!important;}';",
  "document.head.appendChild(s);",
  "})();",
  "</script>",
].join("");

if (!html.includes(VH_LOCK_ID)) {
  html = html.replace("<head>", "<head>\n    " + VH_LOCK);
  changed = true;
  console.log("patch-web-dist: injected height-lock script");
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
  console.log("patch-web-dist: added interactive-widget=resizes-visual");
}

if (changed) {
  fs.writeFileSync(htmlPath, html, "utf-8");
  console.log("patch-web-dist: dist/index.html updated");
} else {
  console.log("patch-web-dist: dist/index.html already up to date");
}
