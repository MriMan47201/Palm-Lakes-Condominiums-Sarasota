import Icon, { type IconName } from "@/components/Icon";
import { LinearGradient } from "expo-linear-gradient";
import { useScrollToTop } from "@react-navigation/native";
import { useFocusEffect, useNavigation } from "expo-router";
import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  ImageBackground,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  RefreshControl,
  Alert,
  Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Print from "expo-print";
import { jsPDF } from "jspdf";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import PropertyCard from "@/components/PropertyCard";
import SearchBar from "@/components/SearchBar";
import SyncStatus from "@/components/SyncStatus";
import PropertyDetailSheet from "@/components/PropertyDetailSheet";
import { useProperties, useSyncInfo, useSyncProperties, type Property } from "@/hooks/useApi";
import { useAllNotes } from "@/hooks/useNotes";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import OfflineBanner from "@/components/OfflineBanner";

// Alert.alert() is a no-op stub on the web target of react-native-web, so
// any Alert.alert() call silently does nothing there (no error, no popup).
// Route through window.alert on web so users actually see failure/info
// messages instead of the UI appearing to "do nothing".
const notify = (title: string, message?: string) => {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
};

const ENTRANCE_IMAGE = require("../../assets/images/main-entrance.jpg");
const APP_ICON = require("../../assets/images/icon.png");

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
  const savedScrollOffset = useRef(0);
  const [sheetScrollLocked, setSheetScrollLocked] = useState(false);
  const navigation = useNavigation();

  // ── Offline banner scroll-dismiss tracking ────────────────────────────────
  const isOnline = useOnlineStatus();
  const [bannerScrolled, setBannerScrolled] = useState(false);
  const scrolledWhileOffline = useRef(false);
  // Reset the scroll flag each time we transition to offline so the banner
  // gets a fresh chance to show before the user scrolls again.
  useEffect(() => {
    if (!isOnline) {
      scrolledWhileOffline.current = false;
      setBannerScrolled(false);
    }
  }, [isOnline]);

  const handleListScroll = useCallback((e: { nativeEvent: { contentOffset: { y: number } } }) => {
    savedScrollOffset.current = e.nativeEvent.contentOffset.y;
    // Signal the offline banner to dismiss on first scroll (fires once per offline period)
    if (!scrolledWhileOffline.current) {
      scrolledWhileOffline.current = true;
      setBannerScrolled(true);
    }
  }, []);

  const handlePropertyPress = useCallback((property: Property) => {
    setSheetScrollLocked(true);
    setSelectedProperty(property);
  }, []);

  // Called by onClose — restores the list to the scroll position saved at the
  // moment the user tapped the card. Fires multiple times to survive the iOS
  // keyboard-dismiss animation (≈350 ms) and any visual-viewport pan lag.
  const restoreListScroll = useCallback(() => {
    const doRestore = () => {
      listRef.current?.scrollToOffset({ offset: savedScrollOffset.current, animated: false });
      if (Platform.OS === "web") {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
        if (document.documentElement) document.documentElement.scrollTop = 0;
        if (document.body) document.body.scrollTop = 0;
      }
    };

    // Immediate: handles fast close when keyboard was never open
    doRestore();

    // ~350 ms: covers iOS keyboard dismiss animation
    const t1 = setTimeout(doRestore, 350);
    // 700 ms: belt-and-suspenders for slow devices
    const t2 = setTimeout(doRestore, 700);

    // Web: listen for visualViewport resize — the moment the keyboard is fully
    // gone, the viewport height snaps back up; that's the ideal time to restore.
    if (Platform.OS === "web" && typeof window !== "undefined" && window.visualViewport) {
      const vp = window.visualViewport!;
      const onVpResize = () => {
        doRestore();
        vp.removeEventListener("resize", onVpResize);
      };
      vp.addEventListener("resize", onVpResize);
      // Safety: remove the listener after 1 s even if it never fired
      setTimeout(() => vp.removeEventListener("resize", onVpResize), 1000);
    }

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Persistent keyboard-close detector for the main screen.
  // When the virtual keyboard dismisses on iOS PWA the visualViewport height
  // grows back. We treat any upward resize as "keyboard just closed" and snap
  // the list back to the saved offset — exactly like the notes fix, but always
  // active so it catches the search-bar keyboard too.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vp = window.visualViewport!;
    let lastHeight = vp.height;
    const onVpResize = () => {
      const h = vp.height;
      if (h > lastHeight) {
        // Viewport grew → keyboard went away → restore list position
        restoreListScroll();
      }
      lastHeight = h;
    };
    vp.addEventListener("resize", onVpResize);
    return () => vp.removeEventListener("resize", onVpResize);
  }, [restoreListScroll]);

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
      notify("No Notes", "You haven't saved any notes yet.");
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
        // Home-screen ("standalone") PWAs on iOS/Android have no browser
        // chrome, so window.print() silently does nothing there. The
        // reliable cross-context way to print is to hand a real PDF file
        // to the OS's native Share Sheet — it works even in standalone
        // mode, offers "Print" (AirPrint) as an option, and always
        // returns the user right back to the app whether they print,
        // save, or cancel.
        // NOTE: jsPDF is statically imported (not dynamically) so this
        // call happens with no network/await delay after the tap — iOS
        // Safari requires navigator.share() to run within a very short
        // "user activation" window after the click, and any await on a
        // lazy-loaded chunk fetch can silently expire that window,
        // causing navigator.share() to throw with no visible feedback.
        const doc = new jsPDF({ unit: "pt", format: "letter" });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const marginX = 48;
        let y = 56;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text("Palm Lakes Condominiums", marginX, y);
        y += 20;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(90);
        doc.text(
          `Property Notes — ${withNotes.length} note${withNotes.length !== 1 ? "s" : ""}`,
          marginX,
          y
        );
        y += 20;
        doc.setDrawColor(210);
        doc.line(marginX, y, pageWidth - marginX, y);
        y += 20;
        doc.setTextColor(20);

        const ensureSpace = (needed: number) => {
          if (y + needed > pageHeight - 48) {
            doc.addPage();
            y = 56;
          }
        };

        withNotes.forEach((p) => {
          const owner = p.ownerName || "—";
          const noteLines = doc.splitTextToSize(allNotes[p.address], pageWidth - marginX * 2);

          ensureSpace(20);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(12);
          doc.setTextColor(20);
          doc.text(owner, marginX, y);
          y += 16;

          ensureSpace(14);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          doc.setTextColor(90);
          doc.text(p.address, marginX, y);
          y += 16;

          ensureSpace(noteLines.length * 13);
          doc.setFontSize(11);
          doc.setTextColor(30);
          doc.text(noteLines, marginX, y);
          y += noteLines.length * 13 + 10;

          ensureSpace(14);
          doc.setDrawColor(230);
          doc.line(marginX, y, pageWidth - marginX, y);
          y += 18;
        });

        const pdfBlob: Blob = doc.output("blob");

        const nav: any = typeof navigator !== "undefined" ? navigator : null;
        const canShareFiles =
          nav &&
          typeof nav.share === "function" &&
          typeof nav.canShare === "function" &&
          typeof File !== "undefined";

        if (canShareFiles) {
          const file = new File([pdfBlob], "palm-lakes-notes.pdf", { type: "application/pdf" });
          if (nav.canShare({ files: [file] })) {
            try {
              await nav.share({
                files: [file],
                title: "Palm Lakes Condominiums — Property Notes",
              });
            } catch (shareErr: any) {
              if (shareErr?.name !== "AbortError") throw shareErr;
            }
            return;
          }
        }

        // Fallback (desktop browsers without file sharing, or plain
        // browser tabs): print directly from a hidden iframe.
        const existing = document.getElementById("plc-print-frame");
        if (existing) existing.remove();

        const iframe = document.createElement("iframe");
        iframe.id = "plc-print-frame";
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "0";
        iframe.style.visibility = "hidden";
        document.body.appendChild(iframe);

        const cleanup = () => {
          iframe.contentWindow?.removeEventListener("afterprint", cleanup);
          if (iframe.parentNode) iframe.remove();
        };

        const frameDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!frameDoc) {
          cleanup();
          notify("Print Failed", "Could not open the print dialog. Please try again.");
          return;
        }
        frameDoc.open();
        frameDoc.write(html);
        frameDoc.close();

        const triggerPrint = () => {
          const win = iframe.contentWindow;
          if (!win) {
            cleanup();
            return;
          }
          win.addEventListener("afterprint", cleanup);
          win.focus();
          win.print();
          setTimeout(cleanup, 60000);
        };

        if (frameDoc.readyState === "complete") {
          triggerPrint();
        } else {
          iframe.addEventListener("load", triggerPrint);
        }
      } else {
        await Print.printAsync({ html });
      }
    } catch {
      notify("Print Failed", "Could not open the print dialog. Please try again.");
    }
  }, [allProperties, allNotes]);

  const handleOpenInstructions = useCallback(() => {
    const instructionsUrl =
      Platform.OS === "web" && typeof window !== "undefined"
        ? new URL("/Instructions.pdf", window.location.origin).toString()
        : "https://plcdirectory.netlify.app/Instructions.pdf";

    Linking.openURL(instructionsUrl).catch(() => {
      notify("Unable to Open Instructions", "Please try again.");
    });
  }, []);

  const handleSync = useCallback(async () => {
    try {
      const result = await syncMutation.mutateAsync();
      if (result.success) {
        notify("Sync Complete", `Successfully loaded ${result.count} properties.`);
      } else {
        notify("Sync Status", result.message || "Could not fetch live data. Please try again later.");
      }
    } catch {
      notify("Sync Failed", "Please check your connection and try again.");
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
          colors={["transparent", "rgba(12,56,53,0.55)", "rgba(12,56,53,0.92)"]}
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
                v1.2
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
          onBlur={restoreListScroll}
        />
      </View>

      <View style={[styles.sortBar, { backgroundColor: theme.tint, borderColor: theme.tint }]}>
        <Icon name="sliders" size={13} color="rgba(255,255,255,0.85)" />
        <Text style={[styles.sortBarLabel, { color: "rgba(255,255,255,0.75)", fontFamily: "Inter_400Regular" }]}>
          Sort:
        </Text>
        <Text style={[styles.sortBarValue, { color: "#fff", fontFamily: "Inter_700Bold" }]}>
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
        onPress={handlePropertyPress}
        searchQuery={debouncedSearch}
        showUnit={sortMode === "unit"}
        hasNote={!!allNotes[item.address]}
      />
    ),
    [handlePropertyPress, debouncedSearch, sortMode, allNotes]
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
    <View style={[styles.container, { backgroundColor: theme.background, paddingBottom: Platform.OS === "web" ? 72 : 0 }]}>
      <FlatList
        ref={listRef}
        data={sortedProperties}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={EmptyState}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={Platform.OS === "web"}
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
        scrollEnabled={!sheetScrollLocked}
        onScroll={handleListScroll}
        scrollEventThrottle={16}
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
        onClose={() => {
          setSelectedProperty(null);
          setSheetScrollLocked(false);
          reloadNotes();
          resetViewportZoom();
          restoreListScroll();
        }}
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
                backgroundColor: isDark ? theme.backgroundSecondary : "#F5F0E8",
                borderLeftColor: theme.separator,
                paddingTop: stableTop + 16,
              },
              { transform: [{ translateX: panelTranslate }] },
            ]}
          >
            {/* Compact menu header: recognizable app mark + close control */}
            <View style={styles.menuCloseRow}>
              <Image
                source={APP_ICON}
                style={styles.menuAppIcon}
                accessibilityLabel="Palm Lakes app icon"
              />
              <Pressable onPress={closeMenu} style={styles.menuClose} hitSlop={12}>
                <Icon name="x" size={22} color={theme.textMuted} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.menuScroll}
              contentContainerStyle={{ paddingBottom: insets.bottom + 64 }}
              contentInsetAdjustmentBehavior="never"
              bounces={false}
              alwaysBounceVertical={false}
              overScrollMode="never"
              showsVerticalScrollIndicator={Platform.OS === "web"}
              keyboardShouldPersistTaps="handled"
            >

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

            {/* ── HELP section ── */}
            <View style={[styles.menuSectionDivider, { backgroundColor: theme.separator }]} />
            <Text style={[styles.menuSectionLabel, { color: theme.tint, fontFamily: "Inter_700Bold" }]}>
              Help
            </Text>

            <View style={styles.menuOptions}>
              <Pressable
                onPress={() => { closeMenu(); handleOpenInstructions(); }}
                style={({ pressed }) => [
                  styles.menuOption,
                  {
                    backgroundColor: pressed ? theme.backgroundTertiary : "transparent",
                    borderColor: "transparent",
                  },
                ]}
              >
                <View style={[styles.menuOptionIcon, { backgroundColor: theme.backgroundTertiary }]}>
                  <Icon name="info" size={14} color={theme.textMuted} />
                </View>
                <View style={styles.menuOptionText}>
                  <Text style={[
                    styles.menuOptionLabel,
                    { color: theme.text, fontFamily: "Inter_600SemiBold" },
                  ]}>
                    Instructions
                  </Text>
                  <Text style={[styles.menuOptionSub, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
                    How to use the Owner Directory
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
                Steven Low  ·  © 2026
              </Text>
              <Text style={[styles.menuAboutLine, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
                • Public data sourced from Manatee County GIS
              </Text>
              <Text style={[styles.menuAboutLine, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
                • Your notes are saved locally, never shared.
              </Text>
            </View>
            </ScrollView>
          </Animated.View>
        </View>
      )}

      <OfflineBanner scrolled={bannerScrolled} />
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
  menuScroll: {
    flex: 1,
    minHeight: 0,
    ...Platform.select({
      web: {
        overflowY: "auto",
        overflowX: "hidden",
        scrollbarWidth: "auto",
        overscrollBehaviorY: "none",
        overscrollBehaviorX: "none",
        touchAction: "pan-y",
      } as any,
      default: {},
    }),
  },
  menuCloseRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  menuAppIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
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
