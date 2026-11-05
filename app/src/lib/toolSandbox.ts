/**
 * Study tools run AI-written HTML, so every tool is wrapped before it runs:
 *  - A Content-Security-Policy that blocks all network access except the pinned libraries the server's prompt
 *    allows (server/src/prompts.ts TOOL_LIBRARIES — keep the two lists in sync). It comes first in <head>, so
 *    nothing in the tool can loosen it.
 *  - An error hook that reports the first few errors to the app (for "Fix it"), and no-op alert/confirm/prompt.
 * The frame itself adds the rest: a sandboxed iframe on web (opaque origin, so no access to the app's storage),
 * and a WebView that can't navigate or open windows on native.
 */
const CDN = 'https://cdn.jsdelivr.net/npm/';
const LIBS = ['three@0.170.0/', 'chart.js@4.4.7/', 'sql.js@1.12.0/', 'katex@0.19.0/'].map((l) => CDN + l).join(' ');

const CSP = [
  "default-src 'none'",
  `script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' ${LIBS}`,
  `style-src 'unsafe-inline' ${LIBS}`,
  `font-src data: ${LIBS}`,
  `connect-src ${LIBS}`, // sql.js fetches its .wasm
  'img-src data: blob:',
  'media-src data: blob:',
  'worker-src blob:',
  "form-action 'none'",
  "base-uri 'none'",
].join('; ');

/** Message type the error hook posts to the app. */
export const TOOL_ERROR = 'kober-tool-error';

const HOOK = `(function () {
  var sent = 0;
  function post(m) {
    if (sent++ >= 3) return;
    var d = JSON.stringify({ type: '${TOOL_ERROR}', message: String(m).slice(0, 2000) });
    try { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(d); else window.parent.postMessage(d, '*'); } catch (e) {}
  }
  window.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t !== window && (t.src || t.href)) { post('Failed to load ' + (t.src || t.href)); return; }
    post((e.message || 'Error') + (e.lineno ? ' (line ' + e.lineno + ')' : ''));
  }, true);
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason; post('Unhandled promise rejection: ' + ((r && (r.stack || r.message)) || r));
  });
  document.addEventListener('securitypolicyviolation', function (e) {
    post('Blocked by the sandbox (' + e.violatedDirective + '): ' + e.blockedURI);
  });
  var ce = console.error;
  console.error = function () { post(Array.prototype.map.call(arguments, String).join(' ')); return ce.apply(console, arguments); };
  window.alert = window.confirm = window.prompt = function () { return null; };
})();`;

/** The tool's HTML with the sandbox policy and error hook put first in <head>. */
export function wrapTool(html: string): string {
  const inject = `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><meta name="viewport" content="width=device-width, initial-scale=1"><script>${HOOK}</script>`;
  const head = html.match(/<head[^>]*>/i);
  if (head?.index !== undefined) return html.slice(0, head.index + head[0].length) + inject + html.slice(head.index + head[0].length);
  const root = html.match(/<html[^>]*>/i);
  if (root?.index !== undefined) return html.slice(0, root.index + root[0].length) + `<head>${inject}</head>` + html.slice(root.index + root[0].length);
  return `<!doctype html><html><head>${inject}</head><body>${html}</body></html>`;
}

/** Parse a message from a tool frame; returns the error text, or null if it isn't one of ours. */
export function toolErrorFrom(data: unknown): string | null {
  if (typeof data !== 'string') return null;
  try {
    const m = JSON.parse(data) as { type?: string; message?: unknown };
    return m.type === TOOL_ERROR && typeof m.message === 'string' ? m.message : null;
  } catch {
    return null;
  }
}
