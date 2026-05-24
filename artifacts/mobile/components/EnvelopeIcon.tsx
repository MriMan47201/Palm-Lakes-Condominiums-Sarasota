import React from "react";
import Svg, { Path, Polyline } from "react-native-svg";

type Props = { size?: number; color?: string };

export default function EnvelopeIcon({ size = 14, color = "#0891B2" }: Props) {
  const s = size;
  const pad = s * 0.08;
  const top = s * 0.22;
  const bot = s * 0.78;
  const sw = s * 0.11;

  const left = pad;
  const right = s - pad;
  const midX = s / 2;
  const foldY = s * 0.52;

  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Path
        d={`M${left},${top} L${right},${top} L${right},${bot} L${left},${bot} Z`}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
      <Polyline
        points={`${left},${top} ${midX},${foldY} ${right},${top}`}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
