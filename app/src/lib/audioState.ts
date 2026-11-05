import { create } from 'zustand';

/**
 * Recording and playback state shared by the recorder, the audio bar and the canvas:
 *  - while recording, new strokes on that note are stamped with the time they were drawn;
 *  - while playing, ink written after the current moment is dimmed, and tapping ink jumps to when it was written.
 */
type AudioState = {
  recording: { pageId: string; id: string; startedAt: number } | null;
  /** `at`: the moment being played, as a time when the note was being written (epoch ms). */
  playback: { pageId: string; at: number } | null;
  /** Set by the audio bar while it's open: jump playback to the moment `at`. Returns false if no recording covers it. */
  seek: ((at: number) => boolean) | null;
  /** Set by the recorder (always mounted). `start` resolves with an error message, or null once recording. */
  start: ((pageId: string) => Promise<string | null>) | null;
  stop: (() => Promise<string | null>) | null;
};

export const useAudioState = create<AudioState>(() => ({ recording: null, playback: null, seek: null, start: null, stop: null }));
