import { useMemo } from 'react';
import { renderRich } from '@/lib/richtext.web';
import type { RichTextProps } from './RichText';

/** Markdown + LaTeX (KaTeX) for chat messages on web. */
export function RichText({ text, color }: RichTextProps) {
  const html = useMemo(() => renderRich(text), [text]);
  return <div className="ib-rich" style={{ color, fontFamily: "SourceSerif4_400Regular, Georgia, serif", fontSize: 16, lineHeight: 1.55 }} dangerouslySetInnerHTML={{ __html: html }} />;
}
