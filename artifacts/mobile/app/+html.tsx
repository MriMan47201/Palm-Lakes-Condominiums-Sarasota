import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

/**
 * Web-only HTML shell for the Expo Router PWA.
 * This file only renders on the web build — it is ignored on iOS/Android.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, interactive-widget=resizes-visual"
        />

        {/* PWA manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* iOS home-screen icon + status bar */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Palm Lakes" />

        {/* Theme colour for Android Chrome tab bar */}
        <meta name="theme-color" content="#073B4C" />

        {/* Suppress the default body margin Expo adds on web */}
        <ScrollViewStyleReset />

        {/*
          iOS Safari standalone-PWA keyboard fix.
          Expo's ScrollViewStyleReset above sets `html,body,#root{height:100%}`,
          which iOS Safari treats as the height of the *layout* viewport. When
          the keyboard opens, iOS shrinks the visual viewport but not the
          layout viewport, so it pans/scrolls the whole page upward instead —
          and in standalone display mode (no browser chrome) that pan often
          fails to fully reverse when the keyboard closes, leaving the
          header/menu/buttons displaced.
          All rules below are scoped to `.ios-vh-fix`, a class added only on
          iOS by hooks/useIOSViewportFix.ts, so Android and desktop browsers
          keep their existing (already correct) behavior untouched.
        */}
        <style
          id="ios-viewport-fix"
          // biome-ignore lint: static style tag, no user input involved
          dangerouslySetInnerHTML={{
            __html: `
              :root {
                /* 100vh first as a fallback for browsers without dvh support,
                   then 100dvh (dynamic viewport height) which already tracks
                   keyboard/URL-bar changes on modern browsers. JS overwrites
                   this with the live window.visualViewport height on iOS. */
                --app-height: 100vh;
                --app-height: 100dvh;
              }
              html.ios-vh-fix,
              html.ios-vh-fix body {
                height: 100%;
                overflow: hidden;
                position: fixed;
                width: 100%;
                margin: 0;
              }
              html.ios-vh-fix #root {
                height: var(--app-height);
                min-height: var(--app-height);
                overflow: hidden;
              }
              /* Momentum scrolling for whichever inner element ends up
                 scrollable (e.g. the FlatList/ScrollView content area),
                 instead of letting the fixed html/body scroll. */
              html.ios-vh-fix [style*="overflow-y: auto"],
              html.ios-vh-fix [style*="overflow-y:auto"] {
                -webkit-overflow-scrolling: touch;
              }
            `,
          }}
        />

        {/* Phone-frame layout on tablets and desktops */}
        <link rel="stylesheet" href="/phone-frame.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
