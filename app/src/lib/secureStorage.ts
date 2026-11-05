import * as SecureStore from 'expo-secure-store';
import type { StateStorage } from 'zustand/middleware';
import { appStorage } from './storage';

/**
 * Native storage for secrets (the AI key): encrypted with the Android Keystore and left out of
 * cloud backups. Keys saved by older builds as a plain file are moved in here on first read.
 */
const name = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

export const secureStorage: StateStorage = {
  getItem: async (key) => {
    const value = await SecureStore.getItemAsync(name(key));
    if (value !== null) return value;
    const legacy = await appStorage.getItem(key);
    if (legacy !== null) {
      await SecureStore.setItemAsync(name(key), legacy);
      await appStorage.removeItem(key);
    }
    return legacy;
  },
  setItem: (key, value) => SecureStore.setItemAsync(name(key), value),
  removeItem: (key) => SecureStore.deleteItemAsync(name(key)),
};
