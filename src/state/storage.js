function createSafeStorage(storage, label) {
    const fallback = {};

    return {
        getItem(key) {
            try {
                return storage.getItem(key);
            } catch (error) {
                console.warn(`${label}.getItem fallback:`, error);
                return fallback[key] || null;
            }
        },
        setItem(key, value) {
            try {
                storage.setItem(key, value);
            } catch (error) {
                console.warn(`${label}.setItem fallback:`, error);
                fallback[key] = String(value);
            }
        },
    };
}

export const safeSession = createSafeStorage(sessionStorage, "sessionStorage");
export const safeLocal = createSafeStorage(localStorage, "localStorage");
