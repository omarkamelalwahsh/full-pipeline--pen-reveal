// Shared interfaces used across the server modules

export interface StoryboardStep {
  titleAr: string;
  titleEn: string;
  scriptAr: string;
  scriptEn: string;
  desc: string;
  keywords: string[];
  bounds?: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface SyncElement {
  id: string;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
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
  keywords: string[];
  bounds?: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface PipelineScene {
  scene_number: number;
  text: string;
  image_prompt: string;
  word_count: number;
}
