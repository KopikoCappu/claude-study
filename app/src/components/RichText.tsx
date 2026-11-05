import { useMemo } from 'react';
import { MathWebView } from '@/components/MathWebView';
import { renderMarkdownMath } from '@/lib/katexRender';
import { useTheme } from '@/lib/theme';

export type RichTextProps = { text: string; color?: string };

/** Markdown + LaTeX for chat messages on native (KaTeX in a WebView). The web build uses RichText.web.tsx. */
export function RichText({ text, color }: RichTextProps) {
  const C = useTheme();
  const html = useMemo(() => renderMarkdownMath(text, { escapeRaw: true }), [text]);
  return <MathWebView html={html} color={color ?? C.text} fontSize={16} />;
}
