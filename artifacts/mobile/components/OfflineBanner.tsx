import Icon from "./Icon";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

const TAB_BAR_HEIGHT = 49;
const SUPPRESS_MS = 10 * 60 * 1000; // 10 minutes

type Props = {
  /** Set to true the first time the user scrolls after the banner appeared. */
  scrolled?: boolean;
};

export default function OfflineBanner({ scrolled = false }: Props) {
  const isOnline = useOnlineStatus();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // Suppression: dismissed by scroll, auto-lifts after SUPPRESS_MS
  const [suppressed, setSuppressed] = useState(false);
  const suppressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dismiss + start 10-min timer when the user scrolls while banner is showing
  useEffect(() => {
    if (scrolled && !isOnline && !suppressed) {
      setSuppressed(true);
      if (suppressTimer.current) clearTimeout(suppressTimer.current);
      suppressTimer.current = setTimeout(() => setSuppressed(false), SUPPRESS_MS);
    }
  }, [scrolled, isOnline, suppressed]);

  // Clear suppression when connectivity is restored so it can reappear next offline period
  useEffect(() => {
    if (isOnline) {
      setSuppressed(false);
      if (suppressTimer.current) {
        clearTimeout(suppressTimer.current);
        suppressTimer.current = null;
      }
    }
  }, [isOnline]);

  // Clean up timer on unmount
  useEffect(() => () => {
    if (suppressTimer.current) clearTimeout(suppressTimer.current);
  }, []);

  const visible = !isOnline && !suppressed;

  useEffect(() => {
    if (visible) {
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
  }, [visible, translateY, opacity]);

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
          No connection — directory is available from cached data. Your notes
          are always kept on this device only and are never uploaded or shared.
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
