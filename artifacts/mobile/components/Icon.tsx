import React from "react";
import Svg, { Circle, Line, Path, Polyline, Rect } from "react-native-svg";
import type { StyleProp, ViewStyle } from "react-native";

export type IconName =
  | "align-left" | "alert-circle" | "check" | "chevron-right"
  | "grid" | "hash" | "home" | "info" | "map-pin" | "menu"
  | "refresh-cw" | "search" | "sliders" | "wifi-off" | "x";

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

const LC = "round" as const;
const LJ = "round" as const;

function s(color: string) {
  return { stroke: color, strokeWidth: 2, strokeLinecap: LC, strokeLinejoin: LJ, fill: "none" };
}

function renderPaths(name: IconName, color: string) {
  const p = s(color);
  switch (name) {
    case "menu":
      return <>
        <Line x1={3} y1={6} x2={21} y2={6} {...p} />
        <Line x1={3} y1={12} x2={21} y2={12} {...p} />
        <Line x1={3} y1={18} x2={21} y2={18} {...p} />
      </>;
    case "x":
      return <>
        <Line x1={18} y1={6} x2={6} y2={18} {...p} />
        <Line x1={6} y1={6} x2={18} y2={18} {...p} />
      </>;
    case "check":
      return <Polyline points="20 6 9 17 4 12" {...p} />;
    case "chevron-right":
      return <Polyline points="9 18 15 12 9 6" {...p} />;
    case "search":
      return <>
        <Circle cx={11} cy={11} r={8} {...p} />
        <Line x1={21} y1={21} x2={16.65} y2={16.65} {...p} />
      </>;
    case "home":
      return <>
        <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" {...p} />
        <Polyline points="9 22 9 12 15 12 15 22" {...p} />
      </>;
    case "map-pin":
      return <>
        <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" {...p} />
        <Circle cx={12} cy={10} r={3} {...p} />
      </>;
    case "sliders":
      return <>
        <Line x1={4} y1={21} x2={4} y2={14} {...p} />
        <Line x1={4} y1={10} x2={4} y2={3} {...p} />
        <Line x1={12} y1={21} x2={12} y2={12} {...p} />
        <Line x1={12} y1={8} x2={12} y2={3} {...p} />
        <Line x1={20} y1={21} x2={20} y2={16} {...p} />
        <Line x1={20} y1={12} x2={20} y2={3} {...p} />
        <Line x1={1} y1={14} x2={7} y2={14} {...p} />
        <Line x1={9} y1={8} x2={15} y2={8} {...p} />
        <Line x1={17} y1={16} x2={23} y2={16} {...p} />
      </>;
    case "align-left":
      return <>
        <Line x1={21} y1={6} x2={3} y2={6} {...p} />
        <Line x1={17} y1={10} x2={3} y2={10} {...p} />
        <Line x1={21} y1={14} x2={3} y2={14} {...p} />
        <Line x1={17} y1={18} x2={3} y2={18} {...p} />
      </>;
    case "hash":
      return <>
        <Line x1={4} y1={9} x2={20} y2={9} {...p} />
        <Line x1={4} y1={15} x2={20} y2={15} {...p} />
        <Line x1={10} y1={3} x2={8} y2={21} {...p} />
        <Line x1={16} y1={3} x2={14} y2={21} {...p} />
      </>;
    case "grid":
      return <>
        <Rect x={3} y={3} width={7} height={7} {...p} />
        <Rect x={14} y={3} width={7} height={7} {...p} />
        <Rect x={14} y={14} width={7} height={7} {...p} />
        <Rect x={3} y={14} width={7} height={7} {...p} />
      </>;
    case "refresh-cw":
      return <>
        <Polyline points="23 4 23 10 17 10" {...p} />
        <Polyline points="1 20 1 14 7 14" {...p} />
        <Path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" {...p} />
      </>;
    case "alert-circle":
      return <>
        <Circle cx={12} cy={12} r={10} {...p} />
        <Line x1={12} y1={8} x2={12} y2={12} {...p} />
        <Line x1={12} y1={16} x2={12.01} y2={16} {...p} />
      </>;
    case "wifi-off":
      return <>
        <Line x1={1} y1={1} x2={23} y2={23} {...p} />
        <Path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" {...p} />
        <Path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" {...p} />
        <Path d="M10.71 5.05A16 16 0 0 1 22.56 9" {...p} />
        <Path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" {...p} />
        <Path d="M8.53 16.11a6 6 0 0 1 6.95 0" {...p} />
        <Line x1={12} y1={20} x2={12.01} y2={20} {...p} />
      </>;
    case "info":
      return <>
        <Circle cx={12} cy={12} r={10} {...p} />
        <Line x1={12} y1={16} x2={12} y2={12} {...p} />
        <Line x1={12} y1={8} x2={12.01} y2={8} {...p} />
      </>;
    default:
      return null;
  }
}

export default function Icon({ name, size = 24, color = "#000", style }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style as any}>
      {renderPaths(name, color)}
    </Svg>
  );
}
