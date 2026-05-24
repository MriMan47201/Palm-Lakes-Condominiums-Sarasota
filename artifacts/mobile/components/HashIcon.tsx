import React from "react";
import Svg, { Line } from "react-native-svg";

type Props = { size?: number; color?: string };

export default function HashIcon({ size = 14, color = "#0891B2" }: Props) {
  const s = size;
  const sw = s * 0.12;
  const pad = s * 0.18;
  const r1 = s * 0.35;
  const r2 = s * 0.65;
  const tilt = s * 0.12;

  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Line x1={r1 - tilt} y1={pad} x2={r1 + tilt} y2={s - pad} stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <Line x1={r2 - tilt} y1={pad} x2={r2 + tilt} y2={s - pad} stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <Line x1={pad} y1={r1} x2={s - pad} y2={r1} stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <Line x1={pad} y1={r2} x2={s - pad} y2={r2} stroke={color} strokeWidth={sw} strokeLinecap="round" />
    </Svg>
  );
}
