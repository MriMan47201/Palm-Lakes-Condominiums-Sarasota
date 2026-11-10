import AsyncStorage from "@react-native-async-storage/async-storage";

export const NOTES_PREFIX = "plc_note_";
export const NOTES_BACKUP_FORMAT = "palm-lakes-owner-notes";
export const NOTES_BACKUP_VERSION = 1;
export const MAX_NOTES_BACKUP_BYTES = 2_000_000;

const MAX_BACKUP_ENTRIES = 1_000;
const MAX_ADDRESS_LENGTH = 256;
const MAX_NOTE_LENGTH = 288;

export type SavedNote = {
  address: string;
  note: string;
};

export type NotesImportSummary = {
  added: number;
  conflicts: number;
  unchanged: number;
};

export class NotesBackupFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotesBackupFormatError";
  }
}

export async function readSavedNotes(): Promise<SavedNote[]> {
  const keys = (await AsyncStorage.getAllKeys())
    .filter((key) => key.startsWith(NOTES_PREFIX))
    .sort();
  if (keys.length === 0) return [];

  const pairs = await AsyncStorage.multiGet(keys);
  return pairs
    .flatMap(([key, value]) => {
      const address = key.slice(NOTES_PREFIX.length);
      if (!address || !value?.trim()) return [];
      return [{ address, note: value }];
    })
    .sort((a, b) => a.address.localeCompare(b.address));
}

export function serializeNotesBackup(
  notes: SavedNote[],
  exportedAt = new Date().toISOString()
): string {
  return JSON.stringify(
    {
      format: NOTES_BACKUP_FORMAT,
      version: NOTES_BACKUP_VERSION,
      exportedAt,
      notes,
    },
    null,
    2
  );
}

export function parseNotesBackup(contents: string): SavedNote[] {
  if (contents.length > MAX_NOTES_BACKUP_BYTES) {
    throw new NotesBackupFormatError("This notes file is too large to import.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new NotesBackupFormatError("This is not a valid JSON notes file.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new NotesBackupFormatError("This is not a Palm Lakes notes backup.");
  }

  const backup = parsed as Record<string, unknown>;
  if (
    backup.format !== NOTES_BACKUP_FORMAT ||
    backup.version !== NOTES_BACKUP_VERSION ||
    typeof backup.exportedAt !== "string" ||
    !Number.isFinite(Date.parse(backup.exportedAt)) ||
    !Array.isArray(backup.notes)
  ) {
    throw new NotesBackupFormatError(
      "This file isn't a supported Palm Lakes notes backup."
    );
  }
  if (backup.notes.length > MAX_BACKUP_ENTRIES) {
    throw new NotesBackupFormatError(
      "This notes file contains too many entries to import."
    );
  }

  const seenAddresses = new Set<string>();
  return backup.notes.map((entry: unknown) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new NotesBackupFormatError("A note entry in this file is invalid.");
    }

    const record = entry as Record<string, unknown>;
    if (typeof record.address !== "string" || typeof record.note !== "string") {
      throw new NotesBackupFormatError("A note entry in this file is invalid.");
    }

    const address = record.address.trim();
    const note = record.note;
    if (
      address.length === 0 ||
      address.length > MAX_ADDRESS_LENGTH ||
      /[\u0000-\u001f]/.test(address) ||
      note.trim().length === 0 ||
      note.length > MAX_NOTE_LENGTH
    ) {
      throw new NotesBackupFormatError(
        "A note entry has an invalid address or note length."
      );
    }
    if (seenAddresses.has(address)) {
      throw new NotesBackupFormatError(
        "This file contains more than one note for the same address."
      );
    }

    seenAddresses.add(address);
    return { address, note };
  });
}

function summarizeImport(
  current: Map<string, string>,
  incoming: SavedNote[]
): NotesImportSummary {
  const summary: NotesImportSummary = { added: 0, conflicts: 0, unchanged: 0 };
  for (const entry of incoming) {
    const existing = current.get(entry.address);
    if (existing === undefined) {
      summary.added += 1;
    } else if (existing === entry.note) {
      summary.unchanged += 1;
    } else {
      summary.conflicts += 1;
    }
  }
  return summary;
}

async function readSavedNoteMap(): Promise<Map<string, string>> {
  return new Map((await readSavedNotes()).map(({ address, note }) => [address, note]));
}

export async function previewNotesImport(
  incoming: SavedNote[]
): Promise<NotesImportSummary> {
  return summarizeImport(await readSavedNoteMap(), incoming);
}

export async function importNotesKeepingExisting(
  incoming: SavedNote[]
): Promise<NotesImportSummary> {
  const current = await readSavedNoteMap();
  const summary = summarizeImport(current, incoming);
  const writes: [string, string][] = [];

  for (const entry of incoming) {
    if (current.has(entry.address)) continue;
    writes.push([NOTES_PREFIX + entry.address, entry.note]);
  }

  if (writes.length > 0) {
    await AsyncStorage.multiSet(writes);
  }
  return summary;
}
