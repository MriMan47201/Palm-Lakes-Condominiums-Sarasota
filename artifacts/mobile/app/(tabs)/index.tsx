import { Feather } from "@expo/vector-icons";
import { useScrollToTop } from "@react-navigation/native";
import React, { useState, useCallback, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
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

const SUBDIVISION_NAME = "Palm Lakes";

export default function DirectoryScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = Colors[isDark ? "dark" : "light"];
  const insets = useSafeAreaInsets();

  const listRef = useRef<FlatList>(null);
  useScrollToTop(listRef);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
      <View style={[styles.headerBanner, { backgroundColor: isDark ? theme.navy : theme.navy }]}>
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <Feather name="map-pin" size={18} color={theme.tint} />
            <Text style={[styles.subdivisionLabel, { color: theme.tint, fontFamily: "Inter_500Medium" }]}>
              {SUBDIVISION_NAME}
            </Text>
          </View>
          <Text style={[styles.headerTitle, { color: "#FFFFFF", fontFamily: "Inter_700Bold" }]}>
            Resident Directory
          </Text>
          <Text style={[styles.headerSubtitle, { color: "rgba(255,255,255,0.6)", fontFamily: "Inter_400Regular" }]}>
            Sarasota, FL 34243{syncInfo?.count ? ` · ${syncInfo.count} units` : ""}
          </Text>
        </View>
      </View>

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
        </View>
      )}
    </View>
  ), [isDark, theme, syncInfo, syncMutation.isPending, search, debouncedSearch, total, isLoading, handleSync, handleSearchChange]);

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
        data={properties}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={EmptyState}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.tint}
          />
        }
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
    paddingTop: 24,
    paddingBottom: 28,
    paddingHorizontal: 20,
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
    fontSize: 13,
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 28,
    lineHeight: 34,
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  searchContainer: {
    marginTop: 4,
    marginBottom: 4,
  },
  resultsRow: {
    paddingHorizontal: 20,
    paddingVertical: 8,
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
});
