const STORAGE_KEY = 'meu-campus.pf_repeat_sim';
const cache = new Map<string, boolean>();

function hasLocalStorage(): boolean {
    return typeof localStorage !== 'undefined';
}

function readCachedMap(raw: string | null): Record<string, boolean> {
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

export async function readPfRepeatSimulation(key: string): Promise<boolean> {
    if (cache.has(key)) return cache.get(key) ?? false;

    try {
        const raw = hasLocalStorage() ? localStorage.getItem(STORAGE_KEY) : await readNativeStoredMap();
        const value = readCachedMap(raw)[key] === true;
        cache.set(key, value);
        return value;
    } catch {
        return false;
    }
}

export async function writePfRepeatSimulation(key: string, value: boolean): Promise<void> {
    cache.set(key, value);

    try {
        const raw = hasLocalStorage() ? localStorage.getItem(STORAGE_KEY) : await readNativeStoredMap();
        const map = readCachedMap(raw);

        if (value) {
            map[key] = true;
        } else {
            delete map[key];
        }

        const serialized = JSON.stringify(map);

        if (hasLocalStorage()) {
            localStorage.setItem(STORAGE_KEY, serialized);
            return;
        }

        await writeNativeStoredMap(serialized);
    } catch {
        // The in-memory flag has already been updated; persistence can fail silently.
    }
}

async function readNativeStoredMap(): Promise<string | null> {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    return AsyncStorage.getItem(STORAGE_KEY);
}

async function writeNativeStoredMap(serialized: string): Promise<void> {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    await AsyncStorage.setItem(STORAGE_KEY, serialized);
}
