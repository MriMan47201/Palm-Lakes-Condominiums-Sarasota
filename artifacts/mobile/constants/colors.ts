const accent = "#0891B2";       // Florida Gulf turquoise — readable on all backgrounds
const accentLight = "#22D3EE";  // Bright sky cyan
const navy = "#073B4C";          // Deep Florida ocean (header)
const navyMid = "#0F5E75";       // Gulf midtone
const navyLight = "#187A97";     // Clear water blue

export default {
  light: {
    text: "#322514",
    textSecondary: "#2C6A80",
    textMuted: "#6E9BAD",
    background: "#F0FAFF",
    backgroundSecondary: "#FAF0E6",
    backgroundTertiary: "#DDEFFA",
    tint: accent,
    tintLight: accentLight,
    navy,
    navyMid,
    navyLight,
    separator: "#B8D9E8",
    card: "#FAF0E6",
    tabIconDefault: "#89B5C8",
    tabIconSelected: accent,
    success: "#10B981",
    warning: "#F59E0B",
    error: "#EF4444",
    shadow: "rgba(7, 59, 76, 0.08)",
  },
  dark: {
    text: "#E0F4FF",
    textSecondary: "#7ABDD4",
    textMuted: "#4A7A8E",
    background: "#041824",
    backgroundSecondary: "#073B4C",
    backgroundTertiary: "#0F5E75",
    tint: accent,
    tintLight: accentLight,
    navy,
    navyMid,
    navyLight,
    separator: "#0F5E75",
    card: "#073B4C",
    tabIconDefault: "#4A7A8E",
    tabIconSelected: accent,
    success: "#34D399",
    warning: "#FBBF24",
    error: "#F87171",
    shadow: "rgba(0, 0, 0, 0.4)",
  },
};
