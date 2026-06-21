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

  // On iOS: completely hide the tab bar while the keyboard is visible,
  // then restore it once the keyboard is fully gone — avoids all inset jitter.
  const [kbVisible, setKbVisible] = useState(false);

  useEffect(() => {
    if (!isIOS) return;
    const willShow = Keyboard.addListener("keyboardWillShow", () => setKbVisible(true));
    const didHide  = Keyboard.addListener("keyboardDidHide",  () => setKbVisible(false));
    return () => { willShow.remove(); didHide.remove(); };
  }, [isIOS]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.tint,
        tabBarInactiveTintColor: theme.tabIconDefault,
        headerShown: false,
        tabBarStyle: isIOS && kbVisible ? { display: "none" } : {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : isDark ? "#0F1B2E" : "#fff",
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: theme.separator,
          elevation: 0,
          paddingBottom: isWeb ? 16 : safeAreaInsets.bottom,
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
