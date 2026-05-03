import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useScrollToTop } from "@react-navigation/native";
import { useNavigation } from "expo-router";
import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  ActivityIndicator,
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

import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import PropertyCard from "@/components/PropertyCard";
import SearchBar from "@/components/SearchBar";
import SyncStatus from "@/components/SyncStatus";
import PropertyDetailSheet from "@/components/PropertyDetailSheet";
import { useProperties, useSyncInfo, useSyncProperties, type Property } from "@/hooks/useApi";

const ENTRANCE_IMAGE = require("../../assets/images/main-entrance.jpg");

const SUBDIVISION_NAME = "Palm Lakes Condominiums";

type SortMode = "number" | "street";

const STREET_ORDER = [
  "31ST ST E",
  "32ND ST E",
  "33RD ST E",
  "77TH DR E",
  "78TH AVE E",
  "79TH AVE E",
];

function getStreetName(address: string): string {
  return address.replace(/^\d+\s+/, "").toUpperCase().trim();
}

function sortByStreet(a: Property, b: Property): number {
  const streetA = getStreetName(a.address);
  const streetB = getStreetName(b.address);
  const idxA = STREET_ORDER.indexOf(streetA);
  const idxB = STREET_ORDER.indexOf(streetB);
  const orderA = idxA === -1 ? 999 : idxA;
  const orderB = idxB === -1 ? 999 : idxB;
  if (orderA !== orderB) return orderA - orderB;
  // Within same street: sort by house number numerically
  const numA = parseInt(a.address, 10) || 0;
  const numB = parseInt(b.address, 10) || 0;
  return numA - numB;
}

export default function DirectoryScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = Colors[isDark ? "dark" : "light"];
  const insets = useSafeAreaInsets();

  const listRef = useRef<FlatList>(null);
  useScrollToTop(listRef);
  const navigation = useNavigation();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

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

  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("street");

  const searchTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((text: string) => {
    setSearch(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setDebouncedSearch(text), 300);
  }, []);

  const { data, isLoading, refetch } = useProperties({
    search: debouncedSearch,
    page: 1,
    limit: 500,
  });

  const { data: syncInfo, refetch: refetchSync } = useSyncInfo();
  const syncMutation = useSyncProperties();

  const properties = data?.properties ?? [];
  const total = data?.total ?? 0;

  const sortedProperties = useMemo(() => {
    if (sortMode === "street") {
      return [...properties].sort(sortByStreet);
    }
    return properties;
  }, [properties, sortMode]);

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
              Resident Directory
            </Text>
            <View style={styles.headerSubtitleRow}>
              <Text style={[styles.headerSubtitle, { color: "rgba(255,255,255,0.80)", fontFamily: "Inter_400Regular" }]}>
                Sarasota, FL 34243{syncInfo?.count ? ` · ${syncInfo.count} units` : ""}
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
          placeholder="Search owners or addresses..."
        />
      </View>

      {!isLoading && (
        <View style={styles.resultsRow}>
          <Text style={[styles.resultsText, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
            {debouncedSearch ? `${total} result${total !== 1 ? "s" : ""} for "${debouncedSearch}"` : `${total} properties`}
          </Text>
          <View style={[styles.sortToggle, { backgroundColor: isDark ? theme.backgroundTertiary : theme.backgroundTertiary, borderColor: theme.separator }]}>
            <Pressable
              onPress={() => setSortMode("street")}
              style={[
                styles.sortPill,
                sortMode === "street" && { backgroundColor: theme.tint },
              ]}
            >
              <Feather name="align-left" size={11} color={sortMode === "street" ? "#fff" : theme.textMuted} />
              <Text style={[
                styles.sortPillText,
                { color: sortMode === "street" ? "#fff" : theme.textMuted, fontFamily: "Inter_500Medium" },
              ]}>
                Street
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSortMode("number")}
              style={[
                styles.sortPill,
                sortMode === "number" && { backgroundColor: theme.tint },
              ]}
            >
              <Feather name="hash" size={11} color={sortMode === "number" ? "#fff" : theme.textMuted} />
              <Text style={[
                styles.sortPillText,
                { color: sortMode === "number" ? "#fff" : theme.textMuted, fontFamily: "Inter_500Medium" },
              ]}>
                Number
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  ), [isDark, theme, syncInfo, syncMutation.isPending, search, debouncedSearch, total, isLoading, handleSync, handleSearchChange, sortMode, insets]);

  const renderItem = useCallback(
    ({ item }: { item: Property }) => (
      <PropertyCard
        property={item}
        onPress={setSelectedProperty}
        searchQuery={debouncedSearch}
      />
    ),
    [debouncedSearch]
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
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
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

      <PropertyDetailSheet
        property={selectedProperty}
        visible={!!selectedProperty}
        onClose={() => setSelectedProperty(null)}
      />
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  resultsText: {
    fontSize: 13,
  },
  sortToggle: {
    flexDirection: "row",
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
    gap: 2,
    padding: 2,
  },
  sortPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
  },
  sortPillText: {
    fontSize: 12,
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
});
