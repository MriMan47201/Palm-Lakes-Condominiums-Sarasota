---
name: Expo web build/deploy flow
description: How to rebuild/patch the Expo web export for the Palm Lakes mobile artifact, and a testing-tool limitation with RN-Web overlay buttons.
---

## Build/deploy sequence
From `artifacts/mobile`:
1. `EXPO_METRO_SERVER_PORT=19876 pnpm exec expo export --platform web --output-dir dist`
   - Must run in the **foreground** with a generous timeout (~120s). Backgrounding with `&`/`nohup`/`disown` in the bash tool does not survive between tool calls — the process dies silently with an empty log. Just call the bash tool once with a long timeout and let it block.
   - `expo` bare command is not on PATH; always use `pnpm exec expo` or `npx expo`.
2. `node scripts/patch-web-dist.js` — reapplies PWA/keyboard/iOS meta patches (idempotent, checks for HTML comment markers).
3. `suggest_deploy` for Replit publish; remind the user to push to GitHub separately for Netlify (Netlify serves `dist/` directly, no separate build step there).

## Installing new native/web packages
Use `npx expo install <pkg>` (not plain `pnpm add`) from `artifacts/mobile` so the version resolved is compatible with the installed Expo SDK. Then run `pnpm install` at the workspace root if the lockfile needs syncing (root node_modules symlinks for workspace packages can go stale after `expo install` and need a root-level `pnpm install` to fix "Cannot find module" tsc errors for packages like `@react-navigation/native`).

## Testing-tool limitation
The Playwright-based `runTest` e2e tool repeatedly fails to click the absolutely-positioned circular hamburger-menu button in this RN-Web export (clicks land on underlying property-card elements instead), even though the button renders correctly and is visually confirmed via screenshots. Treat repeated click-targeting failures on RN-Web overlay/absolute-positioned Pressables as a probable tooling limitation, not necessarily an app bug — cross-check via screenshot + grepping the compiled JS bundle for expected strings/logic before concluding there's a real defect.
