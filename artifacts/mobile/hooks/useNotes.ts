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
