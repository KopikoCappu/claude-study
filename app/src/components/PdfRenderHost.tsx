import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { LoadedImage, PdfPages } from '@/lib/importFiles';

/**
 * Renders PDF pages to JPEGs on the app with PDF.js inside a hidden WebView (the same renderer the web
 * version uses). Mount <PdfRenderHost /> once near the app root; call renderPdfPages() from anywhere.
 * The page's origin is set to the CDN so PDF.js can start its worker.
 */

const CDN = 'https://cdnjs.cloudflare.com/';
const PDFJS = `${CDN}ajax/libs/pdf.js/3.11.174`;
const TIMEOUT_MS = 180_000;

type Job = {
  id: number;
  base64: string;
  maxPages: number;
  width: number;
  onProgress?: (msg: string) => void;
  resolve: (r: PdfPages) => void;
  reject: (e: Error) => void;
};

const queue: Job[] = [];
let wake: (() => void) | null = null;
let nextId = 1;

export function renderPdfPages(base64: string, maxPages: number, width: number, onProgress?: (msg: string) => void): Promise<PdfPages> {
  return new Promise((resolve, reject) => {
    if (!wake) return reject(new Error('The PDF reader is not ready yet. Try again in a moment.'));
    queue.push({ id: nextId++, base64, maxPages, width, onProgress, resolve, reject });
    wake();
  });
}

const HTML = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<script src="${PDFJS}/pdf.min.js"></script>
<script>
  var post = function (m) { window.ReactNativeWebView.postMessage(JSON.stringify(m)); };
  if (!window.pdfjsLib) post({ type: 'error', message: 'Could not load the PDF reader. Check your internet connection and try again.' });
  else { pdfjsLib.GlobalWorkerOptions.workerSrc = '${PDFJS}/pdf.worker.min.js'; post({ type: 'ready' }); }
  window.renderPdf = async function (b64, maxPages, width) {
    try {
      var bin = atob(b64), bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      bin = null;
      var doc = await pdfjsLib.getDocument({ data: bytes }).promise;
      var count = Math.min(doc.numPages, maxPages);
      post({ type: 'start', count: count, total: doc.numPages });
      for (var n = 1; n <= count; n++) {
        var page = await doc.getPage(n);
        var vp = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width });
        var c = document.createElement('canvas');
        c.width = Math.round(vp.width); c.height = Math.round(vp.height);
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, c.width, c.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        post({ type: 'page', n: n, base64: c.toDataURL('image/jpeg', 0.82).split(',')[1], width: c.width, height: c.height });
        page.cleanup(); c.width = c.height = 0;
      }
      await doc.destroy();
      post({ type: 'done', total: doc.numPages });
    } catch (e) {
      var msg = (e && e.name === 'PasswordException') ? 'This PDF is password-protected.' : 'Could not read this PDF.';
      post({ type: 'error', message: msg });
    }
  };
</script></body></html>`;

/** Mounts a hidden WebView only while there's PDF work to do. */
export function PdfRenderHost() {
  const [active, setActive] = useState<Job | null>(null);
  const web = useRef<ComponentRef<typeof WebView>>(null);
  const pages = useRef<LoadedImage[]>([]);
  const count = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    wake = () => setActive((cur) => cur ?? queue.shift() ?? null);
    return () => {
      wake = null;
    };
  }, []);

  function finish(fn: (job: Job) => void) {
    if (timer.current) clearTimeout(timer.current);
    if (active) fn(active);
    pages.current = [];
    setActive(queue.shift() ?? null); // a new WebView for the next job (fresh memory)
  }

  useEffect(() => {
    if (!active) return;
    timer.current = setTimeout(() => finish((j) => j.reject(new Error('Importing the PDF took too long.'))), TIMEOUT_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!active) return null;
  return (
    <View style={styles.hidden} pointerEvents="none">
      <WebView
        key={active.id}
        ref={web}
        source={{ html: HTML, baseUrl: CDN }}
        originWhitelist={['*']}
        javaScriptEnabled
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={(req) => req.url === CDN || req.url.startsWith('about:') || req.url.startsWith('data:')}
        onError={() => finish((j) => j.reject(new Error('Could not load the PDF reader. Check your internet connection and try again.')))}
        onMessage={(e) => {
          let m: { type: string; [k: string]: any };
          try {
            m = JSON.parse(e.nativeEvent.data);
          } catch {
            return;
          }
          if (m.type === 'ready') {
            active.onProgress?.('Reading PDF…');
            web.current?.injectJavaScript(`window.renderPdf(${JSON.stringify(active.base64)}, ${active.maxPages}, ${active.width}); true;`);
          } else if (m.type === 'start') {
            count.current = m.count;
            active.onProgress?.(`Importing page 1 of ${m.count}…`);
          } else if (m.type === 'page') {
            pages.current.push({ base64: m.base64, width: m.width, height: m.height, mime: 'image/jpeg' });
            if (m.n < count.current) active.onProgress?.(`Importing page ${m.n + 1} of ${count.current}…`);
          } else if (m.type === 'done') {
            const got = pages.current;
            finish((j) => j.resolve({ pages: got, total: m.total }));
          } else if (m.type === 'error') {
            finish((j) => j.reject(new Error(m.message)));
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Off-screen but laid out, so Android keeps running its JavaScript.
  hidden: { position: 'absolute', left: -10, top: 0, width: 4, height: 4, opacity: 0 },
});
