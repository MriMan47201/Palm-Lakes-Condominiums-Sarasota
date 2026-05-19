import { Feather } from "@expo/vector-icons";
import React, { useState, useEffect } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import type { Property } from "@/hooks/useApi";
import { useNote } from "@/hooks/useNotes";

type Props = {
  property: Property | null;
  visible: boolean;
  onClose: () => void;
};

function DetailRow({ label, value, icon }: { label: string; value: string | null | undefined; icon: string }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = Colors[isDark ? "dark" : "light"];

  if (!value) return null;

  return (
    <View style={[styles.detailRow, { borderBottomColor: theme.separator }]}>
      <View style={[styles.detailIcon, { backgroundColor: theme.tint + "18" }]}>
        <Feather name={icon as "home"} size={14} color={theme.tint} />
      </View>
      <View style={styles.detailContent}>
        <Text style={[styles.detailLabel, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
          {label}
        </Text>
        <Text style={[styles.detailValue, { color: theme.text, fontFamily: "Inter_500Medium" }]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function NotesSection({ parcelId, theme, isDark }: { parcelId: string; theme: any; isDark: boolean }) {
  const { note, saveNote, loaded } = useNote(parcelId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (editing) {
      setDraft(note);
      setDirty(false);
    }
  }, [editing, note]);

  const handleChange = (text: string) => {
    setDraft(text.slice(0, 288));
    setDirty(true);
  };

  const handleSave = async () => {
    await saveNote(draft);
    setDirty(false);
    setEditing(false);
  };

  const handleClose = () => {
    setEditing(false);
  };

  const inputBg = isDark ? theme.navyMid : theme.backgroundTertiary;
  const borderColor = theme.separator;

  return (
    <>
      <Text style={[styles.sectionTitle, { color: theme.textMuted, fontFamily: "Inter_600SemiBold", marginTop: 20 }]}>
        NOTES
      </Text>

      <Pressable
        onPress={() => setEditing(true)}
        style={[styles.notesPreview, { backgroundColor: inputBg, borderColor }]}
      >
        <View style={styles.notesPreviewInner}>
          <Feather name="edit-3" size={13} color={theme.textMuted} style={styles.notesIcon} />
          {loaded && note.length > 0 ? (
            <Text
              style={[styles.notesPreviewText, { color: theme.text, fontFamily: "Inter_400Regular" }]}
              numberOfLines={3}
            >
              {note}
            </Text>
          ) : (
            <>
              <Text style={[styles.notesPlaceholder, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
                Tap to add a note…
              </Text>
              <Text style={[styles.notesPlaceholder, { color: "transparent", fontFamily: "Inter_400Regular" }]}>{"\n\n"}</Text>
            </>
          )}
        </View>
      </Pressable>

      <Modal visible={editing} animationType="slide" transparent onRequestClose={handleClose}>
        <KeyboardAvoidingView
          style={styles.noteModalOuter}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable style={styles.noteModalBackdrop} onPress={handleClose} />
          <View style={[styles.noteModal, { backgroundColor: isDark ? "#0F1B2E" : "#fff", borderColor: theme.separator }]}>
            <View style={styles.noteModalHeader}>
              <Text style={[styles.noteModalTitle, { color: theme.text, fontFamily: "Inter_700Bold" }]}>
                Notes
              </Text>
              <Text style={[styles.noteModalCount, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
                {draft.length}/288
              </Text>
            </View>

            <TextInput
              style={[
                styles.noteInput,
                {
                  color: theme.text,
                  backgroundColor: inputBg,
                  borderColor,
                  fontFamily: "Inter_400Regular",
                },
              ]}
              value={draft}
              onChangeText={handleChange}
              multiline
              maxLength={288}
              placeholder="Write your note here…"
              placeholderTextColor={theme.textMuted}
              autoFocus
              scrollEnabled
              textAlignVertical="top"
            />

            <View style={styles.noteModalActions}>
              <Pressable
                onPress={handleClose}
                style={[styles.noteBtn, { backgroundColor: isDark ? theme.navyMid : theme.backgroundTertiary, borderColor: theme.separator }]}
              >
                <Text style={[styles.noteBtnText, { color: theme.text, fontFamily: "Inter_500Medium" }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                style={[styles.noteBtn, styles.noteBtnPrimary, { backgroundColor: dirty ? theme.tint : theme.tint + "66" }]}
              >
                <Feather name="save" size={14} color="#fff" />
                <Text style={[styles.noteBtnText, { color: "#fff", fontFamily: "Inter_600SemiBold" }]}>Save</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

export default function PropertyDetailSheet({ property, visible, onClose }: Props) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = Colors[isDark ? "dark" : "light"];
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  if (!property) return null;

  const mailingIsDifferent =
    property.mailingAddress &&
    !property.mailingAddress.trim().toUpperCase().startsWith(property.address.trim().toUpperCase());

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              width: screenWidth,
              backgroundColor: theme.backgroundSecondary,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: theme.separator }]} />

          <View style={styles.header}>
            <View style={styles.headerInfo}>
              <Text style={[styles.headerAddress, { color: theme.text, fontFamily: "Inter_700Bold" }]}>
                {property.address}
              </Text>
              {property.lotNumber && /^\d+$/.test(property.lotNumber.trim()) ? (
                <Text style={[styles.headerUnit, { fontFamily: "Inter_400Regular" }]}>
                  Unit No. {property.lotNumber.trim()}
                </Text>
              ) : null}
              <Text style={[styles.headerCity, { color: theme.textSecondary, fontFamily: "Inter_400Regular" }]}>
                {[property.city, property.state, property.zipCode].filter(Boolean).join(", ") || "Sarasota, FL 34243"}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: isDark ? theme.navyMid : theme.backgroundTertiary }]}
              hitSlop={8}
            >
              <Feather name="x" size={18} color={theme.text} />
            </Pressable>
          </View>

          <View style={[styles.sectionDivider, { backgroundColor: theme.separator }]} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <Text style={[styles.sectionTitle, { color: theme.textMuted, fontFamily: "Inter_600SemiBold" }]}>
              PROPERTY DETAILS
            </Text>

            <View style={[styles.detailsCard, { backgroundColor: isDark ? theme.navyMid : theme.backgroundTertiary, borderColor: theme.separator }]}>
              <DetailRow label="Owner" value={property.ownerName} icon="user" />
              <DetailRow label="Parcel ID" value={property.parcelId} icon="hash" />
              {mailingIsDifferent && (
                <DetailRow label="Mailing Address" value={property.mailingAddress} icon="mail" />
              )}
            </View>

            <NotesSection parcelId={property.parcelId} theme={theme} isDark={isDark} />

            <Text style={[styles.footer, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>
              Public data sourced from Manatee County GIS
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "stretch",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerInfo: {
    flex: 1,
    marginRight: 12,
  },
  headerAddress: {
    fontSize: 20,
    lineHeight: 26,
  },
  headerUnit: {
    fontSize: 14,
    marginTop: 2,
    color: "#E53935",
  },
  headerCity: {
    fontSize: 14,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionDivider: {
    height: 1,
    marginHorizontal: 0,
  },
  scrollContent: {
    padding: 24,
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  detailsCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  detailIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
  },
  notesPreview: {
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 72,
    padding: 12,
  },
  notesPreviewInner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  notesIcon: {
    marginTop: 2,
  },
  notesPreviewText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
  },
  notesPlaceholder: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    fontStyle: "italic",
  },
  footer: {
    fontSize: 11,
    textAlign: "center",
    marginTop: 24,
  },
  noteModalOuter: {
    flex: 1,
    justifyContent: "flex-end",
  },
  noteModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  noteModal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: 24,
    gap: 16,
  },
  noteModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  noteModalTitle: {
    fontSize: 17,
  },
  noteModalCount: {
    fontSize: 12,
  },
  noteInput: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 120,
    maxHeight: 200,
  },
  noteModalActions: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "flex-end",
  },
  noteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  noteBtnPrimary: {
    borderWidth: 0,
  },
  noteBtnText: {
    fontSize: 14,
  },
});
