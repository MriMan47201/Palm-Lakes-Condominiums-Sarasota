import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { Keyboard, Platform, StyleSheet, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const safeAreaInsets = useSafeAreaInsets();
  const theme = Colors[isDark ? "dark" : "light"];

  // Only ever adopt a LARGER bottom inset during normal rendering —
  // prevents the keyboard shrinking safeAreaInsets.bottom from collapsing the tab bar.
  const maxBottom = useRef(safeAreaInsets.bottom);
  const [stableBottom, setStableBottom] = useState(safeAreaInsets.bottom);
  const liveBottom = useRef(safeAreaInsets.bottom);

  useEffect(() => {
    liveBottom.current = safeAreaInsets.bottom;
    if (safeAreaInsets.bottom > maxBottom.current) {
      maxBottom.current = safeAreaInsets.bottom;
      setStableBottom(safeAreaInsets.bottom);
    }
  }, [safeAreaInsets.bottom]);

  // Self-repair: once the keyboard is fully gone the OS restores the real inset.
  // Force-read it and reset so the tab bar always ends up at the correct height.
  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidHide", () => {
      setTimeout(() => {
        const real = liveBottom.current;
        maxBottom.current = real;
        setStableBottom(real);
      }, 80);
    });
    return () => sub.remove();
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.tint,
        tabBarInactiveTintColor: theme.tabIconDefault,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : isDark ? "#0F1B2E" : "#fff",
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: theme.separator,
          elevation: 0,
          paddingBottom: isWeb ? 16 : stableBottom,
          ...(isWeb ? { height: 72 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: isDark ? "#0F1B2E" : "#fff" },
              ]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Directory",
          headerShown: false,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="house" tintColor={color} size={24} />
            ) : (
              <Feather name="home" size={22} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}
