import { useEffect, useMemo, useRef } from 'react';
import { toolErrorFrom, wrapTool } from '@/lib/toolSandbox';
import type { ToolFrameProps } from './ToolFrame';

/**
 * Runs a study tool (web) in a sandboxed iframe. "allow-scripts" without "allow-same-origin" gives it an opaque
 * origin, so it can't read the app's storage, cookies or session, and it can't navigate the app.
 */
export function ToolFrame({ html, onError }: ToolFrameProps) {
  const doc = useMemo(() => wrapTool(html), [html]);
  const frame = useRef<HTMLIFrameElement>(null);
  const report = useRef(onError);
  useEffect(() => {
    report.current = onError;
  });

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return; // only our tool
      const msg = toolErrorFrom(e.data);
      if (msg) report.current(msg);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <iframe
      ref={frame}
      title="Artifact"
      sandbox="allow-scripts"
      srcDoc={doc}
      style={{ flex: 1, width: '100%', height: '100%', border: 'none', backgroundColor: '#FFFFFF', display: 'block' }}
    />
  );
}
