import type { TextInputKeyPressEvent } from 'react-native';

/** Enter sends, Shift+Enter adds a line (like claude.ai). For multiline inputs with a hardware keyboard or on web. */
export function enterToSend(send: () => void) {
  return (e: TextInputKeyPressEvent) => {
    const ev = e.nativeEvent as { key: string; shiftKey?: boolean; isComposing?: boolean };
    if (ev.key !== 'Enter' || ev.shiftKey || ev.isComposing) return;
    e.preventDefault();
    send();
  };
}
