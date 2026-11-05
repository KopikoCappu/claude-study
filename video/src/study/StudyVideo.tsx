import React from 'react';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { PaceCtx, ease, sec, zoomBlur } from '../common';
import { PROBLEM_S, Problem } from './Problem';
import { ANY_S, Anywhere, BUILD_S, Build, OUTRO_S, Outro, POINT_S, Point, QUESTION_S, Question, TITLE_S, Title } from './Scenes';
import { LookCtx, TitleCtx, type Look } from './ui';

const T = sec(0.4);
const SCENES: { C: React.FC; s: number }[] = [
  { C: Problem, s: PROBLEM_S },
  { C: Question, s: QUESTION_S },
  { C: Title, s: TITLE_S },
  { C: Point, s: POINT_S },
  { C: Build, s: BUILD_S },
  { C: Anywhere, s: ANY_S },
  { C: Outro, s: OUTRO_S },
];

/** Total frames at a given pace (1.3 = everything 30% slower). */
export const studyTotal = (pace = 1) => SCENES.reduce((a, x) => a + sec(x.s * pace), 0) - T * (SCENES.length - 1);
export const STUDY_TOTAL = studyTotal(1);

/** Claude Study demo: the old way on a tablet (screenshot, crop, switch apps) → the question → title → lasso and ask → a 3D cell → outro. */
export type StudyProps = { handTitle: boolean; look?: Look; pace?: number };

export const StudyVideo: React.FC<StudyProps> = ({ handTitle, look = 'photo', pace = 1 }) => (
  <PaceCtx.Provider value={pace}>
  <LookCtx.Provider value={look}>
  <TitleCtx.Provider value={{ handTitle }}>
    <TransitionSeries>
      {SCENES.map(({ C, s }, i) => (
        <React.Fragment key={i}>
          <TransitionSeries.Sequence durationInFrames={sec(s * pace)}>
            <C />
          </TransitionSeries.Sequence>
          {i < SCENES.length - 1 && <TransitionSeries.Transition presentation={zoomBlur()} timing={linearTiming({ durationInFrames: T, easing: ease.inOut })} />}
        </React.Fragment>
      ))}
    </TransitionSeries>
  </TitleCtx.Provider>
  </LookCtx.Provider>
  </PaceCtx.Provider>
);
