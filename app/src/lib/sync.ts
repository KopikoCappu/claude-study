import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { API_URL } from './api';
import { syncKey, useStore, type RemoteItem } from './store';
import { supabase } from './supabase';
import type { Page } from './types';

/**
 * Cloud sync for notes + folders (Supabase table `sync_items`, one JSON row per item, RLS = own rows only).
 * Local storage stays the source of truth for the UI; sync is last-write-wins on `updatedAt`:
 *  - push: upload items whose updatedAt is newer than what the cloud last saw (+ deletion tombstones)
 *  - pull: list (kind, id, updated_at, deleted) cheaply, then fetch `data` only for rows newer than local
 */

export type SyncStatus = 'signed-out' | 'idle' | 'syncing' | 'error';

type AuthState = {
  session: Session | null;
  ready: boolean;
  status: SyncStatus;
  lastSyncedAt: number | null;
  error: string | null;
};

export const useAuth = create<AuthState>(() => ({ session: null, ready: false, status: 'signed-out', lastSyncedAt: null, error: null }));

const TABLE = 'sync_items';
const MAX_BATCH_CHARS = 2_500_000; // keep each upload request comfortably small (pages can contain photos)

/** What we upload for a page: everything except chat attachments' image data (large and only needed once). */
function slimPage(p: Page): Page {
  return {
    ...p,
    chat: p.chat.map((m) =>
      m.chips ? { ...m, chips: m.chips.map(({ id, bounds, text, label }) => ({ id, bounds, text, label })) } : m,
    ),
  };
}

type Row = { kind: 'note' | 'folder'; id: string; data: unknown; updated_at: number; deleted: boolean };

async function push() {
  if (!supabase) return;
  const { pages, folders, synced, tombstones, markSynced } = useStore.getState();
  const rows: Row[] = [];
  for (const p of Object.values(pages)) if ((synced[syncKey('note', p.id)] ?? 0) < p.updatedAt) rows.push({ kind: 'note', id: p.id, data: slimPage(p), updated_at: p.updatedAt, deleted: false });
  for (const f of Object.values(folders)) {
    const at = f.updatedAt ?? f.createdAt;
    if ((synced[syncKey('folder', f.id)] ?? 0) < at) rows.push({ kind: 'folder', id: f.id, data: f, updated_at: at, deleted: false });
  }
  for (const [k, at] of Object.entries(tombstones)) {
    if ((synced[k] ?? 0) >= at) continue;
    const [kind, ...rest] = k.split(':');
    rows.push({ kind: kind as Row['kind'], id: rest.join(':'), data: {}, updated_at: at, deleted: true });
  }

  // Batch by size so a note full of photos doesn't produce one giant request.
  let batch: Row[] = [];
  let size = 0;
  const flush = async () => {
    if (!batch.length) return;
    const { error } = await supabase!.from(TABLE).upsert(batch, { onConflict: 'user_id,kind,id' });
    if (error) throw new Error(error.message);
    markSynced(Object.fromEntries(batch.map((r) => [syncKey(r.kind, r.id), r.updated_at])));
    batch = [];
    size = 0;
  };
  for (const r of rows) {
    const n = JSON.stringify(r.data).length;
    if (batch.length && size + n > MAX_BATCH_CHARS) await flush();
    batch.push(r);
    size += n;
  }
  await flush();
}

async function pull() {
  if (!supabase) return;
  const { data: index, error } = await supabase.from(TABLE).select('kind,id,updated_at,deleted');
  if (error) throw new Error(error.message);
  const { pages, folders, synced, tombstones, applyRemote } = useStore.getState();

  const newer = (index ?? []).filter((r) => {
    const k = syncKey(r.kind, r.id);
    const local = r.kind === 'note' ? pages[r.id] : folders[r.id];
    const localAt = local ? (local.updatedAt ?? local.createdAt) : (tombstones[k] ?? 0);
    return r.updated_at > localAt && r.updated_at > (synced[k] ?? 0);
  });
  if (!newer.length) return;

  const tombs = newer.filter((r) => r.deleted) as RemoteItem[];
  const live = newer.filter((r) => !r.deleted);
  const full: RemoteItem[] = [];
  for (const kind of ['note', 'folder'] as const) {
    const ids = live.filter((r) => r.kind === kind).map((r) => r.id);
    for (let i = 0; i < ids.length; i += 20) {
      const { data, error: e } = await supabase.from(TABLE).select('kind,id,updated_at,deleted,data').eq('kind', kind).in('id', ids.slice(i, i + 20));
      if (e) throw new Error(e.message);
      full.push(...((data ?? []) as RemoteItem[]));
    }
  }
  applyRemote([...tombs, ...full]);
}

let running: Promise<void> | null = null;
let again = false;

/** Pull then push. Concurrent calls coalesce into one follow-up run. */
export function syncNow(): Promise<void> {
  if (!supabase || !useAuth.getState().session) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    useAuth.setState({ status: 'syncing', error: null });
    try {
      do {
        again = false;
        await pull();
        await push();
      } while (again);
      useAuth.setState({ status: 'idle', lastSyncedAt: Date.now() });
    } catch (e) {
      useAuth.setState({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    } finally {
      running = null;
    }
  })();
  return running;
}

// ---------------------------------------------------------------- accounts

async function errorText(res: Response) {
  const j = (await res.json().catch(() => null)) as { error?: string } | null;
  return j?.error ?? `Server error ${res.status}`;
}

const normEmail = (email: string) => email.trim().toLowerCase();

/** Never leave a button spinning: give up on account requests after 25 s with a readable message. */
function withTimeout<T>(p: Promise<T>, what: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${what} is taking too long. If you just signed up, check your email for a code; otherwise try again in a minute.`)), 25_000),
    ),
  ]);
}

/**
 * New-password rule, shown before we ask the server. Supabase enforces the same rule itself
 * (Auth → Password requirements), so requests that skip the app can't get around it.
 */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return 'Use at least 8 characters.';
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'Use at least one letter and one number.';
  return null;
}

/** Thrown when an account exists but its email hasn't been confirmed with the code yet. */
export class EmailNotConfirmedError extends Error {
  constructor() {
    super('Confirm your email first: enter the code we sent you.');
  }
}

function authMessage(error: { message: string; code?: string }) {
  if (error.code === 'weak_password') return 'Use at least 8 characters, including a letter and a number.';
  if (error.code === 'over_email_send_rate_limit' || error.code === 'over_request_rate_limit')
    return 'Too many attempts right now. Wait a few minutes and try again.';
  if (error.code === 'otp_expired') return 'That code is wrong or has expired. Check it, or send a new one.';
  if (error.code === 'user_already_exists' || error.code === 'email_exists') return 'An account with this email already exists. Sign in instead.';
  if (error.message === 'Invalid login credentials') return 'Wrong email or password.';
  return error.message;
}

/**
 * Create an account. Supabase emails a confirmation code; the account can't sign in until
 * `verifySignup` is called with it. Returns 'verify' in that case, or 'signed-in' if the project
 * has email confirmation turned off.
 */
export async function signUp(email: string, password: string): Promise<'verify' | 'signed-in'> {
  if (!supabase) throw new Error('Accounts are not set up in this build.');
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);
  const { data, error } = await withTimeout(supabase.auth.signUp({ email: normEmail(email), password }), 'Creating your account');
  if (error) throw new Error(authMessage(error));
  if (data.session) return 'signed-in';
  // Supabase doesn't reveal existing accounts by erroring; it returns a user with no identities instead.
  if (data.user && data.user.identities?.length === 0) throw new Error('An account with this email already exists. Sign in instead.');
  return 'verify';
}

/** Confirm a new account with the code from the email. Signs the user in on success. */
export async function verifySignup(email: string, code: string) {
  if (!supabase) throw new Error('Accounts are not set up in this build.');
  const { error } = await withTimeout(supabase.auth.verifyOtp({ email: normEmail(email), token: code.replace(/\s/g, ''), type: 'email' }), 'Checking the code');
  if (error) throw new Error(authMessage({ ...error, code: error.code ?? 'otp_expired' }));
}

/** Email a fresh confirmation code (Supabase allows one per minute). */
export async function resendSignupCode(email: string) {
  if (!supabase) throw new Error('Accounts are not set up in this build.');
  const { error } = await withTimeout(supabase.auth.resend({ type: 'signup', email: normEmail(email) }), 'Sending a new code');
  if (error) throw new Error(authMessage(error));
}

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error('Accounts are not set up in this build.');
  const { error } = await withTimeout(supabase.auth.signInWithPassword({ email: normEmail(email), password }), 'Signing in');
  if (error?.code === 'email_not_confirmed') throw new EmailNotConfirmedError();
  if (error) throw new Error(authMessage(error));
}

/** Upload anything pending, then sign out and clear this account's notes from the device (they stay in the cloud). */
export async function signOut() {
  if (!supabase) return;
  await syncNow();
  if (useAuth.getState().status === 'error') throw new Error('Could not upload your latest changes — check your connection and try again.');
  await supabase.auth.signOut();
  useStore.getState().resetData();
}

/** Permanently delete the account and every note stored in it, then clear this device. */
export async function deleteAccount() {
  if (!supabase) return;
  const token = useAuth.getState().session?.access_token;
  if (!token) throw new Error('Sign in again, then retry.');
  const res = await fetch(`${API_URL}/account/delete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': '1' },
  });
  if (!res.ok) throw new Error(await errorText(res));
  await supabase.auth.signOut({ scope: 'local' });
  useStore.getState().resetData();
}

/**
 * Wire auth + sync once at startup: track the session, sync on sign-in, after local edits (debounced),
 * and periodically so changes from other devices show up.
 */
let started = false;
export function startSync() {
  if (started || !supabase) {
    useAuth.setState({ ready: true });
    return;
  }
  started = true;
  // Don't touch the cloud until local notes have loaded from disk, or a pull could be overwritten by hydration.
  if (!useStore.persist.hasHydrated()) {
    const unsub = useStore.persist.onFinishHydration(() => {
      unsub();
      started = false;
      startSync();
    });
    return;
  }

  supabase.auth.getSession().then(({ data }) => {
    useAuth.setState({ session: data.session, ready: true, status: data.session ? 'idle' : 'signed-out' });
    if (data.session) void syncNow();
  });
  supabase.auth.onAuthStateChange((event, session) => {
    useAuth.setState({ session, status: session ? useAuth.getState().status : 'signed-out' });
    if (event === 'SIGNED_IN') void syncNow();
  });

  // Upload shortly after edits stop.
  let timer: ReturnType<typeof setTimeout> | null = null;
  useStore.subscribe((s, prev) => {
    if (s.pages === prev.pages && s.folders === prev.folders && s.tombstones === prev.tombstones) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void syncNow(), 1500);
  });

  // Pick up changes from other devices.
  setInterval(() => void syncNow(), 20_000);
}
