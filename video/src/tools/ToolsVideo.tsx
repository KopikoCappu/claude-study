import React from 'react';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { slide } from '@remotion/transitions/slide';
import { ease, sec, zoomBlur } from '../common';
import { BUILD_S, Build } from './Build';
import { HOOK_S, Hook, LOGO_S, Logo, MONTAGE_S, Montage, OUTRO_S, Outro } from './Scenes';
import { DEMOS, VideoProvider, type Brand, type Topic } from './demos';

const T = sec(0.4);
const SCENES: { C: React.FC; s: number }[] = [
  { C: Hook, s: HOOK_S },
  { C: Logo, s: LOGO_S },
  { C: Build, s: BUILD_S },
  { C: Montage, s: MONTAGE_S },
  { C: Outro, s: OUTRO_S },
];
const TRANSITIONS = [zoomBlur(), slide({ direction: 'from-bottom' }), zoomBlur(), zoomBlur()];

export const TOOLS_TOTAL = SCENES.reduce((a, x) => a + sec(x.s), 0) - T * TRANSITIONS.length;

/** Study tools: notes → a practice tool built beside them. Uses real tools the app built (public/tools). */
export type ToolsVideoProps = { topic: Topic; brand: Brand };

export const ToolsVideo: React.FC<ToolsVideoProps> = ({ topic, brand }) => (
  <VideoProvider value={{ demo: DEMOS[topic], brand }}>
  <TransitionSeries>
    {SCENES.map(({ C, s }, i) => (
      <React.Fragment key={i}>
        <TransitionSeries.Sequence durationInFrames={sec(s)}>
          <C />
        </TransitionSeries.Sequence>
        {i < TRANSITIONS.length && (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          <TransitionSeries.Transition presentation={TRANSITIONS[i] as any} timing={linearTiming({ durationInFrames: T, easing: ease.inOut })} />
        )}
      </React.Fragment>
    ))}
  </TransitionSeries>
  </VideoProvider>
);
