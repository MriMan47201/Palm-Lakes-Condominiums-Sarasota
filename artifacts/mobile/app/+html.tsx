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

        {/* Phone-frame layout on tablets and desktops */}
        <link rel="stylesheet" href="/phone-frame.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
