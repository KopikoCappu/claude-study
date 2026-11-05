import React from 'react';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { slide } from '@remotion/transitions/slide';
import { ease, sec, zoomBlur } from './common';
import { COLD_OPEN_S, ColdOpen } from './scenes/ColdOpen';
import { LOGO_S, LogoReveal, OUTRO_S, Outro } from './scenes/Brand';
import { DEMO_S, Demo } from './scenes/Demo';
import { EVERYWHERE_S, Everywhere, NO_MORE_S, NoMore, RAPID_S, Rapid } from './scenes/Punch';
import { BUILT_S, Built, HOW_S, HowItWorks } from './scenes/Info';

const T = sec(0.4); // transition length

const SCENES: { C: React.FC; s: number }[] = [
  { C: ColdOpen, s: COLD_OPEN_S },
  { C: LogoReveal, s: LOGO_S },
  { C: Demo, s: DEMO_S },
  { C: NoMore, s: NO_MORE_S },
  { C: Everywhere, s: EVERYWHERE_S },
  { C: Rapid, s: RAPID_S },
  { C: HowItWorks, s: HOW_S },
  { C: Built, s: BUILT_S },
  { C: Outro, s: OUTRO_S },
];

// one transition between each pair of scenes
const TRANSITIONS: any[] = [
  zoomBlur(),
  slide({ direction: 'from-bottom' }),
  zoomBlur(),
  slide({ direction: 'from-right' }),
  zoomBlur(),
  slide({ direction: 'from-right' }),
  zoomBlur(),
  zoomBlur(),
];

export const TOTAL_FRAMES = SCENES.reduce((a, x) => a + sec(x.s), 0) - T * TRANSITIONS.length;

export const InkBuddyDemo: React.FC = () => (
  <TransitionSeries>
    {SCENES.map(({ C, s }, i) => (
      <React.Fragment key={i}>
        <TransitionSeries.Sequence durationInFrames={sec(s)}>
          <C />
        </TransitionSeries.Sequence>
        {i < TRANSITIONS.length && (
          <TransitionSeries.Transition presentation={TRANSITIONS[i]} timing={linearTiming({ durationInFrames: T, easing: ease.inOut })} />
        )}
      </React.Fragment>
    ))}
  </TransitionSeries>
);
