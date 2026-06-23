import { useSyncExternalStore } from 'react';

// ---------------------------------------------------------------------------
// Minimal dependency-free store with a zustand-compatible `create()` surface.
// (This machine's npm/%TEMP% can't install packages right now.) To switch to
// real zustand later, delete this `create` and use:  import { create } from 'zustand'
// ---------------------------------------------------------------------------
type SetState<T> = (partial: Partial<T> | ((state: T) => Partial<T> | T)) => void;
type GetState<T> = () => T;
type Initializer<T> = (set: SetState<T>, get: GetState<T>) => T;

function create<T extends object>(initializer: Initializer<T>) {
  let state: T;
  const listeners = new Set<() => void>();

  const setState: SetState<T> = (partial) => {
    const partialNext = typeof partial === 'function' ? (partial as any)(state) : partial;
    if (partialNext === state || partialNext == null) return; // no-op (idempotent updates)
    state = Object.assign({}, state, partialNext);
    listeners.forEach((l) => l());
  };
  const getState: GetState<T> = () => state;
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };

  state = initializer(setState, getState);

  function useStore<U>(selector: (s: T) => U): U {
    return useSyncExternalStore(subscribe, () => selector(getState()), () => selector(getState()));
  }
  return Object.assign(useStore, { getState, setState, subscribe });
}

// ---------------------------------------------------------------------------
// 2x2 master grid dimensions (four 1920x1080 tiles).
export const MASTER_W = 3840;
export const MASTER_H = 2160;

export interface Quadrant {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CameraMarker extends Quadrant {
  index: number;
}

// One finished scene streamed back from the pipeline.
export interface SceneAsset {
  index: number;              // 0..3, also the quadrant order
  scene_number: number;       // 1..4
  text: string;
  imageUrl: string;           // data:image/png;base64,...  (1920x1080)
  audioUrl: string | null;    // data:audio/wav;base64,...  (null if server TTS failed)
  duration: number;           // measured audio length, or estimate if no audio
  quadrant: Quadrant;
  camera: CameraMarker;
}

export interface TimelineEntry {
  scene_number: number;
  text: string;
  quadrant: Quadrant;
  camera: CameraMarker;
  estDuration: number;
  duration: number;
}

export type PipelineStatus =
  | 'idle'
  | 'orchestrating'
  | 'generating'
  | 'stitching'
  | 'ready'
  | 'error';

// How the active voice track is produced for playback.
export type AudioMode = 'wav' | 'speech';

interface PipelineState {
  status: PipelineStatus;
  phaseLabel: string;
  totalScenes: number;
  timeline: TimelineEntry[];
  scenes: SceneAsset[];

  masterImageUrl: string | null;   // composited client-side once all scenes land
  masterAudioUrl: string | null;   // concatenated voiceover (the active audio source)
  sceneOffsets: number[];          // cumulative start time (s) of each scene
  totalDuration: number;           // full voiceover length (s)
  audioMode: AudioMode;            // 'wav' = master track, 'speech' = Web Speech fallback

  error: string | null;

  reset: () => void;
  setStatus: (status: PipelineStatus, phaseLabel?: string) => void;
  applyMeta: (totalScenes: number, timeline: TimelineEntry[]) => void;
  addScene: (scene: SceneAsset) => void;
  setMasterImage: (url: string) => void;
  setAudio: (payload: { url: string | null; offsets: number[]; total: number; mode: AudioMode }) => void;
  markReady: () => void;
  fail: (message: string) => void;
}

export const usePipelineStore = create<PipelineState>((set) => ({
  status: 'idle',
  phaseLabel: '',
  totalScenes: 4,
  timeline: [],
  scenes: [],

  masterImageUrl: null,
  masterAudioUrl: null,
  sceneOffsets: [],
  totalDuration: 0,
  audioMode: 'speech',

  error: null,

  reset: () =>
    set({
      status: 'idle',
      phaseLabel: '',
      timeline: [],
      scenes: [],
      masterImageUrl: null,
      masterAudioUrl: null,
      sceneOffsets: [],
      totalDuration: 0,
      audioMode: 'speech',
      error: null,
    }),

  setStatus: (status, phaseLabel = '') => set({ status, phaseLabel }),

  applyMeta: (totalScenes, timeline) =>
    set({ totalScenes, timeline, status: 'generating', error: null }),

  // Idempotent against duplicate / out-of-order events from connection flickers.
  addScene: (scene) =>
    set((state) => {
      if (state.scenes.some((existing) => existing.index === scene.index)) return state;
      const scenes = [...state.scenes, scene].sort((a, b) => a.index - b.index);
      return { scenes };
    }),

  setMasterImage: (masterImageUrl) => set({ masterImageUrl }),

  setAudio: ({ url, offsets, total, mode }) =>
    set({ masterAudioUrl: url, sceneOffsets: offsets, totalDuration: total, audioMode: mode }),

  markReady: () => set({ status: 'ready' }),

  fail: (message) => set({ status: 'error', error: message }),
}));
