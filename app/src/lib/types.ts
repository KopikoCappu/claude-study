// All stored coordinates are in "page space". The viewport (zoom/pan) maps page -> screen.

export type Point = [x: number, y: number, pressure: number];

export type Tool = 'pen' | 'highlighter' | 'shape' | 'eraser' | 'lasso' | 'text';

export type ShapeKind = 'line' | 'arrow' | 'rect' | 'ellipse';

export type Paper = 'blank' | 'lined' | 'grid' | 'dots';

export type Stroke = {
  id: string;
  /** shape strokes are plain polylines (no pressure), drawn with a fixed width */
  tool: 'pen' | 'highlighter' | 'shape';
  color: string;
  size: number;
  points: Point[];
  /** true when pressure came from a real stylus (S Pen); otherwise we simulate it */
  stylus: boolean;
  /** When it was drawn (epoch ms). Only set while recording audio, so tapping the ink can replay that moment. */
  at?: number;
};

/** `size` is the font size (default 18); it scales when the block is resized. */
export type TextBlock = { id: string; x: number; y: number; width: number; text: string; color?: string; size?: number };

/** A rendered LaTeX equation on the page. w/h are an estimate used for hit-testing and selection. */
export type MathBlock = { id: string; x: number; y: number; w: number; h: number; latex: string; color?: string; size?: number };

/** `base64` is the stored (already downscaled) original; `mime` defaults to JPEG. Locked images act as a background. */
export type PageImage = { id: string; x: number; y: number; w: number; h: number; base64: string; mime?: string; locked?: boolean };

export type Rect = { x: number; y: number; w: number; h: number };

export type AnnotationKind = 'circle' | 'box' | 'underline' | 'strike' | 'check' | 'cross' | 'highlight' | 'arrow' | 'note';

/** Something the AI drew on the page, already mapped into page space. */
export type Annotation = {
  id: string;
  kind: AnnotationKind;
  rect: Rect;
  color: string;
  text?: string;
  /** arrow only: start point in page space; the arrow points at `rect` */
  from?: [number, number];
  /** grows/shrinks with resize: note font size and mark stroke width */
  scale?: number;
  createdAt: number;
};

export type ChipImage = { base64: string; width: number; height: number; mime?: string };

/**
 * A piece of the page attached to an AI request, split into layers so Claude reads each cleanly:
 * ink alone, each image at original resolution, typed text/LaTeX as text, and (only when ink overlaps an
 * image) a combined render. Every image carries the page-space region it shows, to map annotations back.
 */
export type Chip = {
  id: string;
  /** Page-space bounds of the selection */
  bounds: Rect;
  ink?: ChipImage;
  images?: (ChipImage & { region: Rect })[];
  combined?: ChipImage;
  /** Typed text and equations inside the selection */
  text?: string;
  /** e.g. "whole page" */
  label?: string;
  /** legacy (older chats): single flattened render of `bounds` */
  image?: ChipImage;
};

/** Which layers of a selection go to the AI. */
export type Include = { ink: boolean; images: boolean; text: boolean };

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  chips?: Chip[];
  transcription?: string;
  error?: boolean;
  /** On user messages: the quick action used (ask, mistake, explain, transcribe), so Retry can repeat it. */
  mode?: 'ask' | 'mistake' | 'explain' | 'transcribe';
  /** What the AI request behind this answer used. */
  usage?: Usage;
};

/** Tokens one AI request used, from the provider. `costUsd` is an estimate at list prices (null for an unknown model). */
export type Usage = { provider: 'claude'; model: string; inputTokens: number; outputTokens: number; costUsd: number | null };

export type Page = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  strokes: Stroke[];
  texts: TextBlock[];
  maths?: MathBlock[];
  images: PageImage[];
  annotations: Annotation[];
  chat: ChatMessage[];
  paper?: Paper;
  /** page background color */
  bg?: string;
  folderId?: string | null;
  /** number of stacked Letter pages (grows with "Add page" or content); default 1 */
  pageCount?: number;
  /** Set when the note is in Recently deleted (it's removed for good 30 days later). */
  deletedAt?: number;
  /** Pinned notes stay at the top of the notes home. */
  pinned?: boolean;
  /** Handwriting turned into text so search can find it. */
  inkIndex?: InkIndexEntry[];
  recordings?: Recording[];
  /** Interactive practice tools the AI built for this note (shown in the Tools pane). */
  tools?: StudyTool[];
};

/** An AI-built practice tool: one self-contained HTML page that runs in a sandbox beside the note. */
export type StudyTool = {
  id: string;
  title: string;
  prompt: string;
  html: string;
  createdAt: number;
  updatedAt: number;
  /** The latest build, fix or change. */
  lastUsage?: Usage;
  /** Everything spent on this tool so far (every build, fix and change). */
  spent?: { tokens: number; costUsd: number | null };
  /** Earlier versions, oldest first (kept when the tool is changed or fixed, so a change can be undone for free). */
  versions?: { title: string; html: string; savedAt: number }[];
  /** Set when this tool was copied from another note: the original tool's id. */
  sourceId?: string;
};

/** An audio recording made while taking this note. The audio itself stays on the device that recorded it. */
export type Recording = { id: string; startedAt: number; durationMs: number; mime: string; title?: string };

/** Handwriting read by the AI for search, per page of the note. `sig` says which strokes it was read from. */
export type InkIndexEntry = { page: number; text: string; sig: string };

export type Folder = { id: string; name: string; color?: string; createdAt: number; updatedAt?: number };

export type Selection = {
  strokeIds: string[];
  textIds: string[];
  mathIds: string[];
  imageIds: string[];
  /** AI notes and marks */
  annotationIds?: string[];
  bounds: Rect;
};
