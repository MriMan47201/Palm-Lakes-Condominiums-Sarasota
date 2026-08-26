import Icon from "./Icon";
import React from "react";
import { Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import Colors from "@/constants/colors";
import type { SyncInfo } from "@/hooks/useApi";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

type Props = {
  syncInfo?: SyncInfo;
  isSyncing: boolean;
  onSync: () => void;
};

const MIN_SYNC_AGE_MS = 4 * 60 * 60 * 1000;

function formatTimeAgo(isoDate: string | null): string {
  if (!isoDate) return "Never";
  const diff = Date.now() - new Date(isoDate).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatCooldownRemaining(isoDate: string): string {
  const elapsed = Date.now() - new Date(isoDate).getTime();
  const remaining = Math.max(0, MIN_SYNC_AGE_MS - elapsed);
  const h = Math.floor(remaining / (1000 * 60 * 60));
  const m = Math.ceil((remaining % (1000 * 60 * 60)) / (1000 * 60));
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function SyncStatus({ syncInfo, isSyncing, onSync }: Props) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = Colors[isDark ? "dark" : "light"];

  const lastSyncAt = syncInfo?.lastSyncAt ?? null;
  const lastSyncText = formatTimeAgo(lastSyncAt);
  const rawCount = syncInfo?.count ?? 0;
  // Subtract the 2 HOA-owned properties (Clubhouse + Lift Station)
  const count = rawCount > 2 ? rawCount - 2 : rawCount;

  const isOnline = useOnlineStatus();

  const tooRecent = lastSyncAt
    ? Date.now() - new Date(lastSyncAt).getTime() < MIN_SYNC_AGE_MS
    : false;
  const syncDisabled = isSyncing || tooRecent || !isOnline;

  return (
    <View style={[styles.container, { backgroundColor: isDark ? theme.navyMid : theme.backgroundSecondary, borderColor: theme.separator }]}>
      <View style={styles.info}>
        <View style={[styles.dot, { backgroundColor: count > 0 ? theme.success : theme.textMuted }]} />
        <View>
          <Text style={[styles.countText, { color: theme.text, fontFamily: "Inter_600SemiBold" }]}>
            {count > 0 ? `${count} units` : "No data loaded"}
          </Text>
          <Text style={[styles.syncText, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
            Data updated {lastSyncText}
          </Text>
        </View>
      </View>

      {!syncDisabled && (
        <Pressable
          onPress={onSync}
          style={({ pressed }) => [
            styles.syncBtn,
            { backgroundColor: theme.tint + (pressed ? "CC" : "FF") },
          ]}
        >
          <Icon name="refresh-cw" size={14} color="#fff" />
          <Text style={[styles.syncBtnText, { fontFamily: "Inter_600SemiBold" }]}>
            Sync Now
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  info: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  countText: {
    fontSize: 14,
  },
  syncText: {
    fontSize: 11,
    marginTop: 1,
  },
  syncBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  syncBtnText: {
    color: "#fff",
    fontSize: 13,
  },
});
