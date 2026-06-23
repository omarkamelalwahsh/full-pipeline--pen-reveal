import { useEffect, useRef, useState } from 'react';
import { usePipelineStore } from '../store/pipelineStore';
import { runStoryboardPipeline, preloadImage } from '../lib/storyboardClient';
import { detectEdgesAndExtractPaths, type Point } from '../lib/edgeDetection';

// Hand holding a marker; nib tip is at ~(12%, 12%) of the sprite so it lands on
// the live draw point (Golpo-style "pen in hand").
const HAND_PEN_DATA_URL =
  "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"150\" height=\"150\" viewBox=\"0 0 100 100\" fill=\"none\">" +
  "<line x1=\"13\" y1=\"13\" x2=\"52\" y2=\"52\" stroke=\"%23111827\" stroke-width=\"10\" stroke-linecap=\"round\"/>" +
  "<line x1=\"13\" y1=\"13\" x2=\"52\" y2=\"52\" stroke=\"%236366f1\" stroke-width=\"6.5\" stroke-linecap=\"round\"/>" +
  "<line x1=\"16\" y1=\"16\" x2=\"24\" y2=\"24\" stroke=\"%23f59e0b\" stroke-width=\"6.6\"/>" +
  "<circle cx=\"12\" cy=\"12\" r=\"2.4\" fill=\"%23111827\"/>" +
  "<path d=\"M45 43 C54 38 70 44 80 57 C89 68 87 86 75 90 C62 94 49 88 43 75 C39 66 37 49 45 43 Z\" fill=\"%23f7c9a3\" stroke=\"%23111827\" stroke-width=\"1.8\"/>" +
  "<path d=\"M48 49 q7 -6 14 -3\" stroke=\"%23b07a52\" stroke-width=\"1.4\"/>" +
  "<path d=\"M52 56 q7 -6 14 -2\" stroke=\"%23b07a52\" stroke-width=\"1.4\"/>" +
  "<path d=\"M56 63 q7 -5 14 -1\" stroke=\"%23b07a52\" stroke-width=\"1.4\"/>" +
  "<path d=\"M70 86 L88 94 L94 82 L78 74 Z\" fill=\"%234f46e5\" stroke=\"%23111827\" stroke-width=\"1.6\"/></svg>";

const STAGE_W = 1280;
const STAGE_H = 720;
const NIB_X = 0.12; // nib position inside the hand sprite
const NIB_Y = 0.12;

// Low-res working buffer for edge detection (fast + clean centerlines).
const TRACE_W = 480;
const TRACE_H = 270;

const VOICES = ['Kore', 'Puck', 'Fenrir', 'Charon', 'Aoede'];

interface TracedScene {
  paths: Point[][];        // already scaled into STAGE space
  total: number;           // total point count across all paths
  img: HTMLImageElement;   // the scene's own full illustration (final clean frame)
}

// Extract the drawing paths of a scene image (skeleton centerlines = the lines a
// pen would actually draw) and keep the image for the clean final frame.
async function computeScene(imageUrl: string): Promise<TracedScene> {
  const img = await preloadImage(imageUrl);
  const c = document.createElement('canvas');
  c.width = TRACE_W;
  c.height = TRACE_H;
  const cx = c.getContext('2d');
  if (!cx) return { paths: [], total: 0, img };

  cx.fillStyle = '#ffffff';
  cx.fillRect(0, 0, TRACE_W, TRACE_H);
  cx.drawImage(img, 0, 0, TRACE_W, TRACE_H);

  const imageData = cx.getImageData(0, 0, TRACE_W, TRACE_H);
  const { rawPaths } = detectEdgesAndExtractPaths(imageData, 2, 1, 'skeleton', 55);

  const sx = STAGE_W / TRACE_W;
  const sy = STAGE_H / TRACE_H;
  const paths = rawPaths
    .filter((p) => p.length > 3)
    .map((p) => p.map((pt) => ({ x: pt.x * sx, y: pt.y * sy })));
  const total = paths.reduce((acc, p) => acc + p.length, 0);
  return { paths, total, img };
}

// DRAW the ink line up to `progress`: a black line is created stroke-by-stroke at
// the pen tip (real drawing, not revealing a finished image). Smooth quadratic
// curves, honoring pen lifts. Returns the live pen head.
function drawInk(
  ctx: CanvasRenderingContext2D,
  traced: TracedScene,
  progress: number,
  lineWidth: number,
): Point | null {
  let budget = Math.floor(progress * traced.total);
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  let head: Point | null = null;
  for (const path of traced.paths) {
    if (budget <= 0) break;
    const n = Math.min(path.length, budget);
    budget -= n;
    if (n < 2) continue;
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < n; i++) {
      const prev = path[i - 1];
      const cur = path[i];
      ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + cur.x) / 2, (prev.y + cur.y) / 2);
    }
    ctx.stroke();
    head = path[n - 1];
  }
  return head;
}

export default function StoryboardStage() {
  const status = usePipelineStore((s) => s.status);
  const phaseLabel = usePipelineStore((s) => s.phaseLabel);
  const scenes = usePipelineStore((s) => s.scenes);
  const totalScenes = usePipelineStore((s) => s.totalScenes);
  const masterAudioUrl = usePipelineStore((s) => s.masterAudioUrl);
  const audioMode = usePipelineStore((s) => s.audioMode);
  const error = usePipelineStore((s) => s.error);

  const [script, setScript] = useState(
    'Take a flat ordinary piece of paper and fold it into a sharp triangle. Launch it into the air with a sudden push. ' +
      'The invisible wind catches its wings and lifts it high. Finally the energy fades and it glides gently back down to rest.',
  );
  const [voiceName, setVoiceName] = useState('Kore');
  const [isPlaying, setIsPlaying] = useState(false);
  const [readyCount, setReadyCount] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const penImgRef = useRef<HTMLImageElement | null>(null);
  const sceneRef = useRef<Map<number, TracedScene>>(new Map());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const clockStartRef = useRef(0);
  const spokenIdxRef = useRef(-1);
  const rafRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isBusy = status === 'orchestrating' || status === 'generating' || status === 'stitching';
  const canPlay = status === 'ready' && readyCount === scenes.length && scenes.length > 0;

  // Load the hand-in-pen sprite once.
  useEffect(() => {
    const pen = new Image();
    pen.onload = () => { penImgRef.current = pen; };
    pen.src = HAND_PEN_DATA_URL;
  }, []);

  // The active voiceover audio source (single master track).
  useEffect(() => {
    if (!masterAudioUrl) { audioRef.current = null; return; }
    const audio = new Audio(masterAudioUrl);
    audio.preload = 'auto';
    audioRef.current = audio;
    const onEnded = () => setIsPlaying(false);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.pause();
      audio.removeEventListener('ended', onEnded);
      audioRef.current = null;
    };
  }, [masterAudioUrl]);

  // Edge-detect every scene image once the assets are ready.
  useEffect(() => {
    if (status !== 'ready') {
      sceneRef.current.clear();
      setReadyCount(0);
      return;
    }
    let cancelled = false;
    (async () => {
      for (const scene of scenes) {
        if (sceneRef.current.has(scene.index)) continue;
        const traced = await computeScene(scene.imageUrl);
        if (cancelled) return;
        sceneRef.current.set(scene.index, traced);
        setReadyCount(sceneRef.current.size);
      }
    })();
    return () => { cancelled = true; };
  }, [status, scenes]);

  useEffect(() => () => {
    abortRef.current?.abort();
    window.speechSynthesis?.cancel();
  }, []);

  const speakScene = (text: string) => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = /[؀-ۿ]/.test(text) ? 'ar-SA' : 'en-US';
    synth.speak(utter);
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    window.speechSynthesis?.cancel();
  };

  const startPlayback = () => {
    if (!canPlay) return;
    spokenIdxRef.current = -1;
    if (audioMode === 'wav' && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } else {
      window.speechSynthesis?.cancel();
      clockStartRef.current = performance.now();
    }
    setIsPlaying(true);
  };

  const generate = async () => {
    stopPlayback();
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await runStoryboardPipeline({ script, voiceName }, controller.signal);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        usePipelineStore.getState().fail(err?.message || 'Pipeline failed.');
      }
    }
  };

  // ---- Render loop: per scene, the pen DRAWS its own illustration as a growing
  // black ink line, paced to that scene's audio. No grid, no reveal. ----
  useEffect(() => {
    if (!isPlaying) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const getClock = () =>
      audioMode === 'wav' && audioRef.current
        ? audioRef.current.currentTime
        : (performance.now() - clockStartRef.current) / 1000;

    const tick = () => {
      const st = usePipelineStore.getState();
      const offsets = st.sceneOffsets;
      const total = st.totalDuration;
      const sceneList = st.scenes;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, STAGE_W, STAGE_H);

      if (sceneList.length === 0 || offsets.length === 0) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const clock = getClock();
      let idx = 0;
      for (let i = 0; i < sceneList.length; i++) if (clock >= offsets[i]) idx = i;
      const sceneStart = offsets[idx];
      const dur = (idx < offsets.length - 1 ? offsets[idx + 1] : total) - sceneStart;
      const progress = Math.max(0, Math.min(1, (clock - sceneStart) / Math.max(0.4, dur)));

      if (st.audioMode === 'speech' && spokenIdxRef.current !== idx) {
        spokenIdxRef.current = idx;
        speakScene(sceneList[idx].text);
      }

      const traced = sceneRef.current.get(sceneList[idx].index);
      if (traced) {
        // Draw the ink line stroke-by-stroke at the pen tip.
        const head = drawInk(ctx, traced, progress, Math.max(3, STAGE_W / 320));
        const pen = penImgRef.current;
        if (head && pen && progress < 1) {
          const penH = STAGE_H * 0.24;
          const penW = penH * (pen.width / pen.height || 1);
          ctx.drawImage(pen, head.x - penW * NIB_X, head.y - penH * NIB_Y, penW, penH);
        }
      }

      const ended =
        audioMode === 'wav'
          ? (audioRef.current?.ended ?? false) || clock >= total - 0.03
          : clock >= total;

      if (ended) {
        const last = sceneList[sceneList.length - 1];
        const lastTraced = sceneRef.current.get(last.index);
        if (lastTraced) drawInk(ctx, lastTraced, 1, Math.max(3, STAGE_W / 320));
        setIsPlaying(false);
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isPlaying, audioMode]);

  return (
    <div className="min-h-screen bg-[#f4f5f8] text-slate-800 p-6 flex flex-col gap-5 items-center">
      <div className="w-full max-w-5xl flex flex-col gap-4">
        <h1 className="text-lg font-bold tracking-tight">
          Lumina Studio <span className="text-indigo-600 font-normal">· Pen-in-Hand Storyboard</span>
        </h1>

        {/* Controls */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            rows={3}
            dir="auto"
            placeholder="Type your story — each scene becomes its own illustration drawn by hand…"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-indigo-500 resize-none"
          />
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Voice</label>
            <select
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-indigo-500"
            >
              {VOICES.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>

            <button
              type="button"
              onClick={generate}
              disabled={isBusy || !script.trim()}
              className="ml-auto px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold shadow-sm transition-colors"
            >
              {isBusy ? 'Generating…' : 'Generate'}
            </button>
            <button
              type="button"
              onClick={isPlaying ? stopPlayback : startPlayback}
              disabled={!canPlay && !isPlaying}
              className="px-4 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40 text-indigo-700 text-sm font-bold border border-indigo-100 transition-colors"
            >
              {isPlaying ? 'Stop' : 'Play ✍️'}
            </button>
          </div>

          {/* Progress / status */}
          <div className="flex items-center gap-3 text-xs">
            <span className={
              status === 'error' ? 'text-rose-600 font-bold'
                : status === 'ready' ? 'text-green-600 font-bold'
                : 'text-indigo-600 font-semibold'
            }>
              {status.toUpperCase()}
            </span>
            {phaseLabel && <span className="text-slate-500">{phaseLabel}</span>}
            {(status === 'generating' || status === 'stitching') && (
              <span className="text-slate-500 font-mono">{scenes.length}/{totalScenes} scenes</span>
            )}
            {status === 'ready' && (
              <span className="text-slate-500 font-mono">
                voice: {masterAudioUrl ? 'master WAV' : 'Web Speech'} · ready {readyCount}/{scenes.length}
              </span>
            )}
            {error && <span className="text-rose-600">{error}</span>}
          </div>
        </div>

        {/* Live scene strip: each scene's own illustration as it streams in */}
        <div className="flex gap-2 w-full overflow-x-auto">
          {Array.from({ length: totalScenes }).map((_, i) => {
            const scene = scenes.find((s) => s.index === i);
            return (
              <div
                key={i}
                className="aspect-video w-40 shrink-0 rounded-lg border border-slate-200 bg-white overflow-hidden flex items-center justify-center relative"
              >
                {scene ? (
                  <img src={scene.imageUrl} alt={`Scene ${i + 1}`} className="w-full h-full object-contain" />
                ) : (
                  <span className="text-[10px] text-slate-400 font-mono">Scene {i + 1}</span>
                )}
                <span className="absolute top-1 left-1 text-[9px] font-bold bg-slate-900/70 text-white rounded px-1">
                  {i + 1}
                </span>
              </div>
            );
          })}
        </div>

        {/* Drawing stage — the pen draws each scene as a growing ink line */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
          <canvas
            ref={canvasRef}
            width={STAGE_W}
            height={STAGE_H}
            className="w-full rounded-xl border border-slate-100 bg-white aspect-video"
          />
        </div>
      </div>
    </div>
  );
}
