import Icon, { type IconName } from "@/components/Icon";
import { LinearGradient } from "expo-linear-gradient";
import { useScrollToTop } from "@react-navigation/native";
import { useFocusEffect, useNavigation } from "expo-router";
import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  ImageBackground,
  Keyboard,
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
import * as Print from "expo-print";

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

function sortByNumber(a: Property, b: Property): number {
  return (parseInt(a.address, 10) || 0) - (parseInt(b.address, 10) || 0);
}

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

const SORT_OPTIONS: { mode: SortMode; icon: IconName; label: string; sub: string }[] = [
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

  // Only ever adopt a LARGER top inset during normal rendering —
  // prevents any keyboard-related inset shrinkage from moving the hamburger up.
  const maxTop = useRef(insets.top);
  const [stableTop, setStableTop] = useState(insets.top);
  const liveTop = useRef(insets.top);

  useEffect(() => {
    liveTop.current = insets.top;
    if (insets.top > maxTop.current) {
      maxTop.current = insets.top;
      setStableTop(insets.top);
    }
  }, [insets.top]);

  // Self-repair: once the keyboard is fully gone the OS restores the real inset.
  // Only ever adopt a LARGER value — never reset downward, which would shift the hamburger up.
  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidHide", () => {
      setTimeout(() => {
        const real = liveTop.current;
        if (real > maxTop.current) {
          maxTop.current = real;
          setStableTop(real);
        }
      }, 80);
    });
    return () => sub.remove();
  }, []);

  useFocusEffect(useCallback(() => {
    resetViewportZoom();
    Keyboard.dismiss();
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

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      return allProperties.filter((p) => !!allNotes[p.address]);
    }
    return allProperties.filter(
      (p) =>
        p.address.toLowerCase().includes(q) ||
        (p.ownerName && p.ownerName.toLowerCase().includes(q)) ||
        (allNotes[p.address] && allNotes[p.address].toLowerCase().includes(q))
    );
  }, [allProperties, debouncedSearch, allNotes]);

  const total = filteredProperties.length;

  const sortedProperties = useMemo(() => {
    switch (sortMode) {
      case "street1": return [...filteredProperties].sort(sortByStreet1);
      case "street2": return [...filteredProperties].sort(sortByStreet2);
      case "number":  return [...filteredProperties].sort(sortByNumber);
      case "unit":    return [...filteredProperties].sort(sortByUnit);
      default:        return filteredProperties;
    }
  }, [filteredProperties, sortMode]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([refetch(), refetchSync()]);
    setIsRefreshing(false);
  }, [refetch, refetchSync]);

  const handlePrintNotes = useCallback(async () => {
    const withNotes = allProperties.filter((p) => !!allNotes[p.address]?.trim());
    if (withNotes.length === 0) {
      Alert.alert("No Notes", "You haven't saved any notes yet.");
      return;
    }
    const escapeHtml = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const rows = withNotes
      .map((p) => {
        const owner = escapeHtml(p.ownerName || "—");
        const address = escapeHtml(p.address);
        const note = escapeHtml(allNotes[p.address]).replace(/\n/g, "<br/>");
        return `
          <div class="entry">
            <div class="owner">${owner}</div>
            <div class="address">${address}</div>
            <div class="note">${note}</div>
          </div>`;
      })
      .join("\n");
    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1a1a1a; padding: 24px; }
            h1 { font-size: 18px; margin-bottom: 4px; }
            .subtitle { font-size: 12px; color: #666; margin-bottom: 20px; }
            .entry { padding: 12px 0; border-bottom: 1px solid #ddd; }
            .owner { font-size: 14px; font-weight: 700; }
            .address { font-size: 13px; color: #444; margin-top: 2px; }
            .note { font-size: 13px; margin-top: 6px; white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <h1>Palm Lakes Condominiums — Property Notes</h1>
          <div class="subtitle">${withNotes.length} note${withNotes.length !== 1 ? "s" : ""}</div>
          ${rows}
        </body>
      </html>`;
    try {
      if (Platform.OS === "web") {
        const printWindow = window.open("", "_blank");
        if (!printWindow) {
          Alert.alert(
            "Pop-up Blocked",
            "Please allow pop-ups for this site to print your notes."
          );
          return;
        }
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        const triggerPrint = () => {
          printWindow.print();
        };
        if (printWindow.document.readyState === "complete") {
          triggerPrint();
        } else {
          printWindow.addEventListener("load", triggerPrint);
        }
      } else {
        await Print.printAsync({ html });
      }
    } catch {
      Alert.alert("Print Failed", "Could not open the print dialog. Please try again.");
    }
  }, [allProperties, allNotes]);

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
          style={[styles.headerOverlay, { paddingTop: stableTop + 24 }]}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerTop}>
              <Icon name="map-pin" size={18} color="#FFD94A" />
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
                v1.1
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

      <View style={[styles.sortBar, { backgroundColor: theme.tint + "18", borderColor: theme.tint + "40" }]}>
        <Icon name="sliders" size={13} color={theme.tint} />
        <Text style={[styles.sortBarLabel, { color: theme.textSecondary, fontFamily: "Inter_400Regular" }]}>
          Sort:
        </Text>
        <Text style={[styles.sortBarValue, { color: theme.tint, fontFamily: "Inter_700Bold" }]}>
          {SORT_OPTIONS.find((o) => o.mode === sortMode)?.label ?? ""}
        </Text>
      </View>

      {!isLoading && debouncedSearch ? (
        <View style={styles.resultsRow}>
          <Text style={[styles.resultsText, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
            {`${total} result${total !== 1 ? "s" : ""} for "${debouncedSearch}"`}
          </Text>
        </View>
      ) : null}
    </View>
  ), [isDark, theme, syncInfo, syncMutation.isPending, search, debouncedSearch, total, isLoading, handleSync, handleSearchChange, stableTop, sortMode]);

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
          <Icon name="search" size={40} color={theme.textMuted} />
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
        <Icon name="home" size={48} color={theme.textMuted} />
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
        style={[styles.hamburgerBtn, { top: stableTop + 22 }]}
      >
        <View style={styles.hamburgerInner}>
          <Icon name="menu" size={24} color="#fff" />
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
                paddingTop: stableTop + 16,
                paddingBottom: insets.bottom + 24,
              },
              { transform: [{ translateX: panelTranslate }] },
            ]}
          >
            {/* Close row */}
            <View style={styles.menuCloseRow}>
              <Pressable onPress={closeMenu} style={styles.menuClose} hitSlop={12}>
                <Icon name="x" size={22} color={theme.textMuted} />
              </Pressable>
            </View>

            {/* ── SORT BY section ── */}
            <View style={[styles.menuDivider, { backgroundColor: theme.separator }]} />
            <Text style={[styles.menuSectionLabel, { color: theme.tint, fontFamily: "Inter_700Bold" }]}>
              Sort By
            </Text>

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
                      <Icon
                        name={opt.icon}
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
                      <Icon name="check" size={16} color={theme.tint} />
                    )}
                  </Pressable>
                );
              })}
            </View>

            {/* ── NOTES section ── */}
            <View style={[styles.menuSectionDivider, { backgroundColor: theme.separator }]} />
            <Text style={[styles.menuSectionLabel, { color: theme.tint, fontFamily: "Inter_700Bold" }]}>
              Notes
            </Text>

            <View style={styles.menuOptions}>
              <Pressable
                onPress={() => { closeMenu(); handlePrintNotes(); }}
                style={({ pressed }) => [
                  styles.menuOption,
                  {
                    backgroundColor: pressed ? theme.backgroundTertiary : "transparent",
                    borderColor: "transparent",
                  },
                ]}
              >
                <View style={[styles.menuOptionIcon, { backgroundColor: theme.backgroundTertiary }]}>
                  <Icon name="printer" size={14} color={theme.textMuted} />
                </View>
                <View style={styles.menuOptionText}>
                  <Text style={[
                    styles.menuOptionLabel,
                    { color: theme.text, fontFamily: "Inter_600SemiBold" },
                  ]}>
                    Print all saved notes
                  </Text>
                </View>
              </Pressable>
            </View>

            {/* ── ABOUT section ── */}
            <View style={[styles.menuSectionDivider, { backgroundColor: theme.separator }]} />
            <Text style={[styles.menuSectionLabel, { color: theme.tint, fontFamily: "Inter_700Bold" }]}>
              About
            </Text>

            <View style={styles.menuAbout}>
              <Text style={[styles.menuAboutLine, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
                Steven Low
              </Text>
              <Text style={[styles.menuAboutLine, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
                © 2026
              </Text>
              <Text style={[styles.menuAboutLine, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
                Public data sourced from Manatee County GIS
              </Text>
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
    borderRadius: 24,
    overflow: "hidden",
  },
  hamburgerInner: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 24,
  },
  sortBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  sortBarLabel: {
    fontSize: 13,
  },
  sortBarValue: {
    fontSize: 13,
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
  menuCloseRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  menuClose: {
    padding: 6,
  },
  menuSectionLabel: {
    fontSize: 16,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 8,
  },
  menuDivider: {
    height: 1,
    marginHorizontal: 20,
  },
  menuSectionDivider: {
    height: 2,
    marginHorizontal: 0,
    marginTop: 16,
    opacity: 0.45,
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
  menuAbout: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
    gap: 5,
  },
  menuAboutLine: {
    fontSize: 13,
    lineHeight: 19,
  },
});
