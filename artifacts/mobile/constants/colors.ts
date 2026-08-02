// ── Tropical palette ─────────────────────────────────────────────────────────
// Derived from Palm Lakes reference image: warm sand backgrounds, deep teal
// accents, and rich charcoal text for maximum contrast.

const accent      = "#1A7A74";  // Deep tropical teal — sort bar, badges, icons
const accentLight = "#26A89E";  // Lighter teal — dark-mode highlights
const navy        = "#0C3835";  // Very dark teal-charcoal (header gradient base)
const navyMid     = "#185652";  // Mid teal-dark (dark-mode panels)
const navyLight   = "#1F7470";  // Clear tropical teal

export default {
  light: {
    text:                 "#1C2526",  // Near-black charcoal — max legibility
    textSecondary:        "#2B7875",  // Teal-toned city/state labels
    textMuted:            "#8A9B9B",  // Muted gray-teal — timestamps, labels
    background:           "#EAE4D8",  // Warm sand — page background
    backgroundSecondary:  "#F5F0E8",  // Warm cream — panels, sync bar
    backgroundTertiary:   "#DDD8CE",  // Sandy — input fields, pressed states
    tint:                 accent,
    tintLight:            accentLight,
    navy,
    navyMid,
    navyLight,
    separator:            "#C8BDA8",  // Warm tan dividers
    card:                 "#FAF7F0",  // Lightest cream — property cards
    tabIconDefault:       "#9AABAB",
    tabIconSelected:      accent,
    success:              "#10B981",
    warning:              "#F59E0B",
    error:                "#EF4444",
    shadow:               "rgba(20, 50, 45, 0.10)",
  },
  dark: {
    text:                 "#E2EEE8",
    textSecondary:        "#7ABCB8",
    textMuted:            "#4A7A75",
    background:           "#061714",
    backgroundSecondary:  "#0C3835",
    backgroundTertiary:   "#185652",
    tint:                 accent,
    tintLight:            accentLight,
    navy,
    navyMid,
    navyLight,
    separator:            "#185652",
    card:                 "#0C3835",
    tabIconDefault:       "#4A7A75",
    tabIconSelected:      accent,
    success:              "#34D399",
    warning:              "#FBBF24",
    error:                "#F87171",
    shadow:               "rgba(0, 0, 0, 0.45)",
  },
};
