import Icon from "./Icon";
import React, { useCallback } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import Colors from "@/constants/colors";

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onBlur?: () => void;
};

export default function SearchBar({ value, onChangeText, placeholder = "Search by name or address...", onBlur }: Props) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = Colors[isDark ? "dark" : "light"];

  const handleBlur = useCallback(() => {
    if (Platform.OS === "web") {
      const viewport = document.querySelector("meta[name=viewport]") as HTMLMetaElement | null;
      if (viewport) {
        viewport.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1");
        setTimeout(() => {
          viewport.setAttribute("content", "width=device-width, initial-scale=1");
        }, 50);
      }
    }
    // Restore parent scroll position after keyboard dismisses
    onBlur?.();
  }, [onBlur]);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? theme.navyMid : theme.backgroundSecondary, borderColor: theme.separator }]}>
      <Icon name="search" size={16} color={theme.textMuted} style={styles.icon} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onBlur={handleBlur}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        style={[styles.input, { color: theme.text, fontFamily: "Inter_400Regular" }]}
        returnKeyType="search"
        clearButtonMode="while-editing"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => onChangeText("")}
          hitSlop={8}
          style={[styles.clearBtn, { backgroundColor: theme.textMuted + "33" }]}
        >
          <Icon name="x" size={12} color={theme.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    height: 44,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: "100%",
  },
  clearBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
  },
});
