import React from "react";
import Svg, { Circle, Line } from "react-native-svg";

type Props = {
  size?: number;
  color?: string;
};

export default function StickFigureIcon({ size = 16, color = "#0891B2" }: Props) {
  const s = size;
  const cx = s / 2;
  const r = s * 0.18;
  const neckY = r * 2;
  const bodyTop = neckY + s * 0.02;
  const bodyBot = s * 0.64;
  const armY = s * 0.44;
  const legBotL = s * 0.98;
  const legBotR = s * 0.98;

  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Circle cx={cx} cy={r} r={r} fill={color} />
      <Line x1={cx} y1={bodyTop} x2={cx} y2={bodyBot} stroke={color} strokeWidth={s * 0.12} strokeLinecap="round" />
      <Line x1={cx - s * 0.28} y1={armY} x2={cx + s * 0.28} y2={armY} stroke={color} strokeWidth={s * 0.12} strokeLinecap="round" />
      <Line x1={cx} y1={bodyBot} x2={cx - s * 0.26} y2={legBotL} stroke={color} strokeWidth={s * 0.12} strokeLinecap="round" />
      <Line x1={cx} y1={bodyBot} x2={cx + s * 0.26} y2={legBotR} stroke={color} strokeWidth={s * 0.12} strokeLinecap="round" />
    </Svg>
  );
}
