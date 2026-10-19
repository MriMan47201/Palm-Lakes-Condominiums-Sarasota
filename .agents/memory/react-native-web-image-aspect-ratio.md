---
name: React Native Web image aspect ratios
description: On web, Image may ignore an aspectRatio style and retain its intrinsic height; constrain the ratio on a wrapper View instead.
---

For fixed-ratio page images in React Native Web, put `aspectRatio` on a wrapper `View` and set the child `Image` to `width: "100%"` and `height: "100%"`. Keep `resizeMode="contain"` for native rendering. Styling `aspectRatio` only on the RN `Image` may be ignored by React Native Web, leaving it at its intrinsic pixel height while its width scales down.

**Why:** The instructions pages rendered at 760 × 1584 instead of their letter-page ratio of 760 × 984, adding excessive vertical whitespace.

**How to apply:** When a web image should scale proportionally, inspect its rendered `getBoundingClientRect()` against the natural ratio; if the ratio is wrong, constrain a parent `View` and fill it with the image.
