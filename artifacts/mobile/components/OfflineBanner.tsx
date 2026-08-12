import Icon from "./Icon";
import React, { useEffect, useRef } from "react";
import { Animated, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

const TAB_BAR_HEIGHT = 49;

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isOnline) {
      // Slide up and fade in when offline
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          friction: 8,
          tension: 60,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Slide down and fade out when back online
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 120,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOnline, translateY, opacity]);

  // Only render on web — native uses OS-level connectivity UI
  if (Platform.OS !== "web") return null;

  const bottomOffset = insets.bottom + TAB_BAR_HEIGHT + 12;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        { bottom: bottomOffset, opacity, transform: [{ translateY }] },
      ]}
    >
      <View style={styles.banner}>
        <Icon name="wifi-off" size={15} color="#FFE880" style={styles.icon} />
        <Text style={styles.text}>
          No connection — directory is available from cached data. Notes are
          stored on this device only.
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(7, 40, 56, 0.96)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255,232,128,0.25)",
    ...Platform.select({
      web: { boxShadow: "0px 4px 20px rgba(0,0,0,0.45)" } as any,
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
        elevation: 8,
      },
    }),
  },
  icon: {
    marginTop: 1,
    flexShrink: 0,
  },
  text: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: "#F0F4F8",
    fontFamily: "Inter_400Regular",
  },
});
