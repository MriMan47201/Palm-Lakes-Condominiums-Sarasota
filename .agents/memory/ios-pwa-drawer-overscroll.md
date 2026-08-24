---
name: iOS PWA drawer overscroll
description: iPhone drawer scrolling needs bounce suppression and enough bottom clearance for footer content to remain visible after release.
---

For full-height slide-out drawers on iPhone/PWA, suppress native and browser overscroll on the drawer's scroll region and leave extra bottom safe-area clearance. Otherwise releasing at the end can spring the content back down and cover footer/About lines.

**Why:** iOS overscroll behavior made the drawer appear to snap back over its final About copy, requiring the user to hold the gesture in place.

**How to apply:** Use `bounces={false}`, `alwaysBounceVertical={false}`, `overScrollMode="never"`, and web `overscroll-behavior: none` on the drawer ScrollView; include generous bottom padding after the final content.