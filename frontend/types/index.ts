import { Point } from '../lib/edgeDetection';

export type Language = 'en' | 'ar';

export type PlotPoint = { x: number; y: number; isMoveTo: boolean };

export interface ElementSequence {
  id: string;
  paths: Point[][];
  points: PlotPoint[];
  startTime: number;
  duration: number;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  wordIndex?: number;
  elementType?: 'written' | 'visual';
  writingDirection?: 'auto' | 'rtl' | 'ltr';
  label?: string;
}

export interface Word {
  word: string;
  start: number;
  end: number;
}

export interface StoryboardScene {
  scene_id: string;
  scene_number: number;
  text: string;
  duration_seconds: number;
  bounds?: { minX: number; minY: number; maxX: number; maxY: number };
}
