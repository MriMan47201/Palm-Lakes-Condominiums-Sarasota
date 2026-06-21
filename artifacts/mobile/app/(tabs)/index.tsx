import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useScrollToTop } from "@react-navigation/native";
import { useFocusEffect, useNavigation } from "expo-router";
import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  ImageBackground,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  RefreshControl,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import PropertyCard from "@/components/PropertyCard";
import SearchBar from "@/components/SearchBar";
import SyncStatus from "@/components/SyncStatus";
import PropertyDetailSheet from "@/components/PropertyDetailSheet";
import { useProperties, useSyncInfo, useSyncProperties, type Property } from "@/hooks/useApi";
import { useAllNotes } from "@/hooks/useNotes";

const ENTRANCE_IMAGE = require("../../assets/images/main-entrance.jpg");

const SUBDIVISION_NAME = "Palm Lakes Condominiums";
const SORT_STORAGE_KEY = "plc_sort_mode_v2";

export type SortMode = "street1" | "street2" | "number" | "unit";

const STREET1_ORDER = [
  "31ST ST E",
  "32ND ST E",
  "33RD ST E",
  "77TH DR E",
  "78TH AVE E",
  "79TH AVE E",
];

const STREET2_ORDER = [
  "77TH DR E",
  "78TH AVE E",
  "79TH AVE E",
  "31ST ST E",
  "32ND ST E",
  "33RD ST E",
];

function getStreetName(address: string): string {
  return address.replace(/^\d+\s+/, "").toUpperCase().trim();
}

function makeSortByStreet(order: string[]) {
  return (a: Property, b: Property): number => {
    const streetA = getStreetName(a.address);
    const streetB = getStreetName(b.address);
    const idxA = order.indexOf(streetA);
    const idxB = order.indexOf(streetB);
    const oA = idxA === -1 ? 999 : idxA;
    const oB = idxB === -1 ? 999 : idxB;
    if (oA !== oB) return oA - oB;
    const numA = parseInt(a.address, 10) || 0;
    const numB = parseInt(b.address, 10) || 0;
    return numA - numB;
  };
}

const sortByStreet1 = makeSortByStreet(STREET1_ORDER);
const sortByStreet2 = makeSortByStreet(STREET2_ORDER);

function sortByUnit(a: Property, b: Property): number {
  const numA = parseInt(a.lotNumber ?? "", 10);
  const numB = parseInt(b.lotNumber ?? "", 10);
  const vA = !isNaN(numA);
  const vB = !isNaN(numB);
  if (vA && vB) return numA - numB;
  if (vA) return -1;
  if (vB) return 1;
  return 0;
}

function resetViewportZoom() {
  if (Platform.OS !== "web") return;
  const viewport = document.querySelector("meta[name=viewport]") as HTMLMetaElement | null;
  if (!viewport) return;
  viewport.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1");
  setTimeout(() => {
    viewport.setAttribute("content", "width=device-width, initial-scale=1");
  }, 50);
}

const SORT_OPTIONS: { mode: SortMode; icon: string; label: string; sub: string }[] = [
  { mode: "street1", icon: "align-left",  label: "Street 1", sub: "31st · 32nd · 33rd · 77th · 78th · 79th" },
  { mode: "street2", icon: "align-left",  label: "Street 2", sub: "77th · 78th · 79th · 31st · 32nd · 33rd" },
  { mode: "number",  icon: "hash",        label: "Number",   sub: "By house number" },
  { mode: "unit",    icon: "grid",        label: "Unit",     sub: "By unit number" },
];

export default function DirectoryScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = Colors[isDark ? "dark" : "light"];
  const insets = useSafeAreaInsets();

  useFocusEffect(useCallback(() => {
    resetViewportZoom();
  }, []));

  const listRef = useRef<FlatList>(null);
  useScrollToTop(listRef);
  const navigation = useNavigation();

  useEffect(() => {
    const unsubscribe = navigation.addListener("tabPress" as never, () => {
      setSearch("");
      setDebouncedSearch("");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          listRef.current?.scrollToOffset({ animated: true, offset: 0 });
        });
      });
    });
    return unsubscribe;
  }, [navigation]);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("street1");
  const [menuVisible, setMenuVisible] = useState(false);

  const menuAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem(SORT_STORAGE_KEY).then((val) => {
      if (val && ["street1", "street2", "number", "unit"].includes(val)) {
        setSortMode(val as SortMode);
      }
    });
  }, []);

  const openMenu = useCallback(() => {
    setMenuVisible(true);
    Animated.timing(menuAnim, {
      toValue: 1,
      duration: 260,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [menuAnim]);

  const closeMenu = useCallback(() => {
    Animated.timing(menuAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: Platform.OS !== "web",
    }).start(() => setMenuVisible(false));
  }, [menuAnim]);

  const changeSortMode = useCallback((mode: SortMode) => {
    setSortMode(mode);
    AsyncStorage.setItem(SORT_STORAGE_KEY, mode);
    closeMenu();
  }, [closeMenu]);

  const searchTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = useCallback((text: string) => {
    setSearch(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setDebouncedSearch(text), 300);
  }, []);

  const { data, isLoading, refetch } = useProperties({ page: 1, limit: 500 });
  const { data: syncInfo, refetch: refetchSync } = useSyncInfo();
  const syncMutation = useSyncProperties();
  const { notes: allNotes, reload: reloadNotes } = useAllNotes();

  const allProperties = data?.properties ?? [];

  const filteredProperties = useMemo(() => {
    if (!debouncedSearch) return allProperties;
    const q = debouncedSearch.toLowerCase().trim();
    if (q === "notes") {
      return allProperties.filter((p) => !!allNotes[p.id.toString()]);
    }
    return allProperties.filter(
      (p) =>
        p.address.toLowerCase().includes(q) ||
        (p.ownerName && p.ownerName.toLowerCase().includes(q)) ||
        (allNotes[p.id.toString()] && allNotes[p.id.toString()].toLowerCase().includes(q))
    );
  }, [allProperties, debouncedSearch, allNotes]);

  const total = filteredProperties.length;

  const sortedProperties = useMemo(() => {
    switch (sortMode) {
      case "street1": return [...filteredProperties].sort(sortByStreet1);
      case "street2": return [...filteredProperties].sort(sortByStreet2);
      case "unit":    return [...filteredProperties].sort(sortByUnit);
      default:        return filteredProperties;
    }
  }, [filteredProperties, sortMode]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([refetch(), refetchSync()]);
    setIsRefreshing(false);
  }, [refetch, refetchSync]);

  const handleSync = useCallback(async () => {
    try {
      const result = await syncMutation.mutateAsync();
      if (result.success) {
        Alert.alert("Sync Complete", `Successfully loaded ${result.count} properties.`);
      } else {
        Alert.alert(
          "Sync Status",
          result.message || "Could not fetch live data. Please try again later.",
          [{ text: "OK" }]
        );
      }
    } catch {
      Alert.alert("Sync Failed", "Please check your connection and try again.");
    }
  }, [syncMutation]);

  const ListHeader = useMemo(() => (
    <View>
      <ImageBackground
        source={ENTRANCE_IMAGE}
        style={styles.headerBanner}
        resizeMode="cover"
      >
        <LinearGradient
          colors={["transparent", "rgba(7,59,76,0.55)", "rgba(7,59,76,0.88)"]}
          locations={[0.0, 0.5, 1.0]}
          style={[styles.headerOverlay, { paddingTop: insets.top + 24 }]}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerTop}>
              <Feather name="map-pin" size={18} color="#FFD94A" />
              <Text style={[styles.subdivisionLabel, { color: "#FFE880", fontFamily: "Inter_700Bold" }, Platform.select({ web: { textShadow: "0px 0px 4px rgba(0,0,0,0.95)" } as any, default: { textShadowColor: "rgba(0,0,0,0.95)", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4 } })]}>
                {SUBDIVISION_NAME}
              </Text>
            </View>
            <Text style={[styles.headerTitle, { color: "#FFFFFF", fontFamily: "Inter_700Bold" }]}>
              Owner Directory
            </Text>
            <View style={styles.headerSubtitleRow}>
              <Text style={[styles.headerSubtitle, { color: "rgba(255,255,255,0.80)", fontFamily: "Inter_400Regular" }]}>
                Sarasota, FL 34243
              </Text>
              <Text style={[styles.headerSubtitle, { color: "rgba(255,255,255,0.80)", fontFamily: "Inter_400Regular" }]}>
                v1.0
              </Text>
            </View>
          </View>
        </LinearGradient>
      </ImageBackground>

      <SyncStatus
        syncInfo={syncInfo}
        isSyncing={syncMutation.isPending}
        onSync={handleSync}
      />

      <View style={styles.searchContainer}>
        <SearchBar
          value={search}
          onChangeText={handleSearchChange}
          placeholder="Search owners, addresses, or notes..."
        />
      </View>

      {!isLoading && debouncedSearch ? (
        <View style={styles.resultsRow}>
          <Text style={[styles.resultsText, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
            {`${total} result${total !== 1 ? "s" : ""} for "${debouncedSearch}"`}
          </Text>
        </View>
      ) : null}
    </View>
  ), [isDark, theme, syncInfo, syncMutation.isPending, search, debouncedSearch, total, isLoading, handleSync, handleSearchChange, insets]);

  const renderItem = useCallback(
    ({ item }: { item: Property }) => (
      <PropertyCard
        property={item}
        onPress={setSelectedProperty}
        searchQuery={debouncedSearch}
        showUnit={sortMode === "unit"}
      />
    ),
    [debouncedSearch, sortMode]
  );

  const EmptyState = useCallback(() => {
    if (isLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.tint} />
          <Text style={[styles.loadingText, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
            Loading properties...
          </Text>
        </View>
      );
    }
    if (debouncedSearch) {
      return (
        <View style={styles.centered}>
          <Feather name="search" size={40} color={theme.textMuted} />
          <Text style={[styles.emptyTitle, { color: theme.text, fontFamily: "Inter_600SemiBold" }]}>
            No results found
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
            No properties match "{debouncedSearch}"
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.centered}>
        <Feather name="home" size={48} color={theme.textMuted} />
        <Text style={[styles.emptyTitle, { color: theme.text, fontFamily: "Inter_600SemiBold" }]}>
          No properties yet
        </Text>
        <Text style={[styles.emptySubtitle, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
          Tap "Sync Now" to load your subdivision's property data from Manatee County GIS
        </Text>
      </View>
    );
  }, [isLoading, debouncedSearch, theme]);

  const panelTranslate = menuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });
  const backdropOpacity = menuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const sortLabel = SORT_OPTIONS.find((o) => o.mode === sortMode)?.label ?? "Sort";

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        ref={listRef}
        data={sortedProperties}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={EmptyState}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.tint}
          />
        }
        scrollsToTop
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      />

      <Pressable
        onPress={openMenu}
        style={[styles.hamburgerBtn, { top: insets.top + 10 }]}
      >
        <View style={styles.hamburgerInner}>
          <Feather name="menu" size={20} color="#fff" />
          <Text style={styles.hamburgerLabel}>{sortLabel}</Text>
        </View>
      </Pressable>

      <PropertyDetailSheet
        property={selectedProperty}
        visible={!!selectedProperty}
        onClose={() => { setSelectedProperty(null); reloadNotes(); resetViewportZoom(); }}
      />

      {menuVisible && (
        <View style={[StyleSheet.absoluteFillObject, { pointerEvents: "box-none" } as any]}>
          <Animated.View
            style={[StyleSheet.absoluteFillObject, { opacity: backdropOpacity }]}
          >
            <Pressable style={StyleSheet.absoluteFillObject} onPress={closeMenu}>
              <View style={[StyleSheet.absoluteFillObject, styles.menuBackdrop]} />
            </Pressable>
          </Animated.View>

          <Animated.View
            style={[
              styles.menuPanel,
              {
                backgroundColor: isDark ? theme.backgroundSecondary : "#FFFAF4",
                borderLeftColor: theme.separator,
                paddingTop: insets.top + 16,
                paddingBottom: insets.bottom + 24,
              },
              { transform: [{ translateX: panelTranslate }] },
            ]}
          >
            <View style={styles.menuHeader}>
              <Text style={[styles.menuTitle, { color: theme.text, fontFamily: "Inter_700Bold" }]}>
                Sort By
              </Text>
              <Pressable onPress={closeMenu} style={styles.menuClose} hitSlop={10}>
                <Feather name="x" size={22} color={theme.textMuted} />
              </Pressable>
            </View>

            <View style={[styles.menuDivider, { backgroundColor: theme.separator }]} />

            <View style={styles.menuOptions}>
              {SORT_OPTIONS.map((opt) => {
                const active = sortMode === opt.mode;
                return (
                  <Pressable
                    key={opt.mode}
                    onPress={() => changeSortMode(opt.mode)}
                    style={({ pressed }) => [
                      styles.menuOption,
                      {
                        backgroundColor: active
                          ? theme.tint + "18"
                          : pressed
                          ? theme.backgroundTertiary
                          : "transparent",
                        borderColor: active ? theme.tint + "55" : "transparent",
                      },
                    ]}
                  >
                    <View style={[styles.menuOptionIcon, { backgroundColor: active ? theme.tint : theme.backgroundTertiary }]}>
                      <Feather
                        name={opt.icon as any}
                        size={14}
                        color={active ? "#fff" : theme.textMuted}
                      />
                    </View>
                    <View style={styles.menuOptionText}>
                      <Text style={[
                        styles.menuOptionLabel,
                        { color: active ? theme.tint : theme.text, fontFamily: active ? "Inter_700Bold" : "Inter_600SemiBold" },
                      ]}>
                        {opt.label}
                      </Text>
                      <Text style={[styles.menuOptionSub, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
                        {opt.sub}
                      </Text>
                    </View>
                    {active && (
                      <Feather name="check" size={16} color={theme.tint} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 32,
  },
  headerBanner: {
    height: 240,
  },
  headerOverlay: {
    flex: 1,
    paddingBottom: 28,
    paddingHorizontal: 20,
    justifyContent: "flex-end",
  },
  headerContent: {
    gap: 4,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  subdivisionLabel: {
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: 0.3,
  },
  headerTitle: {
    fontSize: 19,
    lineHeight: 25,
    marginLeft: 24,
  },
  headerSubtitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    marginLeft: 24,
  },
  headerSubtitle: {
    fontSize: 13,
  },
  searchContainer: {
    marginTop: 4,
    marginBottom: 4,
  },
  resultsRow: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  resultsText: {
    fontSize: 13,
  },
  centered: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 18,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  hamburgerBtn: {
    position: "absolute",
    right: 14,
    borderRadius: 20,
    overflow: "hidden",
  },
  hamburgerInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: "rgba(0,0,0,0.38)",
    borderRadius: 20,
  },
  hamburgerLabel: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  menuBackdrop: {
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  menuPanel: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: 290,
    borderLeftWidth: 1,
    ...Platform.select({
      web: { boxShadow: "-4px 0 24px rgba(0,0,0,0.18)" } as any,
      default: {
        shadowColor: "#000",
        shadowOffset: { width: -3, height: 0 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
        elevation: 16,
      },
    }),
  },
  menuHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  menuTitle: {
    fontSize: 20,
  },
  menuClose: {
    padding: 4,
  },
  menuDivider: {
    height: 1,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  menuOptions: {
    paddingHorizontal: 12,
    gap: 4,
  },
  menuOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  menuOptionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  menuOptionText: {
    flex: 1,
    gap: 2,
  },
  menuOptionLabel: {
    fontSize: 15,
  },
  menuOptionSub: {
    fontSize: 11,
    lineHeight: 14,
  },
});
