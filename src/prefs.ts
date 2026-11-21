/**
 * Display preferences (language). They are NOT secret and are
 * needed before the vault is unlocked (lock screen, setup), so they live in a
 * small JSON file in the app's private storage, read synchronously at start-up.
 * Nothing about documents is ever written here.
 */
import { File, Paths } from 'expo-file-system';

export type Prefs = { language?: string };

let cache: Prefs | null = null;

function file(): File | null {
  try {
    return new File(Paths.document, 'docsave-prefs.json');
  } catch {
    return null;
  }
}

export function readPrefs(): Prefs {
  if (cache) return cache;
  cache = {};
  try {
    const f = file();
    if (f?.exists) {
      const parsed = JSON.parse(f.textSync());
      if (parsed && typeof parsed === 'object') cache = parsed as Prefs;
    }
  } catch {
    cache = {};
  }
  return cache;
}

export function writePrefs(patch: Partial<Prefs>): void {
  cache = { ...readPrefs(), ...patch };
  try {
    const f = file();
    if (!f) return;
    if (!f.exists) f.create();
    f.writeSync(JSON.stringify(cache));
  } catch {
    // preference simply not persisted
  }
}
