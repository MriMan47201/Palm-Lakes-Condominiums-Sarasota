---
name: iOS PWA multi-page PDF viewing
description: iPhone's inline PDF viewer inside an app-owned iframe may expose only the first page; render pages separately for reliable in-app scrolling.
---

When a multi-page PDF must be browsable inside the iOS PWA, do not rely on the browser's native PDF viewer embedded in an iframe. iPhone can show the first page while hiding access to subsequent pages. For small, mostly static documents, render each page to a bundled image, trim only the outer blank margins around text/image content with a little padding, and display all pages in a vertically scrollable in-app view. Keep clear front/back labels and preserve the original PDF unchanged.

**Why:** The two-page owner-directory instructions PDF showed only its text/front page in the iPhone in-app iframe, leaving the screenshots on the reverse side inaccessible. The user also approved trimming blank margins in the viewer while keeping the original PDF unchanged.

**How to apply:** Use content-bounded page images as the viewer content and a React Native `ScrollView` so web/PWA and native users can reach every page without leaving the app; leave the source PDF available for full-page fidelity.
