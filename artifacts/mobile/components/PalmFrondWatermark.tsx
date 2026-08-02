import React from "react";
import Svg, { Path } from "react-native-svg";

interface Props {
  color?: string;
  size?: number;
}

/**
 * Subtle tropical palm-frond watermark used as a background element on
 * property cards. Two layered fronds give depth without competing with content.
 */
export default function PalmFrondWatermark({ color = "#C8BDA8", size = 120 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 140 140" fill="none">
      {/* ── Primary frond — diagonal lower-left → upper-right ── */}
      <Path
        d="M 18 128 C 48 96 88 58 122 16"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Leaflets — right side */}
      <Path d="M 38 108 C 54 98 70 84 76 68"  stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <Path d="M 58 84  C 76 76 92 62 98 46"  stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <Path d="M 78 60  C 96 52 112 38 118 22" stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <Path d="M 96 38  C 112 32 126 18 130 4"  stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" />
      {/* Leaflets — left side */}
      <Path d="M 30 112 C 20 98 12 82 8 65"   stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <Path d="M 50 90  C 38 74 28 58 22 41"   stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <Path d="M 70 66  C 56 50 44 34 36 18"   stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <Path d="M 88 44  C 74 28 60 14 50 0"    stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" />

      {/* ── Secondary frond — offset, lighter ── */}
      <Path
        d="M 46 138 C 74 104 104 68 132 36"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity={0.55}
      />
      <Path d="M 64 120 C 80 108 96 92 102 76"  stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity={0.55} />
      <Path d="M 82 98  C 100 86 116 70 122 54" stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity={0.55} />
      <Path d="M 58 124 C 46 110 36 94 30 76"   stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity={0.55} />
      <Path d="M 76 102 C 62 86 50 70 42 52"    stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity={0.55} />
    </Svg>
  );
}
