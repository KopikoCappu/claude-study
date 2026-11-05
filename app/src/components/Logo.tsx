import { Canvas, Group, ImageSVG, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { CLAY, logoSvg } from '@/lib/logo';

/** The Kober clay-tablet mark, in any single color. */
export function Logo({ size = 32, color = CLAY }: { size?: number; color?: string }) {
  const svg = useMemo(() => Skia.SVG.MakeFromString(logoSvg({ color })), [color]);
  if (!svg) return null;
  // Draw at the SVG's native 100×100 and scale the group (drawing it smaller directly mis-scales on web).
  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      <Group transform={[{ scale: size / 100 }]}>
        <ImageSVG svg={svg} x={0} y={0} width={100} height={100} />
      </Group>
    </Canvas>
  );
}
