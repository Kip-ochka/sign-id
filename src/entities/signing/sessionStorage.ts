export const sessionStorageKey = 'digital_id_sign_session';
export const sessionTtl = 115 * 60 * 1000;

type SessionEntry = { id: string; expiresAt: number };

export function createSessionStorage(
    getStorage: () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = () => window.localStorage,
) {
    let memory: SessionEntry | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let memoryOnly = false;

    function clear() {
        clearTimeout(timer);
        timer = undefined;
        memory = undefined;
        memoryOnly = false;
        try {
            getStorage().removeItem(sessionStorageKey);
        } catch {
            // Память очищена, даже если localStorage недоступен.
        }
    }

    function readEntry() {
        let entry: unknown = memory;
        try {
            const raw = memoryOnly ? JSON.stringify(memory ?? null) : getStorage().getItem(sessionStorageKey);
            if (raw === null) {
                entry = undefined;
            } else {
                try {
                    entry = JSON.parse(raw);
                } catch {
                    clear();
                    return undefined;
                }
            }
        } catch {
            // Используем память, если localStorage недоступен.
        }
        if (entry === undefined) {
            clearTimeout(timer);
            memory = undefined;
            return undefined;
        }
        if (
            typeof entry !== 'object' ||
            entry === null ||
            !('id' in entry) ||
            typeof entry.id !== 'string' ||
            !('expiresAt' in entry) ||
            typeof entry.expiresAt !== 'number' ||
            !Number.isSafeInteger(entry.expiresAt) ||
            entry.expiresAt <= Date.now() ||
            entry.expiresAt > Date.now() + sessionTtl
        ) {
            clear();
            return undefined;
        }
        memory = { id: entry.id, expiresAt: entry.expiresAt };
        clearTimeout(timer);
        timer = setTimeout(() => {
            read();
        }, entry.expiresAt - Date.now());
        return memory;
    }

    function read() {
        return readEntry()?.id;
    }

    function save(id: string) {
        clear();
        memory = { id, expiresAt: Date.now() + sessionTtl };
        try {
            getStorage().setItem(sessionStorageKey, JSON.stringify(memory));
        } catch {
            memoryOnly = true;
            // Успех SETTING не зависит от доступности localStorage.
        }
        read();
    }

    return { read, readEntry, save, clear };
}

export const sessionStorage = createSessionStorage();
