# Lumina / Pen-Reveal Studio — Complete Build Specification

A whiteboard "pen-in-hand" explainer studio (Golpo-style). A user types a script;
the app segments it into scenes, generates a storyboard illustration, and a hand
holding a marker **draws** each scene as a growing black ink line, synced to an
AI narration voice.

---

## 0. Tech Stack

- **Frontend:** React 19 + TypeScript + Vite, Tailwind CSS v4, `lucide-react` icons, `motion/react` (Framer Motion) for animation. State via React hooks (`useState`/`useRef`) inside one main `Workspace` component. HTML5 `<canvas>` 2D rendering engine.
- **Backend:** Express (Node, TypeScript via `tsx`), `@google/genai` (Gemini), `multer` for uploads. Stateless, RAM-only (no DB). All media returned as base64 **data URLs** (never written to disk).
- **AI models:** `gemini-2.5-flash` (text/segmentation/JSON), `imagen-4.0-generate-001` → `gemini-3.1-flash-image` → `gemini-2.5-flash-image` (image, with fallback chain), `gemini-3.1-flash-tts-preview` (TTS).
- **Export:** FFmpeg.wasm (client-side).
- **Entry:** dev = `tsx backend/index.ts`; the single Express app serves the API and (in dev) the Vite middleware.

---

## 1. Design System

- **Page background:** `#f4f5f8` (light blue-gray). **Surfaces:** white. **Primary text:** `slate-800` (`#1e293b`).
- **Brand / primary accent:** `indigo-600` (`#4f46e5`). Primary buttons = solid `indigo-600` + white text, hover `indigo-700`. Secondary = `indigo-50` bg + `indigo-700` text.
- **Destructive (Delete / Reset / active Eraser):** `rose-600` / `rose-50`.
- **Status:** success `green-500`, warning `amber-500`/`amber-50`.
- **Borders:** `slate-200`. **Muted text:** `slate-400`/`slate-500`. Rounded corners (`rounded-lg`/`xl`/`2xl`/`3xl`), soft shadows.
- **Rule:** only valid Tailwind shades (50,100,…,900,950) — never invent shades like 505/650/350.
- Bilingual EN/AR with full RTL flip (`dir` + `isRtl`). Direction toggles the whole layout.

---

## 2. Layout (top → bottom). Every region, every control, its place and job.

### 2.1 HEADER — `h-16`, white, bottom border `slate-200`, `z-30`
- **Left:** a `32px` rounded square (`indigo-50` bg, `indigo-100` border) containing a pulsing `indigo-600` dot; then brand wordmark **"Pen-Reveal"** in slate-800 + **"Studio"** in `indigo-600`.
- **Center (conditional):** a progress bar shown only while exporting/processing — tiny uppercase label + `%` in `indigo-600`, with an `indigo-600` fill bar on a `slate-100` track.
- **Right cluster (left→right):**
  1. **Language toggle** — `slate-50` pill, `Languages` icon (indigo-600), label "عربي"/"English". Switches `lang`.
  2. **Share / Invite** — `indigo-50` pill, `Link` icon, opens the Share modal.
  3. **Auto ✨** (primary one-click) — gradient `indigo-600→purple-600`, `Sparkles` icon (or spinner). Label cycles **Auto ✨ → Building… → Voicing…**. Runs the entire pipeline automatically (see §3.1). Disabled while busy or if script is empty.
  4. **Generate Export** — solid `indigo-600`, `Download` icon (or spinner). Renders/export the video. Disabled until an image exists.

### 2.2 LEFT TAB RAIL — `w-20`, white, border-r, `z-30`
Three stacked icon buttons (each `56px`, icon + tiny label):
1. **Assets** — `UploadCloud` icon.
2. **Script** — `Sparkles` icon.
3. **Adjust** — `Settings` (gear) icon.
Active tab = `indigo-50` bg + `indigo-700` text + a small `indigo-600` vertical bar on the inner edge (right in LTR / left in RTL). Clicking the active tab again closes the drawer. **The gear lives only here** (not mixed with drawing tools).

### 2.3 SLIDE-OUT DRAWER — `w-340`, white, animates open beside the rail, `z-20`
Header row: section title + a "Close" text button.

**ASSETS tab:**
- **AI Storyboard Creator** card (`slate-50` bg, `slate-200` border):
  - EMPTY state: a `textarea` (`scriptInput`) + two buttons: **Create Storyboard** (solid indigo) and **Edit Storyboard** (disabled).
  - PROCESSING state: spinner + "Generating Storyboard…".
  - ACTIVE state: "Active Storyboard (N Scenes)" + **Reset** (rose); a scrollable scene list (selected scene = indigo); when a scene is selected, an editable `textarea` + **Edit Storyboard** button.
- **Custom Media Uploads** (below a divider):
  - **Main Image** — `128px` dashed dropzone (shows preview when set) + **"Load Demo Art 🍌"** button.
  - **Pen Overlay** — dashed dropzone, `ImageIcon`, "Select Transparent PNG Pen".
  - **Audio Asset** — a segmented toggle **Upload Audio / Write Script**:
    - Upload: dashed dropzone for an audio file.
    - Write: a Narrator Voice `select` (**Kore / Puck / Fenrir / Charon / Aoede**) + a script `textarea` + **"Generate Storytelling Voice 🎙️"** (solid indigo). After generation: an indigo card with a Play/Pause button + `currentTime / duration`.

**SCRIPT tab:**
- **AI Storyboard** card:
  - **AI Image Engine** toggle: **Free Gemini (Vector SVG)** / **Paid Imagen-3 (PNG)**. (Note: the Auto flow forces the real image model regardless.)
  - **Visual Style** grid (2-col, selectable): `Auto-select, Comic Strip, Kawaii, Clay, Sketch Note, Anime, Editorial, Instructional, Bento Grid, Bricks, Scientific, Professional`.
  - **Analyze Audio & Generate 🔮** (solid indigo; disabled/help-cursor if no transcription).
  - Error banner (rose) and a collapsible "AI Design Prompt" `details`.
- **Gemini 2.5 Image Editor** card: small image preview labeled "Active Image Target" + an edit-instruction `textarea` + **"Apply Magic Edit ✨"** (solid indigo). Shows "Gemini-2.5" badge; error banner.

**ADJUST tab:**
- **Animation Logic** card:
  - Draw-style toggle: **Outline (Thin)** / **Paint (Thick)**.
  - Sliders (all `accent-indigo-600`, value shown right in indigo mono): **Default Pen Speed** (1–100; shows "Optimized by AI" + disabled when storyboard ACTIVE), **Edge Sensitivity** (1–100; re-extracts on release), **Bloom Radius** (0–100px), **Base Opacity** (0–50%).
  - **Drawing Direction** select (Default / LTR / RTL / Top-to-Bottom / Bottom-to-Top).
  - **Canvas Background** select (Black `#050505` / White `#ffffff` / Transparent).
- **Audio Timeline Mapping** (only if audio): single `Volume2` icon + **Auto-Sync Elements** button + word chips (mapped = indigo-50, selected = solid indigo). Click an element then a word to map.
- **Pen Calibration** card: sliders **Scale** (5–50%), **Tip X Offset** (0–100%), **Tip Y Offset** (0–100%).

### 2.4 CENTER CANVAS — flex-1, dotted "whiteboard" dot background
A `16:9` white rounded card (`max-w-5xl`, `rounded-3xl`, shadow) holding the `<canvas>`. Overlays:
- **Floating LEFT vertical toolbar** (white rounded pill, vertically centered on the canvas's left, `z-30`): **Select** (`MousePointer`), **Brush** (pen, `Brush`), **Eraser** (`Eraser`), a divider, **Settings** (`Settings` gear → opens Adjust). Active drawing tool = `indigo-50` + indigo icon; active Eraser = `rose-50` + rose icon.
- **Floating BOTTOM-CENTER horizontal toolbar** (white pill, `z-30`): **Preview Sequence** (indigo-50, Play/Pause) | **Analyze Assets** (ghost) | **Reset** (rose text). Reset clears everything.
- **Empty state:** centered white card with a bouncing `Sparkles`, "Welcome to StoryFlow Workspace", and instructions.
- **Camera scene badge (top-right, while playing):** dark pill `slate-900/75` with a pulsing red dot + "Camera: {scene label} Active".
- The `<canvas>` fills the card; in selection mode the cursor is a crosshair.

### 2.5 BOTTOM TIMELINE — `h-48`, white, border-t, `z-10`
- **Controls header** (`h-10`, `slate-50`): **Play/Pause** (solid indigo square), **Rewind/Clear** (white, `Undo2`), a divider, "Time: x.x s / y.y s" (mono). Right: `AudioLines` icon + "Voiceover Active / No Voiceover Audio".
- **Scrollable tracks** (30px per second):
  - **Playhead:** thin `indigo-500` vertical line + an `indigo-600` diamond at top, positioned at `80 + currentTime*30` px.
  - **Time Ruler** (`h-6`): `MM:SS` ticks every 2s; clicking seeks.
  - **Scenes track** (`h-16`): label "Scenes" + an **Add scene (+)** button; then one block per element — left/right **resize handles**, a thumbnail (cropped to the element's bounds) overlaid with an **indigo SVG path preview**, the label, the duration, a hover **delete X** (rose circle, top-right). Selected block = `indigo-50` + indigo border + ring. Blocks are draggable (move) and resizable.
  - **Voiceover waveform track** (`h-10`): label "Voiceover" + faux waveform bars — `indigo-500` when audio loaded, else `slate-300`.

### 2.6 RIGHT SIDEBAR — `w-80`, white, border-l, `z-20` (only when elements exist)
- **Normal (Layers) mode:** header (`Layers` icon + "Extracted Elements" + a Brush button to enter manual selection + a count badge). Help text. A row of **FPS** (15–60) and **Total (s)** (1–1800) number inputs. Then a scrollable list of element cards:
  - Reorder ▲▼, a `Check` when selected, the label, a "N pts" badge, a `Trash2` delete.
  - If mapped to a word: an indigo pill "Mapped to '{word}'".
  - **Start (s)** and **Dur (s)** number inputs (indigo mono).
  - When selected: **Element Type** toggle (Written ✍️ / Visual 🖼️) + **Writing Direction** select (Auto / English LTR / Arabic RTL).
- **Manual Selection mode:** title + **Exit Selection** (indigo); a **Brush Size** slider (5–100px); **Brush Mode / Eraser** toggle; **Add Element**; a list of element pick buttons each with a delete.

### 2.7 FOOTER — `h-10`, white, border-t
Left: "FFmpeg.wasm Embedded" · "Client-Side Render". Right: pulsing `green-500` dot + "System Active".

### 2.8 SHARE MODAL — centered, blurred backdrop
White `rounded-3xl` card with a top gradient bar (`indigo-500 → purple-500 → pink-500`), a close `X`, title + `Link` icon. Two sections:
- **On Same Wi-Fi / Local Network:** read-only link field + **Copy Link** + a QR code.
- **Over Public Internet (Tunnel):** if not started, **Generate Public Link 🌐** (solid indigo); once started, link + Copy + QR + an amber warning note with the machine's public IP.

---

## 3. Logic / Pipeline

### 3.1 The Auto (one-click) flow — `runAutoStudio()`
1. Copy `scriptInput` → `scriptText`; set phase `creating`.
2. `await handleCreateStoryboard()`.
3. **Effect A** — when the storyboard is ACTIVE, not processing, and elements have drawable points (extraction done) → set phase `voicing` and call `generateNarratorVoice(scriptInput)`.
4. **Effect B** — when `audioUrl` is set and voice generation finished → reset to time 0 and **start playback** (drawing + voice in sync).
The button label reflects the phase (Building… / Voicing…).

### 3.2 Storyboard creation — `handleCreateStoryboard()`
1. `POST /api/pipeline/create { script }` → returns **N scenes (3–6, dynamic to the script)**, each with `scene_id`, `text`, `duration_seconds`, `keywords`, and **grid `bounds`** (laid out by `computeGridBounds(N)` in a 1920×1080 design space).
2. Build N timeline elements (cumulative `startTime`, `bounds` scaled to canvas), `elementType: 'written'`.
3. `POST /api/generate-storyboard-image { text, style, bgColor:'white', useFreeModel:false, sceneCount:N }` → returns **one master illustration** + `steps`. Forces the real image model (no raw-SVG path). Sets `mainImgUrl`, flags `autoExtractPendingRef`.
4. On image load → `prepareAnimation()` runs **edge detection** on the master, **buckets** the paths into the **same N scene regions** (by proximity to the element bounds; generic grid fallback), excludes full-width borders, and builds N elements with `points` (via `flattenPaths`) and bounds. Pen speed becomes **AI-optimized** = `totalStrokePoints / sceneAudioDuration`.

### 3.3 Backend endpoints (Express)
- `POST /api/pipeline/create` — `gemini-2.5-flash` + strict JSON schema → 3–6 scenes (heuristic sentence/paragraph fallback). Adds grid bounds.
- `POST /api/generate-storyboard-image` — expands the script into one detailed English image prompt (`gemini-2.5-flash`), appends a HARD rule: *no text/letters/numbers/hex codes/labels/captions/borders/frames; BOLD thick high-contrast black ink lines on pure white; fill each of the N areas with a large detailed drawing*. Then tries `imagen-4.0` → `gemini-3.1-flash-image` → `gemini-2.5-flash-image`; only if all fail, a procedural vector SVG fallback. Accepts `sceneCount` so the panel count matches the segmentation. (`parseScriptIntoSteps(text, N)` builds N labeled steps.)
- `POST /api/generate-narrator-audio` — `gemini-3.1-flash-tts-preview` → PCM→WAV data URL, plus **word-level transcription** (timestamps) and duration.
- `POST /api/generate-storyboard` (SSE) — alternate "one image **per scene**" pipeline (orchestrate → per-scene real image + per-scene TTS streamed as each completes). Present but not used by the main Workspace flow.
- `POST /api/transcribe`, `POST /api/sync-elements`, `POST /api/segment-image`, `POST /api/edit-image` (Gemini 2.5 edit), `GET /api/network-info`, `POST /api/start-tunnel`.

### 3.4 Drawing mechanic — `drawCanvas(time)` (the heart)
- Determines the **active scene** from `time` and isolates to **only that scene's bounding box**: integer-snapped `minX/minY/w/h`, integer-rounded camera translate, `ctx.rect(...) ; ctx.clip()` **before** drawing — so adjacent scenes never bleed in. Camera scales the active box to fill the viewport (90%).
- Background: fills `canvasBgColor`, then draws the master image at **Base Opacity** (faint ghost) inside the clip.
- **The pen DRAWS (not reveals):** storyboard scenes are `elementType: 'written'` → they go to the **outline mask** and are stroked as **solid black ink lines** (`strokeSmoothed()` uses `quadraticCurveTo` through midpoints, honoring pen-lifts) up to the current `progress`. (`'visual'` would instead reveal the photo via a wide paint brush = "inking" — not wanted.)
- A **hand-holding-a-marker** sprite (default `FALLBACK_PEN`, an inline SVG; nib at 12%/12%) is drawn at the live draw head, so it looks like a hand sketching. Position/size tunable via Pen Calibration (Scale / Tip X / Tip Y).
- Progress per scene = elapsed-in-scene × pen-speed; the line grows stroke-by-stroke. When a scene completes it switches to the next (canvas isolates the new scene).

### 3.5 Audio sync
- One master narration WAV is the clock; `currentTime` drives both the playhead and the drawing progress. Scene durations are scaled so the storyboard total matches the audio length (`scaleTotalDuration`). Word-level timestamps allow element↔word mapping (manual or Auto-Sync). Web Speech API is the fallback voice if TTS is unavailable.

---

## 4. Hard Rules (must-haves)

1. **Drawing tools** (pointer/pen/eraser) are grouped together on the floating left toolbar and are **separate from the Settings gear** (gear lives only in the left tab rail).
2. **One icon per action**, never duplicated.
3. **Valid Tailwind color shades only.**
4. **Per-scene isolation:** strict integer-rounded clip rect before any camera translate or image draw — no cross-scene bleed.
5. **Image generation = real image model**, never raw LLM-authored SVG; the image must contain **zero text/numbers/labels/borders**, bold black line-art on white.
6. **Scene count is dynamic and consistent** across segmentation, image panels, and extraction (one source of truth = the segmentation count N).
7. **The pen draws the ink line** (outline strokes growing at the tip), it does not reveal/uncover a finished image.
8. Stateless backend, RAM-only, everything as base64 data URLs (no disk writes — disk writes also break Vite HMR).

---

## 5. Current file map (logical)

- Backend: `backend/index.ts` (Express app + all routes + helpers: `computeGridBounds`, `parseScriptIntoSteps`, `generateContentWithRetry`, `pcmToWav`, image/TTS helpers). (Historically `server.ts`.)
- Frontend: `frontend/` (was `src/`): `Workspace.tsx` (the entire UI + canvas engine described above), `App.tsx` (renders `<Workspace/>`), `lib/edgeDetection.ts` (`detectEdgesAndExtractPaths(imageData, density, blur, 'edge'|'skeleton', sensitivity)` → `{ rawPaths, components }`), `lib/utils.ts` (`cn`).
- An alternate per-scene pipeline (Golpo-style "one image per scene") exists in `components/StoryboardStage.tsx` + `store/pipelineStore.ts` + `lib/storyboardClient.ts`, driven by the SSE route — kept for reference, not the active screen.
