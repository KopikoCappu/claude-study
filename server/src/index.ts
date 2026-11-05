import './env.js';
import cors from 'cors';
import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { askClaude, buildTool, checkKey, readHandwriting, ToolError } from './providers.js';
import { DELETE_ACCOUNT_HTML, PRIVACY_HTML } from './legal.js';
import type { AskRequest, BuildToolRequest, ImagePart } from './schema.js';

const app = express();
app.use(cors({ allowedHeaders: ['Content-Type', 'Authorization', 'x-ai-key', 'ngrok-skip-browser-warning'] }));
app.use(express.json({ limit: '25mb' })); // base64 page renders are big

app.get('/health', (_req, res) => {
  res.json({ ok: true, ai: 'bring-your-own-key' });
});

// Current weather for the home-screen banner. Location is the city-level guess Vercel attaches to each
// request (no location permission needed); Open-Meteo is free and keyless. Locally there's no location.
app.get('/weather', async (req, res) => {
  const lat = Number(req.header('x-vercel-ip-latitude'));
  const lon = Number(req.header('x-vercel-ip-longitude'));
  const cityHeader = req.header('x-vercel-ip-city');
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) {
    res.json({ available: false });
    return;
  }
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&current=temperature_2m,weather_code,is_day&temperature_unit=fahrenheit`;
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) throw new Error(`open-meteo ${r.status}`);
    const j = (await r.json()) as { current?: { temperature_2m: number; weather_code: number; is_day: number } };
    if (!j.current) throw new Error('no current weather');
    res.set('Cache-Control', 'private, max-age=600');
    res.json({
      available: true,
      city: cityHeader ? decodeURIComponent(cityHeader) : null,
      tempF: Math.round(j.current.temperature_2m),
      code: j.current.weather_code,
      isDay: j.current.is_day === 1,
    });
  } catch (err) {
    console.warn('[weather] failed', err instanceof Error ? err.message : err);
    res.json({ available: false });
  }
});

/** The user's own AI key, sent with every request. Never logged or stored. */
function userKey(req: express.Request): string | null {
  const key = req.header('x-ai-key')?.trim();
  return key && key.length >= 20 && key.length <= 300 ? key : null;
}

/** Turn provider errors into messages a student can act on — without echoing anything sensitive. */
function aiError(err: unknown): { status: number; error: string } {
  const status = (err as { status?: number })?.status ?? 0;
  const msg = err instanceof Error ? err.message : String(err);
  if (status === 401 || status === 403 || /api[_ ]?key|unauthori[sz]ed|permission/i.test(msg))
    return { status: 401, error: 'Your Claude key was rejected. Check it in Settings → Claude key.' };
  if (status === 429)
    return { status: 429, error: 'Your Claude key hit its rate limit. Wait a minute and try again.' };
  if (status === 402 || /credit|billing|quota|insufficient/i.test(msg))
    return { status: 402, error: 'Your AI account is out of credits or over its limit. Add credits in the Claude Console, then try again.' };
  if (status === 503 || status === 529 || /overloaded|high demand|unavailable/i.test(msg))
    return { status: 503, error: 'Claude is overloaded right now. Wait a few seconds and try again.' };
  return { status: 502, error: 'Claude had a problem. Try again in a moment.' };
}

app.post('/ask', async (req, res) => {
  const body = req.body as AskRequest;
  if (!body?.messages?.length) {
    res.status(400).json({ error: 'messages required' });
    return;
  }
  const key = userKey(req);
  if (!key) {
    res.status(401).json({ error: 'Add your Claude API key first: Settings → Claude key.', code: 'no_key' });
    return;
  }
  const started = Date.now();
  // Stop the Claude request (and what it costs) if the student taps Stop or closes the app.
  const abort = new AbortController();
  res.on('close', () => {
    if (!res.writableFinished) abort.abort();
  });
  try {
    const result = await askClaude(body, key, abort.signal);
    console.log(`[ask] ${body.mode} ${Date.now() - started}ms, ${result.annotations.length} annotations`);
    res.json(result);
  } catch (err) {
    if (abort.signal.aborted) {
      console.log(`[ask] stopped after ${Date.now() - started}ms`);
      return;
    }
    const e = aiError(err);
    console.error(`[ask] failed (${e.status})`, (err as { status?: number })?.status ?? '', err instanceof Error ? err.name : '');
    res.status(e.status).json({ error: e.error });
  }
});

/** Artifacts: build, fix or change an interactive page (one HTML document) with the user's key. Takes 20–60 s. */
app.post('/build-tool', async (req, res) => {
  const body = req.body as BuildToolRequest;
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim().slice(0, 4000) : '';
  if (!prompt && !body?.previous?.error) {
    res.status(400).json({ error: 'Say what tool you want.' });
    return;
  }
  const key = userKey(req);
  if (!key) {
    res.status(401).json({ error: 'Add your Claude API key first: Settings → Claude key.', code: 'no_key' });
    return;
  }
  const started = Date.now();
  const input = { ...body, prompt };
  const label = body.previous ? (body.previous.error ? 'fix' : 'edit') : 'new';

  // Stop the AI request (and what it costs the student) if they cancel or close the app.
  const abort = new AbortController();
  res.on('close', () => {
    if (!res.writableFinished) abort.abort();
  });

  // The app asks for progress with `Accept: application/x-ndjson`: one JSON object per line —
  // { progress: { chars, title? } } while the tool is written, then { tool } or { error }.
  if (req.accepts(['application/json', 'application/x-ndjson']) === 'application/x-ndjson') {
    res.status(200).set({ 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' });
    res.flushHeaders();
    const line = (o: unknown) => res.write(`${JSON.stringify(o)}\n`);
    let last = 0;
    line({ progress: { chars: 0 } });
    try {
      const tool = await buildTool(
        input,
        key,
        (p) => {
          // A few updates a second is plenty.
          if (Date.now() - last < 250 && !(p.title && p.chars < 2000)) return;
          last = Date.now();
          line({ progress: p });
        },
        abort.signal,
      );
      console.log(`[build-tool] ${label} ${Date.now() - started}ms, ${tool.html.length} chars (streamed)`);
      line({ tool });
    } catch (err) {
      if (abort.signal.aborted) {
        console.log(`[build-tool] ${label} cancelled after ${Date.now() - started}ms`);
        return;
      }
      const e = err instanceof ToolError ? { status: 422, error: err.message } : aiError(err);
      console.error(`[build-tool] ${label} failed (${e.status})`);
      line({ error: e.error, status: e.status });
    }
    res.end();
    return;
  }

  try {
    const tool = await buildTool(input, key, undefined, abort.signal);
    console.log(`[build-tool] ${label} ${Date.now() - started}ms, ${tool.html.length} chars`);
    res.json(tool);
  } catch (err) {
    if (err instanceof ToolError) {
      res.status(422).json({ error: err.message });
      return;
    }
    const e = aiError(err);
    console.error(`[build-tool] failed (${e.status})`, (err as { status?: number })?.status ?? '', err instanceof Error ? err.name : '');
    res.status(e.status).json({ error: e.error });
  }
});

/** Handwriting search: read the writing on one page image with the user's key. Body: { image, model? }. */
app.post('/read-handwriting', async (req, res) => {
  const body = req.body as { image?: ImagePart; model?: string };
  if (!body?.image?.base64) {
    res.status(400).json({ error: 'image required' });
    return;
  }
  const key = userKey(req);
  if (!key) {
    res.status(401).json({ error: 'Add your Claude API key first: Settings → Claude key.', code: 'no_key' });
    return;
  }
  try {
    res.json(await readHandwriting(key, body.image, body.model));
  } catch (err) {
    const e = aiError(err);
    console.error(`[read-handwriting] failed (${e.status})`);
    res.status(e.status).json({ error: e.error });
  }
});

/** "Save & test" in the app: confirms a key works, for free. */
app.post('/check-key', async (req, res) => {
  const key = userKey(req);
  if (!key) {
    res.status(400).json({ ok: false, error: "That doesn't look like an API key." });
    return;
  }
  try {
    await checkKey(key);
    res.json({ ok: true });
  } catch (err) {
    const e = aiError(err);
    res.status(e.status).json({ ok: false, error: e.status === 401 ? 'That key was rejected — double-check you copied all of it.' : e.error });
  }
});

// Old sign-up route that created accounts already confirmed. Removed: accounts are now created by the app with
// supabase.auth.signUp and must be confirmed with an emailed code, so this can't be used to skip that.
app.post('/auth/signup', (_req, res) => {
  res.status(410).json({ error: 'Please update Claude Study to create an account.' });
});

// Delete the signed-in user's account. Their notes go with it (sync_items rows cascade on user delete).
app.post('/account/delete', async (req, res) => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = req.header('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!url || !key) {
    res.status(500).json({ error: 'Accounts are not configured on the server.' });
    return;
  }
  if (!token) {
    res.status(401).json({ error: 'Sign in again, then retry.' });
    return;
  }
  // Ask Supabase who this token belongs to; it rejects expired or forged tokens.
  const who = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
  const user = who.ok ? ((await who.json()) as { id?: string }) : null;
  if (!user?.id) {
    res.status(401).json({ error: 'Your session expired. Sign in again, then retry.' });
    return;
  }
  const del = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
    method: 'DELETE',
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!del.ok) {
    console.error('[account/delete] failed', del.status);
    res.status(502).json({ error: "Couldn't delete your account right now. Try again in a moment." });
    return;
  }
  res.json({ ok: true });
});

app.get('/privacy', (_req, res) => {
  res.type('html').send(PRIVACY_HTML);
});
app.get('/delete-account', (_req, res) => {
  res.type('html').send(DELETE_ACCOUNT_HTML);
});

// Serve the built web app (npm run build:web) so ONE ngrok URL gives the tablet both app + API.
const webDist = fileURLToPath(new URL('../../app/dist', import.meta.url));
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  // SPA fallback for client routes like /note/abc
  app.use((req, res, next) => {
    if (req.method !== 'GET' || !req.accepts('html')) return next();
    res.sendFile('index.html', { root: webDist });
  });
} else {
  app.get('/', (_req, res) => {
    res.send('Claude Study API is running. Run `npm run build:web` to serve the app here too. Status: <a href="/health">/health</a>');
  });
}

// On Vercel the exported app is served as a function; locally we listen on a port.
if (!process.env.VERCEL) {
  const port = Number(process.env.PORT ?? 8787);
  app.listen(port, () => {
    console.log(`Claude Study server on http://localhost:${port}`);
    console.log(`Expose to the tablet with:  ngrok http ${port}`);
  });
}

export default app;
