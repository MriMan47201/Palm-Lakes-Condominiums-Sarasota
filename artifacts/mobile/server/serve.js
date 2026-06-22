/**
 * Standalone production server for Expo static builds.
 *
 * Serves the output of build.js (static-build/) with two special routes:
 * - GET / or /manifest with expo-platform header → platform manifest JSON
 * - GET / without expo-platform → landing page HTML
 * Everything else falls through to static file serving from ./static-build/.
 *
 * Zero external dependencies — uses only Node.js built-ins (http, fs, path).
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const STATIC_ROOT = path.resolve(__dirname, "..", "static-build");
const WEB_ROOT = path.resolve(__dirname, "..", "dist");
const TEMPLATE_PATH = path.resolve(__dirname, "templates", "landing-page.html");
const basePath = (process.env.BASE_PATH || "/").replace(/\/+$/, "");
const hasWebBuild = fs.existsSync(path.join(WEB_ROOT, "index.html"));

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json",
};

function getAppName() {
  try {
    const appJsonPath = path.resolve(__dirname, "..", "app.json");
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf-8"));
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}

function serveManifest(platform, res) {
  const manifestPath = path.join(STATIC_ROOT, platform, "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(
      JSON.stringify({ error: `Manifest not found for platform: ${platform}` }),
    );
    return;
  }

  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.writeHead(200, {
    "content-type": "application/json",
    "expo-protocol-version": "1",
    "expo-sfv-version": "0",
  });
  res.end(manifest);
}

function serveLandingPage(req, res, landingPageTemplate, appName) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = forwardedProto || "https";
  const host = req.headers["x-forwarded-host"] || req.headers["host"];
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
}

const PHONE_FRAME_INJECT = '<link rel="stylesheet" href="/phone-frame.css" />';

function serveWebFile(urlPath, res) {
  let decoded = urlPath;
  try { decoded = decodeURIComponent(urlPath); } catch (_) {}
  const safePath = path.normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, "");
  let filePath = path.join(WEB_ROOT, safePath);

  if (!filePath.startsWith(WEB_ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(WEB_ROOT, "index.html");
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  // Inject phone-frame stylesheet and mobile keyboard fixes into the HTML shell
  if (filePath.endsWith("index.html")) {
    const raw = fs.readFileSync(filePath, "utf-8");
    const patched = raw
      // interactive-widget=resizes-visual: keyboard overlays instead of
      // resizing the layout viewport (Chrome 108+ Android).
      .replace(
        /(<meta\s+name="viewport"\s+content="[^"]*?)(")/,
        (_, prefix, close) =>
          prefix.includes("interactive-widget")
            ? prefix + close
            : prefix + ", interactive-widget=resizes-visual" + close
      )
      // html{height:100lvh;overflow:hidden}: baseline CSS fix (URL-bar + Chrome).
      // iOS-specific JS lock below handles the keyboard case for Safari browser.
      .replace(
        "</head>",
        `  <style class="plc-keyboard-fix">html{height:100lvh;overflow:hidden;}</style>\n  <script class="plc-ios-keyboard-lock">(function(){var ua=navigator.userAgent;if(!/iP(hone|ad|od)/.test(ua)||window.MSStream)return;var h=window.innerHeight;var s=document.createElement('style');s.className='plc-ios-lock-style';function apply(){s.textContent='html,body,#root{height:'+h+'px!important;max-height:'+h+'px!important;}'}apply();document.head.appendChild(s);window.addEventListener('resize',function(){var n=window.innerHeight,d=Math.abs(n-h);if(d>0&&d<150){h=n;apply();}},{passive:true});document.addEventListener('focusout',function(){setTimeout(function(){window.scrollTo(0,0);},150);},true);})();</script>\n  ${PHONE_FRAME_INJECT}\n</head>`
      );
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(patched);
    return;
  }

  const content = fs.readFileSync(filePath);
  res.writeHead(200, { "content-type": contentType });
  res.end(content);
}

function serveStaticFile(urlPath, res) {
  const safePath = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(STATIC_ROOT, safePath);

  if (!filePath.startsWith(STATIC_ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { "content-type": contentType });
  res.end(content);
}

const landingPageTemplate = fs.readFileSync(TEMPLATE_PATH, "utf-8");
const appName = getAppName();

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  let pathname = url.pathname;

  if (basePath && pathname.startsWith(basePath)) {
    pathname = pathname.slice(basePath.length) || "/";
  }

  const platform = req.headers["expo-platform"];
  if ((pathname === "/" || pathname === "/manifest") && (platform === "ios" || platform === "android")) {
    return serveManifest(platform, res);
  }

  if (hasWebBuild) {
    // Try static-build first so Expo native asset requests (bundles, assets)
    // are still served correctly even when a web dist/ build is present.
    const safePath = path.normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
    const staticCandidate = path.join(STATIC_ROOT, safePath);
    if (
      staticCandidate.startsWith(STATIC_ROOT) &&
      fs.existsSync(staticCandidate) &&
      !fs.statSync(staticCandidate).isDirectory()
    ) {
      return serveStaticFile(pathname, res);
    }
    return serveWebFile(pathname, res);
  }

  if (pathname === "/" || pathname === "") {
    return serveLandingPage(req, res, landingPageTemplate, appName);
  }
  serveStaticFile(pathname, res);
});

const port = parseInt(process.env.PORT || "3000", 10);
server.listen(port, "0.0.0.0", () => {
  console.log(`Serving static Expo build on port ${port}`);
});
