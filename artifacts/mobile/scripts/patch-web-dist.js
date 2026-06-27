#!/usr/bin/env node
/**
 * Post-export patch for dist/index.html.
 *
 * Expo's static exporter ignores app/+html.tsx for the HTML shell, so we
 * post-process it here. Run via `pnpm run export` (chains after expo export).
 *
 * Patches applied:
 *
 * 1. html { height: 100dvh; overflow: hidden }
 *    Dynamic Viewport Height lets the root adapt fluidly to mobile browser
 *    address bars and the software keyboard without the hard clip of 100vh.
 *    overflow: hidden on <html> prevents document-level panning when an
 *    input is focused (expo-reset only sets this on <body>).
 *
 * 2. Blur snap-back script
 *    When any input/textarea loses focus (keyboard closes) the mobile browser
 *    may leave the layout viewport scrolled.  Calling window.scrollTo instantly
 *    resets it to the baseline coordinates so the layout snaps back cleanly.
 *
 * 3. interactive-widget=resizes-visual
 *    Viewport hint for Chrome 108+ Android: keyboard overlays instead of
 *    resizing the layout viewport.
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

// ── 0. Remove legacy patches that are superseded by this version ─────────────
const LEGACY_PATTERNS = [
  // Old height-lock script
  /<script id="vh-lock-script">[\s\S]*?<\/script>\s*/,
  // Old overflow-only fix
  /<style class="plc-html-overflow-fix">[\s\S]*?<\/style>\s*/g,
  // Old lvh fix (replaced by dvh below)
  /<style class="plc-keyboard-fix">[\s\S]*?<\/style>\s*/g,
];
for (const re of LEGACY_PATTERNS) {
  if (re.test(html)) {
    html = html.replace(re, "");
    changed = true;
    console.log("patch-web-dist: removed legacy patch:", re.toString().slice(0, 60));
  }
}

// ── 1. html { height: 100dvh; overflow: hidden } ─────────────────────────────
// 100dvh (Dynamic Viewport Height) adapts to mobile browser chrome and keyboard.
// overflow: hidden blocks document-level panning when an input is focused.
const DVH_MARKER = "plc-dvh-fix";
const DVH_STYLE = `<style class="${DVH_MARKER}">html{height:100dvh;overflow:hidden;}</style>`;

if (!html.includes(DVH_MARKER)) {
  html = html.replace("</head>", `  ${DVH_STYLE}\n</head>`);
  changed = true;
  console.log("patch-web-dist: injected html{height:100dvh;overflow:hidden}");
}

// ── 2. Blur snap-back ─────────────────────────────────────────────────────────
// When any input/textarea loses focus the mobile browser may leave the viewport
// scrolled after the keyboard closes.  This resets it instantly to origin so the
// layout cleanly snaps back to baseline coordinates.
const BLUR_MARKER = "plc-blur-fix";
const BLUR_SCRIPT = `<script class="${BLUR_MARKER}">` +
  `document.addEventListener('blur',function(e){` +
    `var t=e.target;` +
    `if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA')){` +
      `window.scrollTo({top:0,left:0,behavior:'instant'});` +
    `}` +
  `},true);` +
`</script>`;

if (!html.includes(BLUR_MARKER)) {
  html = html.replace("</head>", `  ${BLUR_SCRIPT}\n</head>`);
  changed = true;
  console.log("patch-web-dist: injected blur snap-back script");
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
