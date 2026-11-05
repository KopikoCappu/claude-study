import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SyncBadge } from '@/components/SyncBadge';
import { IconBtn } from '@/components/Toolbar';
import { useStore } from '@/lib/store';
import { deleteAccount, EmailNotConfirmedError, passwordProblem, resendSignupCode, signIn, signOut, signUp, syncNow, useAuth, verifySignup } from '@/lib/sync';
import { PRIVACY_URL } from '@/lib/support';
import { makeStyles, R, useTheme } from '@/lib/theme';

export default function AccountScreen() {
  const C = useTheme();
  const styles = useStyles();
  const session = useAuth((s) => s.session);
  return (
    <SafeAreaView style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.top}>
        <IconBtn icon="chevron-left" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.center}>
        <View style={[styles.card, C.shadow]}>{session ? <SignedIn email={session.user.email ?? ''} /> : <SignInForm />}</View>
        <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} hitSlop={8} style={{ marginTop: 16 }}>
          <Text style={styles.link}>Privacy policy</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SignInForm() {
  const C = useTheme();
  const styles = useStyles();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const localNotes = useStore((s) => Object.keys(s.pages).length);

  const [verifying, setVerifying] = useState(false);
  const pwHint = mode === 'signup' && password ? passwordProblem(password) : null;

  async function submit() {
    if (pwHint) return setError(pwHint);
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signup') {
        if ((await signUp(email, password)) === 'verify') return setVerifying(true);
      } else await signIn(email, password);
      router.replace('/');
    } catch (e) {
      if (e instanceof EmailNotConfirmedError) {
        // Signed up earlier but never entered the code: send a fresh one and ask for it.
        await resendSignupCode(email).catch(() => {});
        return setVerifying(true);
      }
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (verifying) return <VerifyEmail email={email} onBack={() => (setVerifying(false), setMode('signin'))} />;

  return (
    <>
      <Text style={styles.h1}>{mode === 'signin' ? 'Sign in' : 'Create your account'}</Text>
      <Text style={styles.sub}>Sync your notes across your tablet, laptop and phone.</Text>

      <View style={styles.tabs}>
        {(['signin', 'signup'] as const).map((m) => (
          <Pressable key={m} onPress={() => (setMode(m), setError(null))} style={[styles.tab, mode === m && styles.tabOn]}>
            <Text style={[styles.tabText, mode === m && { color: C.text }]}>{m === 'signin' ? 'Sign in' : 'Create account'}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="you@example.com"
        placeholderTextColor={C.faint}
        style={styles.input}
      />
      <Text style={styles.label}>Password</Text>
      <View style={styles.pwRow}>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          placeholder={mode === 'signup' ? '8+ characters, a letter and a number' : ''}
          placeholderTextColor={C.faint}
          onSubmitEditing={submit}
          style={[styles.input, { flex: 1, borderWidth: 0 }]}
        />
        <IconBtn icon={show ? 'eye-off-outline' : 'eye-outline'} onPress={() => setShow(!show)} size={18} />
      </View>

      {!!pwHint && !error && <Text style={styles.hint}>{pwHint}</Text>}
      {!!error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={[styles.primary, (busy || !email || !password) && { opacity: 0.4 }]} disabled={busy || !email || !password} onPress={submit}>
        {busy ? <ActivityIndicator color={C.onPrimary} /> : <Text style={styles.primaryText}>{mode === 'signin' ? 'Sign in' : 'Create account'}</Text>}
      </Pressable>

      {localNotes > 0 && (
        <Text style={styles.note}>
          {localNotes} note{localNotes > 1 ? 's' : ''} on this device will be added to your account.
        </Text>
      )}
      <Pressable onPress={() => router.replace('/')} hitSlop={8} style={{ alignSelf: 'center', marginTop: 14 }}>
        <Text style={styles.link}>Continue without an account</Text>
      </Pressable>
    </>
  );
}

/** Step 2 of sign-up: enter the code Supabase emailed. Bots without a real inbox stop here. */
function VerifyEmail({ email, onBack }: { email: string; onBack: () => void }) {
  const C = useTheme();
  const styles = useStyles();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [wait, setWait] = useState(60);
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      await verifySignup(email, code);
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  async function resend() {
    setError(null);
    setSent(null);
    try {
      await resendSignupCode(email);
      setSent('New code sent.');
      setWait(60);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const ready = /^\d{6,10}$/.test(code.replace(/\s/g, ''));
  return (
    <>
      <MaterialCommunityIcons name="email-check-outline" size={40} color={C.icon} style={{ alignSelf: 'center' }} />
      <Text style={[styles.h1, { textAlign: 'center', marginTop: 8 }]}>Check your email</Text>
      <Text style={[styles.sub, { textAlign: 'center' }]}>We sent a code to {email.trim().toLowerCase()}. Enter it to finish creating your account.</Text>

      <TextInput
        value={code}
        onChangeText={(t) => (setCode(t.replace(/[^\d\s]/g, '')), setError(null))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={12}
        placeholder="123456"
        placeholderTextColor={C.faint}
        onSubmitEditing={() => ready && void verify()}
        style={[styles.input, styles.code]}
      />

      {!!error && <Text style={styles.error}>{error}</Text>}
      {!!sent && !error && <Text style={styles.hint}>{sent}</Text>}

      <Pressable style={[styles.primary, (busy || !ready) && { opacity: 0.4 }]} disabled={busy || !ready} onPress={verify}>
        {busy ? <ActivityIndicator color={C.onPrimary} /> : <Text style={styles.primaryText}>Confirm email</Text>}
      </Pressable>

      <Pressable onPress={resend} disabled={wait > 0} hitSlop={8} style={{ alignSelf: 'center', marginTop: 14 }}>
        <Text style={[styles.link, wait > 0 && { textDecorationLine: 'none' }]}>{wait > 0 ? `Resend code in ${wait}s` : 'Resend code'}</Text>
      </Pressable>
      <Text style={styles.note}>Can&apos;t find it? Check your spam folder.</Text>
      <Pressable onPress={onBack} hitSlop={8} style={{ alignSelf: 'center', marginTop: 10 }}>
        <Text style={styles.link}>Back to sign in</Text>
      </Pressable>
    </>
  );
}

function SignedIn({ email }: { email: string }) {
  const C = useTheme();
  const styles = useStyles();
  const { status, lastSyncedAt, error } = useAuth();
  const count = useStore((s) => Object.keys(s.pages).length);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  useEffect(() => {
    if (!confirm) return;
    const t = setTimeout(() => setConfirm(false), 4000);
    return () => clearTimeout(t);
  }, [confirm]);

  async function doSignOut() {
    if (!confirm) return setConfirm(true);
    setBusy(true);
    setSignOutError(null);
    try {
      await signOut();
      router.replace('/');
    } catch (e) {
      setSignOutError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <MaterialCommunityIcons name="account-circle-outline" size={44} color={C.icon} style={{ alignSelf: 'center' }} />
      <Text style={[styles.h1, { textAlign: 'center', marginTop: 8 }]}>{email}</Text>
      <View style={styles.statusRow}>
        <SyncBadge />
        <Text style={styles.sub}>
          {count} note{count === 1 ? '' : 's'}
          {lastSyncedAt ? ` · synced ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}
        </Text>
      </View>
      {status === 'error' && !!error && <Text style={styles.error}>Sync problem: {error}</Text>}

      <Pressable style={[styles.secondary, status === 'syncing' && { opacity: 0.5 }]} disabled={status === 'syncing'} onPress={() => void syncNow()}>
        <MaterialCommunityIcons name="cloud-sync-outline" size={18} color={C.text} />
        <Text style={styles.secondaryText}>Sync now</Text>
      </Pressable>
      <Pressable style={[styles.secondary, confirm && { borderColor: C.danger }]} disabled={busy} onPress={doSignOut}>
        {busy ? <ActivityIndicator color={C.danger} /> : <MaterialCommunityIcons name="logout" size={18} color={C.danger} />}
        <Text style={[styles.secondaryText, { color: C.danger }]}>{confirm ? 'Tap again — notes leave this device (kept in your account)' : 'Sign out'}</Text>
      </Pressable>
      {!!signOutError && <Text style={styles.error}>{signOutError}</Text>}
      <DeleteAccount />
    </>
  );
}

/** Required by Google Play: users who can create an account must be able to delete it in the app. */
function DeleteAccount() {
  const C = useTheme();
  const styles = useStyles();
  const [step, setStep] = useState<0 | 1>(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount();
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  if (step === 0)
    return (
      <Pressable onPress={() => setStep(1)} hitSlop={8} style={{ alignSelf: 'center', marginTop: 18 }}>
        <Text style={[styles.link, { color: C.danger }]}>Delete account</Text>
      </Pressable>
    );
  return (
    <View style={styles.danger}>
      <Text style={styles.dangerText}>
        This permanently deletes your account and every note saved in it, on all devices. It can&apos;t be undone.
      </Text>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
        <Pressable style={[styles.secondary, { flex: 1, marginTop: 0 }]} disabled={busy} onPress={() => (setStep(0), setError(null))}>
          <Text style={styles.secondaryText}>Cancel</Text>
        </Pressable>
        <Pressable style={[styles.secondary, { flex: 1, marginTop: 0, borderColor: C.danger }]} disabled={busy} onPress={confirmDelete}>
          {busy ? <ActivityIndicator color={C.danger} /> : <Text style={[styles.secondaryText, { color: C.danger }]}>Delete forever</Text>}
        </Pressable>
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const useStyles = makeStyles((C) => ({
  root: { flex: 1, backgroundColor: C.bg },
  top: { paddingHorizontal: 12, paddingTop: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 400, backgroundColor: C.surface, borderRadius: R.lg, padding: 24, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  h1: { fontSize: 22, fontWeight: '700', color: C.text, letterSpacing: -0.3 },
  sub: { fontSize: 14, color: C.muted, marginTop: 4 },
  tabs: { flexDirection: 'row', backgroundColor: C.bg, borderRadius: R.sm, padding: 3, marginTop: 20, marginBottom: 8 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 6 },
  tabOn: { backgroundColor: C.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  tabText: { fontSize: 13, fontWeight: '600', color: C.muted },
  label: { fontSize: 12, fontWeight: '600', color: C.muted, marginTop: 14, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: R.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: C.text, backgroundColor: C.surface },
  pwRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.border, borderRadius: R.sm, paddingRight: 2 },
  error: { color: C.danger, fontSize: 13, marginTop: 12 },
  hint: { color: C.muted, fontSize: 13, marginTop: 10 },
  code: { marginTop: 20, fontSize: 24, letterSpacing: 6, textAlign: 'center', fontVariant: ['tabular-nums'] },
  primary: { backgroundColor: C.primary, borderRadius: R.sm + 2, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  primaryText: { color: C.onPrimary, fontWeight: '600', fontSize: 15 },
  note: { fontSize: 13, color: C.muted, textAlign: 'center', marginTop: 12 },
  link: { fontSize: 14, color: C.muted, textDecorationLine: 'underline' },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 6, marginBottom: 16 },
  secondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: C.border, borderRadius: R.pill, minHeight: 44, paddingHorizontal: 14, marginTop: 10 },
  secondaryText: { fontSize: 14, fontWeight: '600', color: C.text, flexShrink: 1, textAlign: 'center' },
  danger: { marginTop: 18, padding: 12, borderRadius: R.md, borderWidth: 1, borderColor: C.danger },
  dangerText: { fontSize: 13, lineHeight: 18, color: C.text },
}));
