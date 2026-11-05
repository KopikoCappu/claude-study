import React from 'react';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { ease, sec, zoomBlur } from '../common';
import { CIRCLE_S, CircleIt, END_S, End, PROBLEM_S, Problem, SKETCH_S, Sketch } from './Scenes';

const T = sec(0.4);
const SCENES: { C: React.FC; s: number }[] = [
  { C: Problem, s: PROBLEM_S },
  { C: CircleIt, s: CIRCLE_S },
  { C: Sketch, s: SKETCH_S },
  { C: End, s: END_S },
];

export const CIRCLE_TOTAL = SCENES.reduce((a, x) => a + sec(x.s), 0) - T * (SCENES.length - 1);

/** "Just circle it": the portfolio cloud and the k-mer pipeline sketch. */
export const CircleVideo: React.FC = () => (
  <TransitionSeries>
    {SCENES.map(({ C, s }, i) => (
      <React.Fragment key={i}>
        <TransitionSeries.Sequence durationInFrames={sec(s)}>
          <C />
        </TransitionSeries.Sequence>
        {i < SCENES.length - 1 && (
          <TransitionSeries.Transition presentation={zoomBlur()} timing={linearTiming({ durationInFrames: T, easing: ease.inOut })} />
        )}
      </React.Fragment>
    ))}
  </TransitionSeries>
);
