import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
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

export default function PropertyCard({ property, onPress, searchQuery = "" }: Props) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = Colors[isDark ? "dark" : "light"];

  const addressParts = property.address.split(" ");
  const streetNumber = addressParts[0] || "";
  const streetName = addressParts.slice(1).join(" ") || "";

  return (
    <Pressable
      onPress={() => onPress?.(property)}
      style={({ pressed }) => [
        styles.card,
        Platform.select({
          web: { boxShadow: `0px 2px 8px ${theme.shadow}` } as any,
          default: {
            shadowColor: theme.shadow,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 1,
            shadowRadius: 8,
            elevation: 3,
          },
        }),
        {
          backgroundColor: theme.card,
          opacity: pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
      ]}
    >
      <View style={[styles.accentBar, { backgroundColor: theme.tint }]} />

      <View style={styles.content}>
        <View style={styles.addressRow}>
          <View style={[styles.numberBadge, { backgroundColor: isDark ? theme.navyMid : theme.backgroundTertiary }]}>
            <Text style={[styles.numberText, { color: theme.tint, fontFamily: "Inter_700Bold" }]}>
              {streetNumber}
            </Text>
          </View>
          <View style={styles.addressInfo}>
            {highlightText(
              streetName,
              searchQuery,
              [styles.streetName, { color: theme.text, fontFamily: "Inter_600SemiBold" }],
              { backgroundColor: theme.tint + "44", borderRadius: 2 }
            )}
            <Text style={[styles.cityState, { color: theme.textSecondary, fontFamily: "Inter_400Regular" }]}>
              {[property.city, property.state, property.zipCode].filter(Boolean).join(", ") || "Sarasota, FL 34243"}
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.separator }]} />

        <View style={styles.ownerRow}>
          <View style={[styles.ownerIcon, { backgroundColor: theme.tint + "22" }]}>
            <MaterialCommunityIcons name="human" size={16} color={theme.tint} />
          </View>
          {highlightText(
            property.ownerName,
            searchQuery,
            [styles.ownerName, { color: theme.text, fontFamily: "Inter_500Medium" }],
            { backgroundColor: theme.tint + "44", borderRadius: 2 }
          )}
        </View>

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

      <View style={styles.arrow}>
        <Feather name="chevron-right" size={16} color={theme.textMuted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 5,
    flexDirection: "row",
    alignItems: "stretch",
    overflow: "hidden",
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
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 44,
    alignItems: "center",
  },
  numberText: {
    fontSize: 16,
  },
  addressInfo: {
    flex: 1,
    gap: 2,
  },
  streetName: {
    fontSize: 15,
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
});
