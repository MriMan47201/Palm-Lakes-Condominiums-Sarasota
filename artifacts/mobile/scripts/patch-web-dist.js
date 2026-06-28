#!/usr/bin/env node
/**
 * Post-export patch for dist/index.html.
 *
 * Expo's static exporter ignores app/+html.tsx for the HTML shell, so we
 * post-process it here. Run via `pnpm run export` (chains after expo export).
 *
 * Patches applied:
 *
 * 1. <link rel="manifest"> — Expo generates manifest.json but doesn't link
 *    it in the HTML shell for static exports; we add the link here.
 *
 * 2. viewport meta — adds viewport-fit=cover (required for env(safe-area-inset-*)
 *    to report correct values on iOS Safari/PWA, unlocking Dynamic Island /
 *    notch avoidance via the existing useSafeAreaInsets() calls in the app) and
 *    interactive-widget=resizes-visual (Chrome 108+ Android: keyboard overlays
 *    instead of resizing the layout viewport).
 *
 * 3. iOS PWA meta tags:
 *    - apple-mobile-web-app-capable — enables standalone PWA mode on iOS
 *    - apple-mobile-web-app-status-bar-style — status bar style in standalone
 *
 * 4. html { height: 100dvh; overflow: hidden }
 *    Dynamic Viewport Height lets the root adapt to mobile browser chrome and
 *    keyboard.  overflow: hidden on <html> prevents document-level panning.
 *
 * 5. Blur snap-back script — resets window scroll to (0,0) when any input or
 *    textarea loses focus so the layout snaps back after the keyboard closes.
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

// ── 0. Remove legacy patches superseded by this version ──────────────────────
const LEGACY_PATTERNS = [
  /<script id="vh-lock-script">[\s\S]*?<\/script>\s*/,
  /<style class="plc-html-overflow-fix">[\s\S]*?<\/style>\s*/g,
  /<style class="plc-keyboard-fix">[\s\S]*?<\/style>\s*/g,
];
for (const re of LEGACY_PATTERNS) {
  if (re.test(html)) {
    html = html.replace(re, "");
    changed = true;
    console.log("patch-web-dist: removed legacy patch");
  }
}

// ── 1. <link rel="manifest"> ─────────────────────────────────────────────────
// Expo generates manifest.json during export but omits the <link> tag in the
// HTML shell when using static output mode.
const MANIFEST_MARKER = 'rel="manifest"';
if (!html.includes(MANIFEST_MARKER)) {
  html = html.replace(
    "</head>",
    `  <link rel="manifest" href="/manifest.json" />\n</head>`
  );
  changed = true;
  console.log("patch-web-dist: added <link rel=manifest>");
}

// ── 2. viewport meta ─────────────────────────────────────────────────────────
// viewport-fit=cover: required for env(safe-area-inset-*) to report correct
// values on iOS Safari / installed PWA (Dynamic Island, notch, home indicator).
// interactive-widget=resizes-visual: Chrome 108+ Android keyboard hint.
const VIEWPORT_RE = /(<meta\s+name="viewport"\s+content=")([^"]*)(")/;
const vpMatch = html.match(VIEWPORT_RE);
if (vpMatch) {
  let content = vpMatch[2];
  let vpChanged = false;
  if (!content.includes("viewport-fit=cover")) {
    content += ", viewport-fit=cover";
    vpChanged = true;
  }
  if (!content.includes("interactive-widget")) {
    content += ", interactive-widget=resizes-visual";
    vpChanged = true;
  }
  if (vpChanged) {
    html = html.replace(VIEWPORT_RE, vpMatch[1] + content + vpMatch[3]);
    changed = true;
    console.log("patch-web-dist: updated viewport meta →", content);
  }
}

// ── 3. iOS PWA meta tags ─────────────────────────────────────────────────────
const IOS_META_MARKER = "plc-ios-meta";
if (!html.includes(IOS_META_MARKER)) {
  const iosMeta = [
    `  <!-- iOS PWA (plc-ios-meta) -->`,
    `  <meta name="apple-mobile-web-app-capable" content="yes" />`,
    `  <meta name="apple-mobile-web-app-status-bar-style" content="default" />`,
  ].join("\n");
  html = html.replace("</head>", `${iosMeta}\n</head>`);
  changed = true;
  console.log("patch-web-dist: added iOS PWA meta tags");
}

// ── 4. html { height: 100dvh; overflow: hidden } ─────────────────────────────
const DVH_MARKER = "plc-dvh-fix";
const DVH_STYLE = `<style class="${DVH_MARKER}">html{height:100dvh;overflow:hidden;}</style>`;
if (!html.includes(DVH_MARKER)) {
  html = html.replace("</head>", `  ${DVH_STYLE}\n</head>`);
  changed = true;
  console.log("patch-web-dist: injected html{height:100dvh;overflow:hidden}");
}

// ── 5. Blur snap-back ─────────────────────────────────────────────────────────
// Resets the layout viewport to (0,0) when any input/textarea loses focus so
// the layout snaps cleanly back after the keyboard closes.
const BLUR_MARKER = "plc-blur-fix";
const BLUR_SCRIPT =
  `<script class="${BLUR_MARKER}">` +
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

if (changed) {
  fs.writeFileSync(htmlPath, html, "utf-8");
  console.log("patch-web-dist: dist/index.html updated");
} else {
  console.log("patch-web-dist: dist/index.html already up to date");
}
