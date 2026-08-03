// ── Blue palette ──────────────────────────────────────────────────────────────
// Warm sand backgrounds retained; accent family shifted to match the
// light-blue shades used in the property detail popup (#EBF7FF / #D5EDFA).

const accent      = "#1A72A0";  // Deep sky blue — sort bar, badges, icons
const accentLight = "#26A0D8";  // Lighter sky blue — dark-mode highlights
const navy        = "#0C2F3D";  // Very dark blue-navy (header gradient base)
const navyMid     = "#154E6A";  // Mid blue-dark (dark-mode panels)
const navyLight   = "#1A6A90";  // Clear sky blue

export default {
  light: {
    text:                 "#1C2526",  // Near-black charcoal — max legibility
    textSecondary:        "#2B6E8A",  // Blue-toned city/state labels
    textMuted:            "#8A9B9B",  // Muted gray — timestamps, labels
    background:           "#EAE4D8",  // Warm sand — page background (unchanged)
    backgroundSecondary:  "#F5F0E8",  // Warm cream — panels, sync bar (unchanged)
    backgroundTertiary:   "#DDD8CE",  // Sandy — input fields, pressed states (unchanged)
    tint:                 accent,
    tintLight:            accentLight,
    navy,
    navyMid,
    navyLight,
    separator:            "#C8BDA8",  // Warm tan dividers (unchanged)
    card:                 "#FAF7F0",  // Lightest cream — property cards (unchanged)
    tabIconDefault:       "#9AAAB8",
    tabIconSelected:      accent,
    success:              "#10B981",
    warning:              "#F59E0B",
    error:                "#EF4444",
    shadow:               "rgba(20, 35, 50, 0.10)",
  },
  dark: {
    text:                 "#E2EEE8",
    textSecondary:        "#7AB8D8",
    textMuted:            "#4A7A90",
    background:           "#061520",
    backgroundSecondary:  "#0C2F3D",
    backgroundTertiary:   "#154E6A",
    tint:                 accent,
    tintLight:            accentLight,
    navy,
    navyMid,
    navyLight,
    separator:            "#154E6A",
    card:                 "#0C2F3D",
    tabIconDefault:       "#4A7A90",
    tabIconSelected:      accent,
    success:              "#34D399",
    warning:              "#FBBF24",
    error:                "#F87171",
    shadow:               "rgba(0, 0, 0, 0.45)",
  },
};
