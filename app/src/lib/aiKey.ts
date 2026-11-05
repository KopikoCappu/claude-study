import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { secureStorage } from './secureStorage';

/**
 * The user's own Claude API key (bring your own key). Kept only on this device (encrypted on Android) — separate from
 * notes, so it is never uploaded by cloud sync. It's sent with each request; the server uses it for that one call and
 * never stores it.
 */
type AiKeyState = {
  key?: string;
  setKey: (key: string) => void;
  removeKey: () => void;
};

export const useAiKey = create<AiKeyState>()(
  persist(
    (set) => ({
      key: undefined,
      setKey: (key) => set({ key: key.trim() }),
      removeKey: () => set({ key: undefined }),
    }),
    { name: 'kober-claude-key', storage: createJSONStorage(() => secureStorage) },
  ),
);

/** The saved Claude key, if there is one. */
export const activeKey = () => useAiKey.getState().key ?? null;

export const CLAUDE_KEY = {
  getKeyUrl: 'https://console.anthropic.com/settings/keys',
  hint: 'Pay as you go: buy credits at console.anthropic.com, then create a key. A typical question costs about 6¢ with Opus 5.5 or 3¢ with Sonnet 5.5.',
  placeholder: 'sk-ant-…',
};
