import { Composition } from 'remotion';
import { InkBuddyDemo, TOTAL_FRAMES } from './Video';
import { CIRCLE_TOTAL, CircleVideo } from './circle/CircleVideo';
import { TOOLS_TOTAL, ToolsVideo } from './tools/ToolsVideo';
import { StudyVideo, studyTotal } from './study/StudyVideo';
import { VISION_S, VisionVideo } from './vision/Vision';

export const Root = () => (
  <>
    {/* "One desk, one take": Claude's own take on the Claude Study video. */}
    <Composition id="ClaudeStudyVision" component={VisionVideo} defaultProps={{ handTitle: false }} durationInFrames={VISION_S * 60} fps={60} width={1920} height={1080} />
    <Composition id="ClaudeStudyVisionClean" component={VisionVideo} defaultProps={{ handTitle: true }} durationInFrames={VISION_S * 60} fps={60} width={1920} height={1080} />
    {/* Claude Study demo, in two looks: photo (like the Pufferfish video) and claude.ai's ivory + serif. Clean = no title lettering, for a hand-drawn title on top. */}
    <Composition id="ClaudeStudy" component={StudyVideo} defaultProps={{ handTitle: false, look: 'photo' as const, pace: 1.1 }} durationInFrames={studyTotal(1.1)} fps={60} width={1920} height={1080} />
    <Composition id="ClaudeStudyClean" component={StudyVideo} defaultProps={{ handTitle: true, look: 'photo' as const, pace: 1.1 }} durationInFrames={studyTotal(1.1)} fps={60} width={1920} height={1080} />
    <Composition id="ClaudeStudyWarm" component={StudyVideo} defaultProps={{ handTitle: false, look: 'claude' as const, pace: 1.1 }} durationInFrames={studyTotal(1.1)} fps={60} width={1920} height={1080} />
    <Composition id="ClaudeStudyWarmClean" component={StudyVideo} defaultProps={{ handTitle: true, look: 'claude' as const, pace: 1.1 }} durationInFrames={studyTotal(1.1)} fps={60} width={1920} height={1080} />
    <Composition id="InkBuddyDemo" component={InkBuddyDemo} durationInFrames={TOTAL_FRAMES} fps={60} width={1920} height={1080} />
    <Composition id="CircleIt" component={CircleVideo} durationInFrames={CIRCLE_TOTAL} fps={60} width={1920} height={1080} />
    {/* Study tools video: one composition per topic. Pick the logo look with brand: purple | photo | indigo. */}
    <Composition id="StudyTools" component={ToolsVideo} defaultProps={{ topic: 'poker' as const, brand: 'purple' as const }} durationInFrames={TOOLS_TOTAL} fps={60} width={1920} height={1080} />
    <Composition id="StudyToolsBio" component={ToolsVideo} defaultProps={{ topic: 'bio' as const, brand: 'purple' as const }} durationInFrames={TOOLS_TOTAL} fps={60} width={1920} height={1080} />
  </>
);
