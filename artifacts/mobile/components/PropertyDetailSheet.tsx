import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import type { Property } from "@/hooks/useApi";

type Props = {
  property: Property | null;
  visible: boolean;
  onClose: () => void;
};

function DetailRow({ label, value, icon }: { label: string; value: string | null | undefined; icon: string }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = Colors[isDark ? "dark" : "light"];

  if (!value) return null;

  return (
    <View style={[styles.detailRow, { borderBottomColor: theme.separator }]}>
      <View style={[styles.detailIcon, { backgroundColor: theme.tint + "18" }]}>
        <Feather name={icon as "home"} size={14} color={theme.tint} />
      </View>
      <View style={styles.detailContent}>
        <Text style={[styles.detailLabel, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
          {label}
        </Text>
        <Text style={[styles.detailValue, { color: theme.text, fontFamily: "Inter_500Medium" }]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export default function PropertyDetailSheet({ property, visible, onClose }: Props) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = Colors[isDark ? "dark" : "light"];
  const insets = useSafeAreaInsets();

  if (!property) return null;

  const mailingIsDifferent =
    property.mailingAddress &&
    !property.mailingAddress.trim().toUpperCase().startsWith(property.address.trim().toUpperCase());

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.backgroundSecondary,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: theme.separator }]} />

          <View style={styles.header}>
            <View style={styles.headerInfo}>
              <Text style={[styles.headerAddress, { color: theme.text, fontFamily: "Inter_700Bold" }]}>
                {property.address}
              </Text>
              <Text style={[styles.headerCity, { color: theme.textSecondary, fontFamily: "Inter_400Regular" }]}>
                {[property.city, property.state, property.zipCode].filter(Boolean).join(", ") || "Sarasota, FL 34243"}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: isDark ? theme.navyMid : theme.backgroundTertiary }]}
              hitSlop={8}
            >
              <Feather name="x" size={18} color={theme.text} />
            </Pressable>
          </View>

          <View style={[styles.sectionDivider, { backgroundColor: theme.separator }]} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <Text style={[styles.sectionTitle, { color: theme.textMuted, fontFamily: "Inter_600SemiBold" }]}>
              PROPERTY DETAILS
            </Text>

            <View style={[styles.detailsCard, { backgroundColor: isDark ? theme.navyMid : theme.backgroundTertiary, borderColor: theme.separator }]}>
              <DetailRow label="Owner" value={property.ownerName} icon="user" />
              <DetailRow label="Parcel ID" value={property.parcelId} icon="hash" />
              {mailingIsDifferent && (
                <DetailRow label="Mailing Address" value={property.mailingAddress} icon="mail" />
              )}
            </View>

            {(property.landValue || property.totalValue) ? (
              <>
                <Text style={[styles.sectionTitle, { color: theme.textMuted, fontFamily: "Inter_600SemiBold", marginTop: 20 }]}>
                  JUST VALUES (MARKET)
                </Text>
                <View style={styles.valuesRow}>
                  {property.totalValue ? (
                    <View style={[styles.valueCard, { backgroundColor: theme.tint + "18", borderColor: theme.tint + "44" }]}>
                      <Feather name="home" size={18} color={theme.tint} />
                      <Text style={[styles.valueCardLabel, { color: theme.textSecondary, fontFamily: "Inter_400Regular" }]}>
                        Just Value
                      </Text>
                      <Text style={[styles.valueCardAmount, { color: theme.text, fontFamily: "Inter_700Bold" }]}>
                        ${Number(property.totalValue.replace(/[^0-9]/g, "")).toLocaleString()}
                      </Text>
                    </View>
                  ) : null}
                  {property.landValue ? (
                    <View style={[styles.valueCard, { backgroundColor: theme.tint + "18", borderColor: theme.tint + "44" }]}>
                      <Feather name="layers" size={18} color={theme.tint} />
                      <Text style={[styles.valueCardLabel, { color: theme.textSecondary, fontFamily: "Inter_400Regular" }]}>
                        Land Value
                      </Text>
                      <Text style={[styles.valueCardAmount, { color: theme.text, fontFamily: "Inter_700Bold" }]}>
                        ${Number(property.landValue.replace(/[^0-9]/g, "")).toLocaleString()}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </>
            ) : null}

            <Text style={[styles.footer, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
              Data sourced from Public Manatee County GIS
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerInfo: {
    flex: 1,
    marginRight: 12,
  },
  headerAddress: {
    fontSize: 20,
    lineHeight: 26,
  },
  headerCity: {
    fontSize: 14,
    marginTop: 3,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionDivider: {
    height: 1,
    marginHorizontal: 0,
  },
  scrollContent: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  detailsCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  detailIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
  },
  valuesRow: {
    flexDirection: "row",
    gap: 12,
  },
  valueCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 6,
    alignItems: "flex-start",
  },
  valueCardLabel: {
    fontSize: 12,
  },
  valueCardAmount: {
    fontSize: 18,
  },
  footer: {
    fontSize: 11,
    textAlign: "center",
    marginTop: 24,
  },
});
