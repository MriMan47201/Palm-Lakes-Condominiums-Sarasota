import Icon from "./Icon";
import PalmFrondWatermark from "./PalmFrondWatermark";
import StickFigureIcon from "./StickFigureIcon";
import React from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import Colors from "@/constants/colors";
import type { Property } from "@/hooks/useApi";

type Props = {
  property: Property;
  onPress?: (property: Property) => void;
  searchQuery?: string;
  showUnit?: boolean;
  hasNote?: boolean;
};

function highlightText(text: string, query: string, style: object, highlightStyle: object) {
  if (!query || !text) return <Text style={style}>{text}</Text>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <Text style={style}>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <Text key={i} style={highlightStyle}>
            {part}
          </Text>
        ) : (
          part
        )
      )}
    </Text>
  );
}

export default function PropertyCard({ property, onPress, searchQuery = "", showUnit = false, hasNote = false }: Props) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = Colors[isDark ? "dark" : "light"];

  const addressParts = property.address.split(" ");
  const streetNumber = addressParts[0] || "";
  const streetName = addressParts.slice(1).join(" ") || "";

  // Frond color: slightly darker than card bg, same hue family
  const frondColor = isDark ? theme.navyLight + "60" : "#C8BDA8";

  return (
    <Pressable
      onPress={() => onPress?.(property)}
      style={({ pressed }) => [
        styles.card,
        Platform.select({
          web: { boxShadow: `0px 3px 12px ${theme.shadow}, 0px 1px 3px ${theme.shadow}` } as any,
          default: {
            shadowColor: theme.shadow,
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 1,
            shadowRadius: 12,
            elevation: 4,
          },
        }),
        {
          backgroundColor: theme.card,
          opacity: pressed ? 0.93 : 1,
          transform: [{ scale: pressed ? 0.984 : 1 }],
        },
      ]}
    >
      {/* Palm frond watermark — bottom-right decorative element */}
      <View style={styles.watermark} pointerEvents="none">
        <PalmFrondWatermark color={frondColor} size={115} />
      </View>

      <View style={[styles.accentBar, { backgroundColor: theme.tint }]} />

      <View style={styles.content}>
        {/* Address row */}
        <View style={styles.addressRow}>
          {/* Outlined teal badge matching reference design */}
          <View style={[
            styles.numberBadge,
            {
              borderColor: theme.tint,
              backgroundColor: isDark ? theme.tint + "22" : "transparent",
            },
          ]}>
            <Text style={[styles.numberText, { color: theme.tint, fontFamily: "Inter_700Bold" }]}>
              {streetNumber}
            </Text>
          </View>
          <View style={styles.addressInfo}>
            <View style={styles.streetNameRow}>
              {highlightText(
                streetName,
                searchQuery,
                [styles.streetName, { color: theme.text, fontFamily: "Inter_700Bold" }],
                { backgroundColor: theme.tint + "33", borderRadius: 2 }
              )}
              {showUnit && property.lotNumber && /^\d+$/.test(property.lotNumber.trim()) ? (
                <Text style={[styles.unitNumber, { fontFamily: "Inter_700Bold" }]}>
                  {property.lotNumber}
                </Text>
              ) : null}
            </View>
            <Text style={[styles.cityState, { color: theme.textSecondary, fontFamily: "Inter_400Regular" }]}>
              {[property.city, property.state, property.zipCode].filter(Boolean).join(", ") || "Sarasota, FL 34243"}
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.separator }]} />

        {/* Owner row */}
        <View style={styles.ownerRow}>
          <View style={[styles.ownerIcon, { backgroundColor: (isDark ? theme.tintLight : theme.tint) + "1E" }]}>
            <StickFigureIcon size={16} color={isDark ? theme.tintLight : theme.tint} />
          </View>
          {highlightText(
            property.ownerName,
            searchQuery,
            [styles.ownerName, { color: theme.text, fontFamily: "Inter_500Medium" }],
            { backgroundColor: theme.tint + "33", borderRadius: 2 }
          )}
        </View>

        {/* Value chips */}
        {(property.totalValue || property.landValue) ? (
          <View style={styles.valueRow}>
            {property.totalValue ? (
              <View style={styles.valueChip}>
                <Text style={[styles.valueLabel, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>Just Value</Text>
                <Text style={[styles.valueAmount, { color: theme.textSecondary, fontFamily: "Inter_600SemiBold" }]}>
                  ${Number(property.totalValue.replace(/[^0-9]/g, "")).toLocaleString()}
                </Text>
              </View>
            ) : null}
            {property.landValue ? (
              <View style={styles.valueChip}>
                <Text style={[styles.valueLabel, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>Land</Text>
                <Text style={[styles.valueAmount, { color: theme.textSecondary, fontFamily: "Inter_600SemiBold" }]}>
                  ${Number(property.landValue.replace(/[^0-9]/g, "")).toLocaleString()}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {hasNote && (
        <View style={styles.noteIndicator}>
          <Icon name="pencil" size={12} color={theme.tint} />
        </View>
      )}

      <View style={styles.arrow}>
        <Icon name="chevron-right" size={16} color={theme.textMuted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    marginHorizontal: 16,
    marginVertical: 5,
    flexDirection: "row",
    alignItems: "stretch",
    overflow: "hidden",
  },
  watermark: {
    position: "absolute",
    bottom: -12,
    right: 30,
    opacity: 0.85,
  },
  accentBar: {
    width: 4,
  },
  content: {
    flex: 1,
    padding: 14,
    gap: 8,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  numberBadge: {
    borderRadius: 9,
    borderWidth: 1.5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    minWidth: 50,
    alignItems: "center",
  },
  numberText: {
    fontSize: 18,
  },
  addressInfo: {
    flex: 1,
    gap: 2,
  },
  streetNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  streetName: {
    fontSize: 15,
    flex: 1,
    letterSpacing: 0.1,
  },
  cityState: {
    fontSize: 12,
  },
  divider: {
    height: 1,
  },
  ownerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ownerIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  ownerName: {
    fontSize: 14,
    flex: 1,
  },
  unitNumber: {
    fontSize: 14,
    color: "#CC2222",
    textAlign: "right",
  },
  valueRow: {
    flexDirection: "row",
    gap: 12,
  },
  valueChip: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
  },
  valueLabel: {
    fontSize: 11,
  },
  valueAmount: {
    fontSize: 12,
  },
  arrow: {
    paddingRight: 12,
    justifyContent: "center",
  },
  noteIndicator: {
    position: "absolute",
    bottom: 8,
    right: 38,
    opacity: 0.85,
  },
});
