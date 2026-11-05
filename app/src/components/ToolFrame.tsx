import { useMemo } from 'react';
import { WebView } from 'react-native-webview';
import { toolErrorFrom, wrapTool } from '@/lib/toolSandbox';

export type ToolFrameProps = {
  /** The tool's HTML, as the AI wrote it (it's wrapped in the sandbox policy here). */
  html: string;
  /** The tool hit a runtime error (first few only). */
  onError: (message: string) => void;
};

/**
 * Runs a study tool (native). The page can't navigate, open windows, or reach the network except the pinned
 * libraries (see lib/studyTools.ts). The only message the app accepts from it is an error report.
 * The web build uses ToolFrame.web.tsx.
 */
export function ToolFrame({ html, onError }: ToolFrameProps) {
  const doc = useMemo(() => wrapTool(html), [html]);
  return (
    <WebView
      originWhitelist={['about:*', 'data:*']}
      source={{ html: doc }}
      style={{ flex: 1, backgroundColor: '#FFFFFF' }}
      setSupportMultipleWindows={false}
      javaScriptCanOpenWindowsAutomatically={false}
      allowFileAccess={false}
      allowsLinkPreview={false}
      mixedContentMode="never"
      onShouldStartLoadWithRequest={(req) => req.url.startsWith('about:') || req.url.startsWith('data:')}
      onMessage={(e) => {
        const msg = toolErrorFrom(e.nativeEvent.data);
        if (msg) onError(msg);
      }}
    />
  );
}
