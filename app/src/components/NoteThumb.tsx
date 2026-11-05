import { Canvas, Group, Image as SkiaImage, Path } from '@shopify/react-native-skia';
import { memo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { isDark } from '@/components/PaperBackground';
import { strokeBounds, strokePath, TEXT_SIZE, textBounds, textLineHeight } from '@/lib/ink';
import { PAGE_W, pageIndexOf, pageTop } from '@/lib/pages';
import { skImageFor } from '@/lib/snapshot';
import type { Page, PageImage, Stroke } from '@/lib/types';

/** One page of a note (page 1 by default), scaled down to fill its box (boxes share the Letter page's aspect ratio). */
export function NoteThumb({ page, index = 0 }: { page: Page; index?: number }) {
  const [width, setWidth] = useState(0);
  const s = width / PAGE_W;
  const strokes = page.strokes.filter((st) => pageIndexOf(strokeBounds(st)) === index);
  const images = page.images.filter((im) => pageIndexOf(im) === index);
  const texts = page.texts.filter((t) => pageIndexOf(textBounds(t)) === index);
  const textColor = isDark(page.bg ?? '#FFFFFF') ? '#F2F2F2' : '#141413';

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: page.bg ?? '#FFFFFF' }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && strokes.length + images.length > 0 && (
        <Canvas style={StyleSheet.absoluteFill}>
          <Group transform={[{ scale: s }, { translateY: -pageTop(index) }]}>
            {images.map((im) => (
              <ThumbImage key={im.id} im={im} />
            ))}
            {strokes.map((st) => (
              <ThumbStroke key={st.id} st={st} />
            ))}
          </Group>
        </Canvas>
      )}
      {width > 0 &&
        texts.map((t) => (
          <Text
            key={t.id}
            numberOfLines={Math.max(1, Math.floor(400 / textLineHeight(t)))}
            style={{
              position: 'absolute',
              left: t.x * s,
              top: (t.y - pageTop(index)) * s,
              width: t.width * s,
              fontSize: (t.size ?? TEXT_SIZE) * s,
              lineHeight: textLineHeight(t) * s,
              color: t.color ?? textColor,
            }}
          >
            {t.text}
          </Text>
        ))}
    </View>
  );
}

const ThumbImage = memo(function ThumbImage({ im }: { im: PageImage }) {
  const sk = skImageFor(im);
  return sk ? <SkiaImage image={sk} x={im.x} y={im.y} width={im.w} height={im.h} fit="fill" /> : null;
});

const ThumbStroke = memo(function ThumbStroke({ st }: { st: Stroke }) {
  if (st.tool === 'pen') return <Path path={strokePath(st)} color={st.color} />;
  return <Path path={strokePath(st)} color={st.color} opacity={st.tool === 'highlighter' ? 0.35 : 1} style="stroke" strokeWidth={st.size} strokeCap="round" strokeJoin="round" />;
});
