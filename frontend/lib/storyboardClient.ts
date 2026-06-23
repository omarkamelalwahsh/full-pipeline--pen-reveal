import {
  usePipelineStore,
  MASTER_W,
  MASTER_H,
  type SceneAsset,
  type TimelineEntry,
  type AudioMode,
} from '../store/pipelineStore';

export interface StoryboardRequest {
  script: string;
  voiceName?: string;
}

// Decode an image fully into memory before we rely on it (texture preloader).
export function preloadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      try {
        if (typeof img.decode === 'function') await img.decode();
      } catch {
        /* decode() is best-effort; onload already fired so the bitmap exists */
      }
      resolve(img);
    };
    img.onerror = () => reject(new Error('Image failed to load into memory.'));
    img.src = src;
  });
}

// Composite the four 1920x1080 tiles into the 3840x2160 master grid in-browser.
async function stitchMasterGrid(scenes: SceneAsset[]): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = MASTER_W;
  canvas.height = MASTER_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not acquire a 2D context to stitch the master grid.');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, MASTER_W, MASTER_H);

  const tiles = await Promise.all(scenes.map((s) => preloadImage(s.imageUrl)));
  scenes.forEach((scene, i) => {
    const { x, y, w, h } = scene.quadrant;
    ctx.drawImage(tiles[i], x, y, w, h);
  });

  return canvas.toDataURL('image/png');
}

// ---- master voiceover assembly -------------------------------------------

function base64FromBytes(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// Encode mono float samples as a 16-bit PCM WAV.
function encodeWavMono(samples: Float32Array, sampleRate: number): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);          // PCM
  view.setUint16(22, 1, true);          // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return bytes;
}

// Concatenate all scene WAVs into ONE master voiceover track (the active audio
// source). If any scene lacks server audio, we fall back to Web Speech mode and
// only return the per-scene time offsets so the playhead still tracks the voice.
async function buildMasterAudio(
  scenes: SceneAsset[],
): Promise<{ url: string | null; offsets: number[]; total: number; mode: AudioMode }> {
  const haveAllAudio = scenes.every((s) => !!s.audioUrl);

  if (!haveAllAudio) {
    let t = 0;
    const offsets = scenes.map((s) => {
      const start = t;
      t += Math.max(0.4, s.duration);
      return start;
    });
    return { url: null, offsets, total: t, mode: 'speech' };
  }

  const AudioCtor: typeof AudioContext =
    window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioCtor();
  try {
    const buffers = await Promise.all(
      scenes.map(async (s) => {
        const ab = await (await fetch(s.audioUrl as string)).arrayBuffer();
        return ctx.decodeAudioData(ab);
      }),
    );

    const sampleRate = buffers[0].sampleRate;
    const totalLen = buffers.reduce((acc, b) => acc + b.length, 0);
    const out = new Float32Array(totalLen);

    const offsets: number[] = [];
    let pos = 0;
    let tAcc = 0;
    for (const b of buffers) {
      offsets.push(tAcc);
      out.set(b.getChannelData(0), pos);
      pos += b.length;
      tAcc += b.length / sampleRate;
    }

    const wavBytes = encodeWavMono(out, sampleRate);
    const url = `data:audio/wav;base64,${base64FromBytes(wavBytes)}`;
    return { url, offsets, total: tAcc, mode: 'wav' };
  } finally {
    await ctx.close().catch(() => {});
  }
}

// ---- SSE transport over fetch (POST body → can't use EventSource) ---------

function dispatchSseRecord(record: string) {
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of record.split('\n')) {
    if (line.startsWith(':')) continue;
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return;

  let data: any;
  try {
    data = JSON.parse(dataLines.join('\n'));
  } catch {
    return;
  }

  const store = usePipelineStore.getState();
  switch (event) {
    case 'status':
      store.setStatus(store.status === 'idle' ? 'orchestrating' : store.status, data.phase ?? '');
      break;
    case 'meta':
      store.applyMeta(data.totalScenes ?? 4, (data.timeline ?? []) as TimelineEntry[]);
      break;
    case 'scene':
      store.addScene({ audioUrl: null, ...data } as SceneAsset);
      break;
    case 'error':
      store.fail(data.message ?? 'Unknown pipeline error.');
      break;
    case 'done':
      break;
  }
}

export async function runStoryboardPipeline(
  payload: StoryboardRequest,
  signal?: AbortSignal,
): Promise<void> {
  const store = usePipelineStore.getState();
  store.reset();
  store.setStatus('orchestrating', 'Partitioning script into 4 scenes…');

  const res = await fetch('/api/generate-storyboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok || !res.body) {
    throw new Error(`Pipeline request failed (HTTP ${res.status}).`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary: number;
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const record = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      dispatchSseRecord(record);
    }
  }

  const finalState = usePipelineStore.getState();
  if (finalState.status === 'error') return;

  if (finalState.scenes.length !== finalState.totalScenes) {
    usePipelineStore
      .getState()
      .fail(`Stream closed with ${finalState.scenes.length}/${finalState.totalScenes} scenes.`);
    return;
  }

  // Compose visual master + voiceover master, preload, then flip to ready.
  usePipelineStore.getState().setStatus('stitching', 'Composing master grid & voiceover…');
  const [master, audio] = await Promise.all([
    stitchMasterGrid(finalState.scenes),
    buildMasterAudio(finalState.scenes),
  ]);
  await preloadImage(master);
  usePipelineStore.getState().setMasterImage(master);
  usePipelineStore.getState().setAudio(audio);
  usePipelineStore.getState().markReady();
}
