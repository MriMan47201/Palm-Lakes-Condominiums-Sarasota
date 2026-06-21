import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect, useCallback } from "react";

const NOTES_PREFIX = "plc_note_";

export function useNote(key: string, legacyKey?: string) {
  const storageKey = NOTES_PREFIX + key;
  const legacyStorageKey = legacyKey ? NOTES_PREFIX + legacyKey : null;
  const [note, setNote] = useState<string>("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const val = await AsyncStorage.getItem(storageKey);
      if (val !== null) {
        setNote(val);
        setLoaded(true);
        return;
      }
      if (legacyStorageKey) {
        const legacyVal = await AsyncStorage.getItem(legacyStorageKey);
        if (legacyVal !== null) {
          await AsyncStorage.setItem(storageKey, legacyVal);
          await AsyncStorage.removeItem(legacyStorageKey);
          setNote(legacyVal);
          setLoaded(true);
          return;
        }
      }
      setNote("");
      setLoaded(true);
    })();
  }, [storageKey, legacyStorageKey]);

  const saveNote = useCallback(
    async (text: string) => {
      const trimmed = text.slice(0, 288);
      await AsyncStorage.setItem(storageKey, trimmed);
      setNote(trimmed);
    },
    [storageKey]
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
