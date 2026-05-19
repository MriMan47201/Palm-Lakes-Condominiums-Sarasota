import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect, useCallback } from "react";

const NOTES_PREFIX = "plc_note_";

export function useNote(parcelId: string) {
  const key = NOTES_PREFIX + parcelId;
  const [note, setNote] = useState<string>("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(key).then((val) => {
      setNote(val ?? "");
      setLoaded(true);
    });
  }, [key]);

  const saveNote = useCallback(
    async (text: string) => {
      const trimmed = text.slice(0, 288);
      await AsyncStorage.setItem(key, trimmed);
      setNote(trimmed);
    },
    [key]
  );

  return { note, saveNote, loaded };
}

export function useAllNotes() {
  const [notes, setNotes] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    try {
      const keys = (await AsyncStorage.getAllKeys()) as string[];
      const noteKeys = keys.filter((k) => k.startsWith(NOTES_PREFIX));
      if (noteKeys.length === 0) {
        setNotes({});
        return;
      }
      const pairs = await AsyncStorage.multiGet(noteKeys);
      const map: Record<string, string> = {};
      for (const [key, val] of pairs) {
        if (val) map[key.replace(NOTES_PREFIX, "")] = val;
      }
      setNotes(map);
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { notes, reload };
}
