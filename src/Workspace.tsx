import React, { useState, useRef, useEffect, useMemo } from 'react';
import { UploadCloud, Play, Download, Settings, Image as ImageIcon, Languages, GripVertical, Plus, Brush, Check, Trash2, Eraser, Volume2, Sparkles, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { detectEdgesAndExtractPaths, PathComponent, Point } from './lib/edgeDetection';
import { cn } from './lib/utils';

// Fallback SVG pen if user doesn't upload one
const FALLBACK_PEN = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="%23ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"></path><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path><path d="M2 2l7.586 7.586"></path><circle cx="11" cy="11" r="2"></circle></svg>`;

const locales = {
  en: {
    appTitle: "Lumina Studio",
    mainImage: "Main Image",
    changeAsset: "Change Asset",
    dropAsset: "Drop your asset here",
    penOverlay: "Pen Overlay (Optional)",
    selectPen: "Select Transparent PNG Pen",
    animationLogic: "Animation Logic",
    edgeSensitivity: "Edge Sensitivity",
    bloomRadius: "Bloom Radius",
    baseOpacity: "Base Opacity",
    penCalibration: "Pen Calibration",
    scale: "Scale",
    tipXOffset: "Tip X Offset (left-right)",
    tipYOffset: "Tip Y Offset (top-bottom)",
    previewSequence: "Preview Sequence",
    generateExport: "Generate Export",
    processingMap: "Processing Map...",
    systemActive: "System Active",
    clientSideRender: "Client-Side Render",
    awaitingAsset: "Awaiting Asset Input",
    saveMedia: "Save Media",
    elementsTitle: "Extracted Elements",
    elementsHelp: "Click Preview to extract elements. Then adjust start time and duration.",
    element: "Element",
    startS: "Start (s)",
    durS: "Dur (s)",
    totalSettings: "Total Video Settings",
    fps: "FPS",
    totalDur: "Total (s)",
    maxDurationInfo: "Max 1800s",
    exportComplete: "Export Complete!",
    recording: "Recording Video...",
    converting: "Converting MP4...",
    penSpeed: "Default Pen Speed",
    colorMode: "Draw Style",
    drawOutline: "Outline (Thin)",
    paintOriginal: "Paint (Thick)",
    manualSelection: "Manual Selection",
    exitSelection: "Exit Selection",
    brushSize: "Brush Size",
    addNewElement: "Add Element",
    doneSelection: "Done",
    delete: "Delete",
    eraser: "Eraser",
    brushMode: "Brush Mode",
    canvasBg: "Canvas Background",
    drawDirection: "Drawing Direction",
    dirDefault: "Default",
    dirLTR: "Left to Right",
    dirRTL: "Right to Left",
    dirTTB: "Top to Bottom",
    dirBTT: "Bottom to Top",
    bgBlack: "Black",
    bgWhite: "White",
    bgTrans: "Transparent",
    audioTitle: "Audio Asset",
    selectAudio: "Select Audio File (MP3/WAV)",
    transcribing: "Transcribing Audio...",
    transcriptionReady: "Transcription Ready",
    timelineTitle: "Audio Timeline Mapping",
    mapHelp: "1. Select an element below. 2. Click a word in the timeline to sync them.",
    mapped: "Mapped to",
    unmapped: "Unmapped",
    audioDuration: "Audio Duration",
    syncWithAudio: "Sync Animation with Audio",
    autoSync: "Auto-Sync Elements",
    syncing: "Syncing...",
    syncSuccess: "Elements Synced Automatically",
    typeWritten: "Written Text ✍️",
    typeVisual: "Visual Graphic/Image 🖼️",
    elementTypeLabel: "Element Type",
    smartSegmenting: "Smart AI Segmenting...",
    aiStoryboardTitle: "AI Storyboard",
    aiStoryboardStyle: "Visual Style",
    aiStoryboardGenBtn: "Analyze Audio & Generate 🔮",
    aiStoryboardGenerating: "Understanding voice & generating art...",
    aiStoryboardNoTranscription: "Please upload and transcribe an audio file first so the AI can understand the content!",
    aiStoryboardError: "Storyboard image generation failed. Try again.",
    aiStoryboardPromptUsed: "AI Design Prompt:",
    writeScriptTab: "Write Script (Voiceover)",
    uploadAudioTab: "Upload Audio",
    scriptPlaceholder: "Type your story or script here to generate a magnificent storytelling narrative voice...",
    generateVoiceBtn: "Generate Storytelling Voice 🎙️",
    generatingVoice: "Generating expressive voiceover...",
    playbackVoice: "Narrated Storytelling Audio Ready",
    narratorVoiceName: "Narrator Voice",
    aiStoryboardModel: "AI Image Engine",
    aiFreeGeminiModel: "Free Gemini (Vector SVG)",
    aiPaidImagenModel: "Paid Imagen-3 (PNG Artwork)",
    geminiEditTitle: "Gemini 2.5 Image Editor 🎨",
    geminiEditInputPlaceholder: "Describe edits (e.g., add a cartoon banana next to the screen, make background transparent...)",
    geminiEditBtn: "Apply Magic Edit ✨",
    geminiEditing: "Re-imagining with Gemini 2.5... 🪄",
    geminiNoImageError: "Please upload an image or generate a storyboard first to edit!",
  },
  ar: {
    appTitle: "لومينا ستوديو",
    mainImage: "الصورة الرئيسية",
    changeAsset: "تغيير الصورة",
    dropAsset: "اسحب وافلت الصورة هنا",
    penOverlay: "تراكب القلم (اختياري)",
    selectPen: "اختر قلم (صورة PNG شفافة)",
    animationLogic: "إعدادات الحركة",
    edgeSensitivity: "حساسية الحواف",
    bloomRadius: "نصف قطر التوهج",
    baseOpacity: "شفافية الأساس",
    penCalibration: "معايرة القلم",
    scale: "الحجم",
    tipXOffset: "إزاحة رأس القلم أفقياً",
    tipYOffset: "إزاحة رأس القلم عمودياً",
    previewSequence: "معاينة الحركة",
    generateExport: "تصدير الفيديو",
    processingMap: "جاري المعالجة...",
    systemActive: "النظام نشط",
    clientSideRender: "معالجة محلية",
    awaitingAsset: "بانتظار الصورة",
    saveMedia: "حفظ الفيديو",
    elementsTitle: "العناصر المستخرجة",
    elementsHelp: "انقر معاينة لاستخراج العناصر. ثم عدل وقت البدء والمدة لكل عنصر.",
    element: "عنصر",
    startS: "البدء (ث)",
    durS: "المدة (ث)",
    totalSettings: "إعدادات الفيديو الإجمالية",
    fps: "إطارات/ث",
    totalDur: "الإجمالي (ث)",
    maxDurationInfo: "الحد الأقصى 1800 ثانية",
    exportComplete: "تم تصدير الفيديو بنجاح!",
    recording: "جاري تسجيل الفيديو...",
    converting: "جاري التحويل لـ MP4...",
    penSpeed: "سرعة القلم الافتراضية",
    colorMode: "نظام الرسم",
    drawOutline: "رسم (خطوط رفيعة)",
    paintOriginal: "تلوين (فرشاة سميكة)",
    manualSelection: "التحديد اليدوي",
    exitSelection: "إنهاء التحديد",
    brushSize: "حجم الفرشاة",
    addNewElement: "إضافة عنصر يدويا",
    doneSelection: "تم",
    delete: "حذف",
    eraser: "ممحاة",
    brushMode: "وضع الفرشاة",
    canvasBg: "لون الخلفية",
    drawDirection: "اتجاه الرسم",
    dirDefault: "الافتراضي",
    dirLTR: "يسار ليمين (إنجليزي)",
    dirRTL: "يمين ليسار (عربي)",
    dirTTB: "أعلى لأسفل",
    dirBTT: "أسفل لأعلى",
    bgBlack: "أسود",
    bgWhite: "أبيض",
    bgTrans: "شفاف",
    audioTitle: "ملف الصوت",
    selectAudio: "اختر ملف صوتي (MP3/WAV)",
    transcribing: "جاري استخراج النص...",
    transcriptionReady: "النص جاهز",
    timelineTitle: "تايملاين الصوت والربط",
    mapHelp: "1. اختر عنصراً من القائمة. 2. اضغط على كلمة من التايملاين لربطها به.",
    mapped: "مرتبط بـ",
    unmapped: "غير مرتبط",
    audioDuration: "مدة الصوت",
    syncWithAudio: "مزامنة التحريك مع الصوت",
    autoSync: "ربط تلقائي",
    syncing: "جاري الربط...",
    syncSuccess: "تم الربط التلقائي بنجاح",
    typeWritten: "نصوص مكتوبة ✍️",
    typeVisual: "عناصر مصورة 🖼️",
    elementTypeLabel: "نوع العنصر",
    smartSegmenting: "جاري التقسيم الذكي بالذكاء الاصطناعي... 🧠",
    aiStoryboardTitle: "توليد لوحة القصة بالروبوت والذكاء الاصطناعي",
    aiStoryboardStyle: "الأسلوب الفني",
    aiStoryboardGenBtn: "توليد لوحة القصة 🔮",
    aiStoryboardGenerating: "جاري فهم ملف الصوت وتوليد لوحة القصة الفنية...",
    aiStoryboardNoTranscription: "يرجى رفع ملف صوتي أولاً واستخراج النص ليقوم الذكاء الاصطناعي بفهمه وتصميم الرسمة له!",
    aiStoryboardError: "فشل توليد لوحة القصة بالذكاء الاصطناعي. حاول مجدداً.",
    aiStoryboardPromptUsed: "البرومبت المولد للمشهد المدمج:",
    writeScriptTab: "كتابة سكريبت (توليد صوت)",
    uploadAudioTab: "رفع ملف صوتي",
    scriptPlaceholder: "اكتب قصتك أو السكريبت هنا لتوليد صوت سردي قصصي معبر ورائع بضغطة زر...",
    generateVoiceBtn: "توليد صوت سردي قصصي 🎙️",
    generatingVoice: "جاري توليد الصوت السردي المعبر...",
    playbackVoice: "الصوت السردي المولد جاهز",
    narratorVoiceName: "صوت الراوي والأسلوب",
    aiStoryboardModel: "محرك توليد الصور بالذكاء الاصطناعي",
    aiFreeGeminiModel: "جيميني المجاني (رسم متجهي SVG)",
    aiPaidImagenModel: "إيماجين المدفوع (صور PNG فنية)",
    geminiEditTitle: "محرر الصور بجيميني 2.5 🎨",
    geminiEditInputPlaceholder: "صف تعديلك (مثال: أضف موز كرتوني بجانب الشاشة، اجعل الخلفية شفافة...)",
    geminiEditBtn: "تطبيق التعديل السحري ✨",
    geminiEditing: "جاري التطوير بجيميني 2.5... 🪄",
    geminiNoImageError: "يرجى رفع صورة أولاً أو توليد لوحة القصة الفنية!",
  }
};

type Language = 'en' | 'ar';

type PlotPoint = { x: number; y: number; isMoveTo: boolean };

interface ElementSequence {
  id: string;
  paths: Point[][];
  points: PlotPoint[];
  startTime: number;
  duration: number;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  wordIndex?: number; // Index in transcription array
  elementType?: 'written' | 'visual';
  writingDirection?: 'auto' | 'rtl' | 'ltr';
  label?: string;
}

interface Word {
  word: string;
  start: number;
  end: number;
}

const safeAtob = (str: string): string => {
  // Normalize base64 alphabet characters
  let cleaned = str.replace(/[^A-Za-z0-9+/]/g, "");
  
  // Enforce correct padding length
  const mod = cleaned.length % 4;
  if (mod === 2) cleaned += "==";
  else if (mod === 3) cleaned += "=";
  else if (mod === 1) cleaned = cleaned.substring(0, cleaned.length - 1);
  
  try {
    return atob(cleaned);
  } catch (err) {
    console.warn("Base64 native atob failed, using pure JS fallback decoder:", err);
    try {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      const lookup = new Uint8Array(256);
      for (let i = 0; i < chars.length; i++) {
        lookup[chars.charCodeAt(i)] = i;
      }
      let buffer = '';
      const len = cleaned.length;
      for (let i = 0; i < len; i += 4) {
        if (i + 1 >= len) break;
        const encoded1 = lookup[cleaned.charCodeAt(i)];
        const encoded2 = lookup[cleaned.charCodeAt(i + 1)];
        const encoded3 = i + 2 < len ? lookup[cleaned.charCodeAt(i + 2)] : 64;
        const encoded4 = i + 3 < len ? lookup[cleaned.charCodeAt(i + 3)] : 64;
        
        const bytes1 = (encoded1 << 2) | (encoded2 >> 4);
        buffer += String.fromCharCode(bytes1);
        
        if (encoded3 !== 64 && cleaned[i + 2] !== '=') {
          const bytes2 = ((encoded2 & 15) << 4) | (encoded3 >> 2);
          buffer += String.fromCharCode(bytes2);
          
          if (encoded4 !== 64 && cleaned[i + 3] !== '=') {
            const bytes3 = ((encoded3 & 3) << 6) | encoded4;
            buffer += String.fromCharCode(bytes3);
          }
        }
      }
      return buffer;
    } catch (fallbackErr) {
      console.error("Fallback base64 decoder failed:", fallbackErr);
      return "";
    }
  }
};

const getImageBlob = async (url: string | null | undefined): Promise<Blob> => {
  if (!url) {
    throw new Error("Empty image URL");
  }

  // 1. Try standard browser fetch first (supported natively in 99% of browsers for data: and blob:)
  try {
    const res = await fetch(url);
    if (res.ok) {
      return await res.blob();
    }
  } catch (e) {
    console.warn("NATIVE fetch failed, falling back to manual parsing:", e);
  }

  // 2. Fallback: manual parsing with absolute safety
  try {
    if (url.startsWith('data:')) {
      const parts = url.split(',');
      const header = parts[0];
      const mimeMatch = header.match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/png';
      const isBase64 = header.indexOf('base64') >= 0;
      
      let rawData = parts[1] ? parts[1].trim() : '';
      let decodedData = '';
      
      try {
        decodedData = decodeURIComponent(rawData);
      } catch (_) {
        try {
          decodedData = unescape(rawData);
        } catch (__) {
          decodedData = rawData;
        }
      }
      
      let u8arr: Uint8Array;
      if (isBase64) {
        // Decode base64 securely
        const binaryStr = safeAtob(decodedData);
        const len = binaryStr.length;
        u8arr = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          u8arr[i] = binaryStr.charCodeAt(i);
        }
      } else {
        const len = decodedData.length;
        u8arr = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          u8arr[i] = decodedData.charCodeAt(i);
        }
      }
      return new Blob([u8arr], { type: mime });
    }
  } catch (manualErr) {
    console.error("Critical manual parsing of data URL failed:", manualErr);
  }

  throw new Error("Unsupported URL format and native fetch failed");
};

export default function Workspace() {
  const [lang, setLang] = useState<Language>('en');
  const t = locales[lang];
  const isRtl = lang === 'ar';

  const [mainImgUrl, setMainImgUrl] = useState<string | null>(null);
  const [penImgUrl, setPenImgUrl] = useState<string>(FALLBACK_PEN);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState({ text: '', percentage: 0 });
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [transcription, setTranscription] = useState<Word[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // AI Storyboard Generation States
  const [storyboardStyle, setStoryboardStyle] = useState<string>('Auto-select');
  const [isGeneratingStoryboard, setIsGeneratingStoryboard] = useState(false);
  const [storyboardPrompt, setStoryboardPrompt] = useState<string>('');
  const [storyboardError, setStoryboardError] = useState<string>('');

  // Gemini 2.5 Image Editing States
  const [editPrompt, setEditPrompt] = useState<string>('');
  const [isEditingImage, setIsEditingImage] = useState<boolean>(false);
  const [editError, setEditError] = useState<string>('');
  const [editStatus, setEditStatus] = useState<string>('');

  // Storyboard partition & script voice states
  const [storyboardSteps, setStoryboardSteps] = useState<any[]>([]);
  const [isStoryboardImg, setIsStoryboardImg] = useState<boolean>(false);
  const [scriptMode, setScriptMode] = useState<'upload' | 'text'>('text');
  const [scriptText, setScriptText] = useState<string>(
    `[Section 1]
مرحباً بكم في عصر الابتكار مع نانو بنانا برو 2.5، الجهاز الصغير الذي يغير قواعد اللعبة الذكية بجودة فائقة وألوان زاهية.
Welcome to the era of innovation with Nano Banana Pro 2.5, the micro-device changing the smart game with ultra quality and vibrant colors.

[Section 2]
يتميز جهاز نانو بنانا برو بقدرة معالجة فائقة السرعة وتصميم مرن يناسب جميع التطبيقات والمشاريع الإبداعية والتعليمية المتقدمة.
Nano Banana Pro features ultra-fast processing capability and a flexible design fitting all advanced creative and educational projects.

[Section 3]
يدعم المبدعين والرسامين والمهندسين في لوحة تفاعلية متكاملة، لتمكينهم من رسم وتخطيط وتطوير أفكارهم الأكثر تعقيداً بسهولة وسلاسة.
It supports creators, illustrators, and engineers inside an integrated interactive canvas, enabling them to draw, sketch, and develop complex ideas.

[Section 4]
باستخدام شريحة نانو بنانا الذكية والفرشاة الملوّنة، تتحول لوحة الرسم البيضاء الخاصة بك إلى عالم متحرك نابض بالألوان والحركة المذهلة.
Using its ultra-smart Nano Banana chip and colorful brush, your whiteboard transforms into an animated world pulsing with brilliant colors and motion.

[Section 5]
ابدأ رحلتك الإبداعية واللونية المذهلة اليوم مع نانو بنانا برو 2.5، واجعل من تصميماتك الفنية لوحات حية تتحرك لتروي قصتك للعالم.
Start your amazing creative and colorful journey today with Nano Banana Pro 2.5, turning your artistic designs into alive animated scenes.`
  );
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [voiceName, setVoiceName] = useState<string>('Kore');
  const [useFreeModel, setUseFreeModel] = useState<boolean>(true);
  const autoExtractPendingRef = useRef<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const [elements, setElements] = useState<ElementSequence[]>([]);
  const [rawPaths, setRawPaths] = useState<Point[][]>([]);
  const [unassignedPaths, setUnassignedPaths] = useState<Point[][]>([]);
  
  // Manual Selection State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [activeElementId, setActiveElementId] = useState<string | null>(null);
  const [brushSize, setBrushSize] = useState(20);
  const [isEraser, setIsEraser] = useState(false);
  const [isMouseDown, setIsMouseDown] = useState(false);

  // We keep the loaded images
  const mainImgRef = useRef<HTMLImageElement | null>(null);
  const penImgRef = useRef<HTMLImageElement | null>(null);

  // Settings
  const [glowSize, setGlowSize] = useState(20);
  const [baseOpacity, setBaseOpacity] = useState(5); // %
  const [edgeSensitivity, setEdgeSensitivity] = useState(50); // 1-100
  const [penScale, setPenScale] = useState(10); // scale 1-100 mapped to canvas width percent
  const [penOffsetX, setPenOffsetX] = useState(8); // 0 = left, 50 = center, 100 = right of the pen image
  const [penOffsetY, setPenOffsetY] = useState(8); // 0 = top, 50 = center, 100 = bottom of the pen image
  const [fps, setFps] = useState(30);
  const [defaultPenSpeed, setDefaultPenSpeed] = useState(50); // 1-100
  const [colorMode, setColorMode] = useState<'paint' | 'outline'>('outline');
  const [canvasBgColor, setCanvasBgColor] = useState('#050505');
  const [drawDirection, setDrawDirection] = useState<'default' | 'ltr' | 'rtl' | 'ttb' | 'btt'>('default');

  // Trigger recalculation on sensitivity or mode change
  useEffect(() => {
    if (elements.length > 0 && !isSelectionMode) {
      setElements([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edgeSensitivity, colorMode]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, setUrl: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setUrl(url);
      setIsStoryboardImg(false);
    }
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioBlob(file);
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      
      const audio = new Audio(url);
      audio.onloadedmetadata = () => {
        setAudioDuration(audio.duration);
        scaleTotalDuration(audio.duration.toString());
      };

      transcribeAudio(file);
    }
  };

  const generateStoryboardImage = async () => {
    if (transcription.length === 0) {
      setStoryboardError(t.aiStoryboardNoTranscription);
      return;
    }
    
    setIsGeneratingStoryboard(true);
    setStoryboardError('');
    setStoryboardPrompt('');
    
    try {
      const fullText = transcription.map(w => w.word).join(' ');
      
      const response = await fetch('/api/generate-storyboard-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: fullText,
          style: storyboardStyle,
          bgColor: canvasBgColor === '#050505' ? 'black' : 'white',
          useFreeModel: useFreeModel
        })
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to generate storyboard');
      }
      
      const data = await response.json();
      if (data.imageUrl) {
        setIsStoryboardImg(true);
        setStoryboardSteps(data.steps || []);
        autoExtractPendingRef.current = true;
        setMainImgUrl(data.imageUrl);
        if (data.prompt) {
          setStoryboardPrompt(data.prompt);
        }
      } else {
        throw new Error('Image URL was empty');
      }
    } catch (err: any) {
      console.error("Storyboard generation error:", err);
      setStoryboardError(err.message || t.aiStoryboardError);
    } finally {
      setIsGeneratingStoryboard(false);
    }
  };

  const handleEditImageWithGemini = async () => {
    if (!mainImgUrl) {
      setEditError(t.geminiNoImageError || "Please upload an image first.");
      return;
    }
    if (!editPrompt.trim()) {
      setEditError(lang === 'en' ? "Please enter editing instruction prompt." : "الرجاء كتابة أمر التعديل أولاً.");
      return;
    }

    setIsEditingImage(true);
    setEditError('');
    setEditStatus(lang === 'en' ? "Applying visual edits with Gemini 2.5..." : "جاري تعديل الرسمة بجيميني 2.5...");

    try {
      const blob = await getImageBlob(mainImgUrl);
      
      const fileReader = new FileReader();
      fileReader.readAsDataURL(blob);
      fileReader.onloadend = async () => {
        const base64data = fileReader.result as string;
        
        try {
          const response = await fetch('/api/edit-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image: base64data,
              prompt: editPrompt,
              steps: storyboardSteps,
              style: storyboardStyle,
              bgColor: canvasBgColor === '#050505' ? 'black' : 'white',
              isStoryboardImg: isStoryboardImg
            })
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            if (errData.requiresPaidKey) {
              setEditError(lang === 'en' 
                ? "This operation requires a paid Gemini key (Gemini 2.5 Image editing models). Please make sure you have billing/credits set up in Settings."
                : "تتطلب هذه العملية باقة مدفوعة أو رصيد كافي لموديلات جيميني 2.5 للصور. يرجى تفعيل الدفع في الإعدادات."
              );
            } else {
              throw new Error(errData.error || errData.details || "Failed to edit image");
            }
          } else {
            const data = await response.json();
            if (data.imageUrl) {
              setMainImgUrl(data.imageUrl);
              if (data.steps && Array.isArray(data.steps) && data.steps.length > 0) {
                setStoryboardSteps(data.steps);
              }
              setEditPrompt('');
              autoExtractPendingRef.current = true;
            } else {
              throw new Error("No image returned from Gemini 2.5 editing model");
            }
          }
        } catch (apiErr: any) {
          console.error("API error during edit:", apiErr);
          setEditError(apiErr.message || "Failed to update image.");
        } finally {
          setIsEditingImage(false);
          setEditStatus('');
        }
      };
      
      fileReader.onerror = () => {
        throw new Error("Failed to read image as base64 format");
      };
    } catch (err: any) {
      console.error("General error during edit:", err);
      setEditError(err.message || "Failed to edit image.");
      setIsEditingImage(false);
      setEditStatus('');
    }
  };

  const generateNarratorVoice = async () => {
    if (!scriptText.trim()) return;

    setIsGeneratingVoice(true);
    setProgress({ text: t.generatingVoice, percentage: 30 });
    try {
      const response = await fetch('/api/generate-narrator-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: scriptText, voiceName })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to generate voiceover');
      }

      const data = await response.json();
      if (data.audioUrl) {
         setAudioUrl(data.audioUrl);
         setTranscription(data.transcription || []);
         setAudioDuration(data.duration || 10);
         scaleTotalDuration((data.duration || 10).toString());
         setProgress({ text: t.playbackVoice, percentage: 100 });
      }
    } catch (err: any) {
      console.error(err);
      setProgress({ text: 'Voice Generation Failed', percentage: 0 });
    } finally {
      setIsGeneratingVoice(false);
    }
  };

  const transcribeAudio = async (file: File) => {
    setIsTranscribing(true);
    setProgress({ text: t.transcribing, percentage: 30 });
    
    try {
      const formData = new FormData();
      formData.append('audio', file);
      
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Transcription failed');
      }
      
      const data = await response.json();
      setTranscription(data.transcription);
      setProgress({ text: t.transcriptionReady, percentage: 100 });
      
      // Auto-trigger sync if elements are already there
      if (elements.length > 0) {
        autoSyncElements();
      }
    } catch (error: any) {
      console.error(error);
      setProgress({ text: error.message || 'Transcription Error', percentage: 0 });
    } finally {
      setIsTranscribing(false);
    }
  };

  const autoSyncElements = async () => {
    if (!mainImgUrl || elements.length === 0 || transcription.length === 0) return;
    
    setIsSyncing(true);
    setProgress({ text: t.syncing, percentage: 50 });

    try {
      // Fetch the image as blob
      const imgBlob = await getImageBlob(mainImgUrl);

      const formData = new FormData();
      formData.append('image', imgBlob);
      formData.append('data', JSON.stringify({ elements, transcription }));

      const response = await fetch('/api/sync-elements', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Sync failed');
      
      const data = await response.json();
      const mapping = data.mapping;

      setElements(prev => prev.map(el => {
        if (mapping[el.id] !== undefined) {
          const wordIdx = mapping[el.id];
          const word = transcription[wordIdx];
          if (word) {
            return {
              ...el,
              wordIndex: wordIdx,
              startTime: word.start,
              duration: Math.max(0.2, word.end - word.start)
            };
          }
        }
        return el;
      }));

      setProgress({ text: t.syncSuccess, percentage: 100 });
    } catch (error) {
      console.error(error);
      setProgress({ text: 'Sync Error', percentage: 0 });
    } finally {
      setIsSyncing(false);
    }
  };

  const mapElementToWord = (elementId: string, wordIdx: number) => {
    const word = transcription[wordIdx];
    if (!word) return;

    setElements(prev => prev.map(el => {
      if (el.id === elementId) {
        return { 
          ...el, 
          wordIndex: wordIdx,
          startTime: word.start,
          duration: Math.max(0.2, word.end - word.start)
        };
      }
      return el;
    }));
  };

  const draftElementsRef = useRef<ElementSequence[]>([]);
  const draftUnassignedRef = useRef<Point[][]>([]);
  const activeElementIdRef = useRef<string | null>(null);
  const brushSizeRef = useRef<number>(20);
  const isEraserRef = useRef<boolean>(false);

  useEffect(() => { activeElementIdRef.current = activeElementId; }, [activeElementId]);
  useEffect(() => { brushSizeRef.current = brushSize; }, [brushSize]);
  useEffect(() => { isEraserRef.current = isEraser; }, [isEraser]);

  useEffect(() => {
     if (elements.length > 0) {
        const newElements = elements.map(el => {
           const direction = el.writingDirection === 'rtl' ? 'rtl' : el.writingDirection === 'ltr' ? 'ltr' : drawDirection;
           const points = flattenPaths(el.paths, direction, el.wordIndex);
           return { ...el, points };
        });
        setElements(newElements);
     }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawDirection]);

  const requestDrawSelection = useRef<number | null>(null);
  const mousePosRef = useRef<{ x: number, y: number } | null>(null);

  const startSelectionRender = () => {
    if (!canvasRef.current || !mainImgRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = mainImgRef.current;
    
    // Scale parameters just for nice brush rendering
    const cw = canvas.width;
    const ch = canvas.height;
    
    const draw = () => {
      if (!isSelectionMode) return;
      ctx.fillStyle = canvasBgColor;
      if (canvasBgColor === 'transparent') {
         ctx.clearRect(0, 0, cw, ch);
      } else {
         ctx.fillRect(0, 0, cw, ch);
      }
      
      ctx.globalAlpha = 0.15;
      ctx.drawImage(img, 0, 0, cw, ch);
      ctx.globalAlpha = 1.0;
      
      // Draw unassigned paths faint
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,100,100,0.3)';
      ctx.lineWidth = Math.max(1, cw / 800);
      for (const path of draftUnassignedRef.current) {
        if (!path.length) continue;
        ctx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
      }
      ctx.stroke();

      // Draw all elements from draft
      const activeId = activeElementIdRef.current;
      for (const el of draftElementsRef.current) {
         ctx.beginPath();
         ctx.strokeStyle = el.id === activeId ? '#fbbf24' : 'rgba(255,255,255,0.2)';
         ctx.lineWidth = Math.max(1, cw / 500);
         for (const path of el.paths) {
            if (!path.length) continue;
            ctx.moveTo(path[0].x, path[0].y);
            for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
         }
         ctx.stroke();
      }

      if (mousePosRef.current && (activeId || isEraserRef.current)) {
         ctx.beginPath();
         ctx.strokeStyle = isEraserRef.current ? 'rgba(239, 68, 68, 0.8)' : 'rgba(251, 191, 36, 0.8)';
         ctx.lineWidth = 2;
         const actualRadius = (cw * brushSizeRef.current) / 1000;
         ctx.arc(mousePosRef.current.x, mousePosRef.current.y, actualRadius, 0, Math.PI * 2);
         ctx.stroke();
      }

      requestDrawSelection.current = requestAnimationFrame(draw);
    };

    requestDrawSelection.current = requestAnimationFrame(draw);
  };

  useEffect(() => {
    if (isSelectionMode) {
      draftElementsRef.current = elements.map(el => ({
         ...el,
         paths: el.paths.map(p => [...p]) 
      }));
      draftUnassignedRef.current = unassignedPaths.map(p => [...p]);
      startSelectionRender();
    } else {
      if (requestDrawSelection.current) cancelAnimationFrame(requestDrawSelection.current);
      drawInitialCanvas();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelectionMode]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isSelectionMode) return;
    if (!activeElementIdRef.current && !isEraser) return;
    e.target.setPointerCapture(e.pointerId);
    setIsMouseDown(true);
    handlePointerMove(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isSelectionMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const cw = canvas.width;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    mousePosRef.current = { x, y };

    const activeId = activeElementIdRef.current;
    if (!isMouseDown) return;

    // Radius collision logic
    const R = (cw * brushSizeRef.current) / 1000;
    const R2 = R * R;
    
    const draft = draftElementsRef.current;
    const un = draftUnassignedRef.current;
    
    if (isEraserRef.current) {
        // Eraser logic -> steal from ALL draft elements back to unassigned
        for (let i = 0; i < draft.length; i++) {
            const srcPaths = draft[i].paths;
            for (let j = srcPaths.length - 1; j >= 0; j--) {
                const path = srcPaths[j];
                let hit = false;
                let minX = 99999, minY = 99999, maxX = -99999, maxY = -99999;
                for(let k=0; k<path.length; k+=4) {
                   if (path[k].x < minX) minX = path[k].x;
                   if (path[k].x > maxX) maxX = path[k].x;
                   if (path[k].y < minY) minY = path[k].y;
                   if (path[k].y > maxY) maxY = path[k].y;
                }
                if (x + R < minX || x - R > maxX || y + R < minY || y - R > maxY) continue;

                for (let p = 0; p < path.length; p += 3) {
                    const dx = path[p].x - x;
                    const dy = path[p].y - y;
                    if (dx * dx + dy * dy <= R2) { hit = true; break; }
                }
                if (hit) {
                    un.push(path);
                    srcPaths.splice(j, 1);
                }
            }
        }
    } else if (activeId) {
        // Brush logic -> steal from other elements AND unassigned
        const targetIdx = draft.findIndex(el => el.id === activeId);
        if (targetIdx === -1) return;
        const targetPaths = draft[targetIdx].paths;
        
        // Steal from others
        for (let i = 0; i < draft.length; i++) {
            if (i === targetIdx) continue;
            const srcPaths = draft[i].paths;
            for (let j = srcPaths.length - 1; j >= 0; j--) {
               const path = srcPaths[j];
               let hit = false;
               let minX = 99999, minY = 99999, maxX = -99999, maxY = -99999;
               for(let k=0; k<path.length; k+=4) {
                  if (path[k].x < minX) minX = path[k].x;
                  if (path[k].x > maxX) maxX = path[k].x;
                  if (path[k].y < minY) minY = path[k].y;
                  if (path[k].y > maxY) maxY = path[k].y;
               }
               if (x + R < minX || x - R > maxX || y + R < minY || y - R > maxY) continue;

               for (let p = 0; p < path.length; p += 3) {
                   const dx = path[p].x - x;
                   const dy = path[p].y - y;
                   if (dx * dx + dy * dy <= R2) { hit = true; break; }
               }
               if (hit) {
                  targetPaths.push(path);
                  srcPaths.splice(j, 1);
               }
            }
        }

        // Steal from unassigned
        for (let j = un.length - 1; j >= 0; j--) {
           const path = un[j];
           let hit = false;
           let minX = 99999, minY = 99999, maxX = -99999, maxY = -99999;
           for(let k=0; k<path.length; k+=4) {
              if (path[k].x < minX) minX = path[k].x;
              if (path[k].x > maxX) maxX = path[k].x;
              if (path[k].y < minY) minY = path[k].y;
              if (path[k].y > maxY) maxY = path[k].y;
           }
           if (x + R < minX || x - R > maxX || y + R < minY || y - R > maxY) continue;

           for (let p = 0; p < path.length; p += 3) {
               const dx = path[p].x - x;
               const dy = path[p].y - y;
               if (dx * dx + dy * dy <= R2) { hit = true; break; }
           }
           if (hit) {
              targetPaths.push(path);
              un.splice(j, 1);
           }
        }
    }
  };

  const handlePointerUp = () => {
    if (!isSelectionMode) return;
    setIsMouseDown(false);
    
    // Sync draft to React state
    const newElements = draftElementsRef.current.map((el, i) => {
        const direction = el.writingDirection === 'rtl' ? 'rtl' : el.writingDirection === 'ltr' ? 'ltr' : drawDirection;
        const points = flattenPaths(el.paths, direction, el.wordIndex);
        return { ...el, points, duration: 2.0 };
    });
    
    let currentTime = 0;
    for (let i = 0; i < newElements.length; i++) {
        newElements[i].startTime = currentTime;
        currentTime += newElements[i].duration;
    }
    setElements([...newElements]);
    setUnassignedPaths([...draftUnassignedRef.current]);
  };

  const addNewElement = () => {
      const id = `manual-${Date.now()}`;
      const newEl = { id, paths: [], points: [], startTime: 0, duration: 2.0, bounds: { minX:0, maxX:0, minY:0, maxY:0 } };
      if (isSelectionMode) {
          draftElementsRef.current.push(newEl);
      }
      setElements([...elements, newEl]);
      setActiveElementId(id);
      setIsEraser(false);
  };

  useEffect(() => {
    if (mainImgUrl) {
      const img = new Image();
      img.onload = () => {
        mainImgRef.current = img;
        drawInitialCanvas();
        if (autoExtractPendingRef.current) {
          autoExtractPendingRef.current = false;
          setTimeout(() => {
            prepareAnimation();
          }, 300);
        }
      };
      img.src = mainImgUrl;
    }
  }, [mainImgUrl, baseOpacity, hoveredElementId, elements]);

  useEffect(() => {
    if (penImgUrl) {
      const img = new Image();
      img.onload = () => {
        penImgRef.current = img;
      };
      img.src = penImgUrl;
    }
  }, [penImgUrl]);

  const drawInitialCanvas = () => {
    const canvas = canvasRef.current;
    const img = mainImgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions to match image but cap resolution for performance
    const MAX_DIMENSION = 1920;
    let width = img.width;
    let height = img.height;

    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    canvas.width = width;
    canvas.height = height;

    ctx.fillStyle = canvasBgColor;
    if (canvasBgColor === 'transparent') {
       ctx.clearRect(0, 0, width, height);
    } else {
       ctx.fillRect(0, 0, width, height);
    }

    ctx.globalAlpha = baseOpacity / 100;
    ctx.drawImage(img, 0, 0, width, height);
    ctx.globalAlpha = 1.0;

    if (hoveredElementId) {
      const el = elements.find(e => e.id === hoveredElementId);
      if (el) {
        ctx.beginPath();
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = Math.max(2, width / 400);
        for (const path of el.paths) {
          if (!path.length) continue;
          ctx.moveTo(path[0].x, path[0].y);
          for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
        }
        ctx.stroke();
        
        // Also draw a glow if in paint mode
        if (colorMode === 'paint') {
           ctx.shadowBlur = 15;
           ctx.shadowColor = 'white';
           ctx.stroke();
           ctx.shadowBlur = 0;
        }
      }
    }
  };

  const flattenPaths = (paths: Point[][], direction: string = 'default', wordIndex?: number): PlotPoint[] => {
    if (paths.length === 0) return [];

    let isRTL = isRtl; // use document language default (ar = isRtl = true)
    
    // Check if direction specified LTR/RTL, or if word contains Arabic characters
    if (direction === 'rtl') {
      isRTL = true;
    } else if (direction === 'ltr') {
      isRTL = false;
    } else if (wordIndex !== undefined && transcription[wordIndex]) {
      const wordText = transcription[wordIndex].word;
      isRTL = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(wordText);
    } else if (direction === 'default') {
      isRTL = isRtl; // global fallback
    }

    // Build meta info for paths
    const pathMetas = paths.map((path) => {
      let minX = 99999, minY = 99999, maxX = -99999, maxY = -99999;
      let sumX = 0, sumY = 0;
      path.forEach(pt => {
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
        sumX += pt.x;
        sumY += pt.y;
      });
      return {
        path,
        minX,
        maxX,
        minY,
        maxY,
        centroidX: sumX / path.length,
        centroidY: sumY / path.length,
        height: maxY - minY,
        width: maxX - minX
      };
    });

    // 1. Group paths into horizontal lines (sentences)
    // To identify rows, we cluster paths whose Y centroids are within a threshold.
    const overallMinY = Math.min(...pathMetas.map(p => p.minY));
    const overallMaxY = Math.max(...pathMetas.map(p => p.maxY));
    const totalHeightSpan = overallMaxY - overallMinY;

    // A threshold of ~15-20% of the total height span or 20px works perfectly to separate lines
    const listGapThreshold = Math.max(15, totalHeightSpan * 0.18);

    const rows: typeof pathMetas[] = [];
    
    // Process items top-to-bottom sequentially to cluster into rows
    const tempSorted = [...pathMetas].sort((a, b) => a.centroidY - b.centroidY);

    for (const p of tempSorted) {
      let placed = false;
      for (const row of rows) {
        const rowAvgY = row.reduce((sum, item) => sum + item.centroidY, 0) / row.length;
        if (Math.abs(p.centroidY - rowAvgY) < listGapThreshold) {
          row.push(p);
          placed = true;
          break;
        }
      }
      if (!placed) {
        rows.push([p]);
      }
    }

    // Sort rows themselves STRICTLY top-to-bottom
    rows.sort((rowA, rowB) => {
      const avgYA = rowA.reduce((sum, item) => sum + item.centroidY, 0) / rowA.length;
      const avgYB = rowB.reduce((sum, item) => sum + item.centroidY, 0) / rowB.length;
      return avgYA - avgYB;
    });

    // For each row, sort paths side-to-side depending on writing direction
    for (const row of rows) {
      row.sort((a, b) => {
        if (isRTL) {
          // Right to left sorting for human RTL word tracing
          return b.centroidX - a.centroidX;
        } else {
          // Left to right sorting for LTR word tracing
          return a.centroidX - b.centroidX;
        }
      });
    }

    // Now flatten sorted rows into continuous PlotPoints
    const result: PlotPoint[] = [];
    for (const row of rows) {
      for (const meta of row) {
        const pathPoints = [...meta.path];
        if (pathPoints.length === 0) continue;

        // Ensure individual stroke points flow in the proper word writing direction
        const firstPt = pathPoints[0];
        const lastPt = pathPoints[pathPoints.length - 1];
        let shouldReversePoints = false;
        
        if (isRTL) {
          shouldReversePoints = firstPt.x < lastPt.x; // we want high x first
        } else {
          shouldReversePoints = firstPt.x > lastPt.x; // we want low x first
        }
        
        if (shouldReversePoints) {
          pathPoints.reverse();
        }

        result.push({ x: pathPoints[0].x, y: pathPoints[0].y, isMoveTo: true });
        for (let i = 1; i < pathPoints.length; i++) {
          result.push({ x: pathPoints[i].x, y: pathPoints[i].y, isMoveTo: false });
        }
      }
    }
    return result;
  };

  const prepareAnimation = async () => {
    const canvas = canvasRef.current;
    const img = mainImgRef.current;
    if (!canvas || !img) return;

    setIsProcessing(true);
    setProgress({ text: t.smartSegmenting, percentage: 15 });

    // Use an offscreen canvas to get image data
    const offCanvas = document.createElement('canvas');
    offCanvas.width = canvas.width;
    offCanvas.height = canvas.height;
    const offCtx = offCanvas.getContext('2d');
    if (!offCtx) return;

    offCtx.drawImage(img, 0, 0, offCanvas.width, offCanvas.height);
    const imageData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);

    await new Promise(resolve => setTimeout(resolve, 50));

    const density = Math.max(1, Math.floor(canvas.width / 400));
    const mode = colorMode === 'paint' ? 'skeleton' : 'edge';
    const extraction = detectEdgesAndExtractPaths(imageData, density, 2, mode, edgeSensitivity);
    setRawPaths(extraction.rawPaths);
    setUnassignedPaths([]);

    let newElements: ElementSequence[] = [];
    let currentTime = 0;
    const dur = 2.0;

    // Direct 5-Panel Whiteboard Storyboard Geometrical & Chronological word-mapping Division Code
    if (isStoryboardImg) {
      setProgress({ text: isRtl ? 'جاري تقسيم لوحة القصة لـ 5 مجموعات...' : 'Dividing storyboard into 5 chronological panels...', percentage: 40 });
      
      const sortedComponents = [...extraction.components].sort((a, b) => {
        const ay = (a.bounds.minY + a.bounds.maxY) / 2;
        const by = (b.bounds.minY + b.bounds.maxY) / 2;
        const ax = (a.bounds.minX + a.bounds.maxX) / 2;
        const bx = (b.bounds.minX + b.bounds.maxX) / 2;
        if (Math.abs(ay - by) > canvas.height * 0.15) {
          return ay - by; // Top developments before bottom rows
        }
        return isRtl ? bx - ax : ax - bx; // Reading direction
      });

      const buckets: typeof extraction.components[] = Array.from({ length: 5 }, () => []);
      sortedComponents.forEach((c, idx) => {
         const bucketIdx = Math.min(4, Math.floor((idx / Math.max(1, sortedComponents.length)) * 5));
         buckets[bucketIdx].push(c);
      });

      const totalWords = transcription.length;
      const stepLabels = storyboardSteps.length === 5 ? storyboardSteps.map(s => {
        const ar = s.titleAr || s.scriptAr || '';
        const en = s.titleEn || s.scriptEn || s.desc || '';
        if (ar && en) return `${ar} | ${en}`;
        return ar || en || "Panel";
      }) : [
        isRtl ? "المشهد ١: البداية" : "Panel 1: Beginning",
        isRtl ? "المشهد ٢: التطوير" : "Panel 2: Development",
        isRtl ? "المشهد ٣: الذروة" : "Panel 3: Climax",
        isRtl ? "المشهد ٤: الحل" : "Panel 4: Resolution",
        isRtl ? "المشهد ٥: النهاية" : "Panel 5: Ending"
      ];

      newElements = buckets.map((bucket, sIdx) => {
         const allPaths: Point[][] = [];
         let minX = 99999, minY = 99999, maxX = -99999, maxY = -99999;
         bucket.forEach(c => {
            allPaths.push(...c.paths);
            if (c.bounds.minX < minX) minX = c.bounds.minX;
            if (c.bounds.minY < minY) minY = c.bounds.minY;
            if (c.bounds.maxX > maxX) maxX = c.bounds.maxX;
            if (c.bounds.maxY > maxY) maxY = c.bounds.maxY;
         });

         // Default safety box if bucket is completely empty
         if (minX === 99999) {
            minX = (sIdx * 20) * canvas.width / 100;
            maxX = ((sIdx + 1) * 20) * canvas.width / 100;
            minY = 0;
            maxY = canvas.height;
         }

         const direction = isRtl ? 'rtl' : 'ltr';
         const points = flattenPaths(allPaths, direction);

         // Perfectly partition active speech timing from narration
         let startTime = sIdx * 3.0;
         let elementDuration = 3.0;
         let wordIndex = -1;

         if (totalWords > 0) {
            const startWIdx = Math.floor((sIdx / 5) * totalWords);
            const endWIdx = Math.min(totalWords - 1, Math.floor(((sIdx + 1) / 5) * totalWords) - 1);
            const startWord = transcription[startWIdx];
            const endWord = transcription[endWIdx >= startWIdx ? endWIdx : startWIdx];
            if (startWord && endWord) {
               startTime = startWord.start;
               elementDuration = Math.max(0.5, endWord.end - startWord.start);
               wordIndex = startWIdx;
            }
         }

         return {
            id: `storyboard-panel-${sIdx}-${Date.now()}`,
            paths: allPaths,
            points,
            startTime: Number(startTime.toFixed(1)),
            duration: Number(elementDuration.toFixed(1)),
            bounds: { minX, minY, maxX, maxY },
            label: stepLabels[sIdx],
            elementType: 'visual' as 'written' | 'visual',
            writingDirection: isRtl ? 'rtl' : 'ltr' as any,
            wordIndex: wordIndex !== -1 ? wordIndex : undefined
         };
      });

      currentTime = newElements.reduce((acc, el) => Math.max(acc, el.startTime + el.duration), 0);

    } else {
      // Call Gemini API to get smart semantic regions of at least 5 segments
      let geminiSegments: {
        label: string;
        box: number[]; // [ymin, xmin, ymax, xmax]
        elementType?: 'written' | 'visual';
        writingDirection?: 'auto' | 'rtl' | 'ltr';
      }[] = [];

      try {
        setProgress({ text: t.smartSegmenting, percentage: 40 });
        const imgBlob = await getImageBlob(mainImgUrl!);
        const formData = new FormData();
        formData.append('image', imgBlob);

        const segmentRes = await fetch('/api/segment-image', {
          method: 'POST',
          body: formData
        });

        if (segmentRes.ok) {
          const segData = await segmentRes.json();
          if (segData.segments && segData.segments.length > 0) {
            geminiSegments = segData.segments;
          }
        }
      } catch (err) {
        console.warn("Gemini smart segmentation failed or timed out, falling back to heuristic groups", err);
      }

      setProgress({ text: t.smartSegmenting, percentage: 80 });

      if (geminiSegments.length > 0) {
        // Group visual components into the smart Gemini segment boundaries
        const segmentGroups: Map<number, typeof extraction.components> = new Map();
        const leftoverGroup: typeof extraction.components = [];

        extraction.components.forEach(c => {
          const cMinXpct = (c.bounds.minX / canvas.width) * 100;
          const cMaxXpct = (c.bounds.maxX / canvas.width) * 100;
          const cMinYpct = (c.bounds.minY / canvas.height) * 100;
          const cMaxYpct = (c.bounds.maxY / canvas.height) * 100;

          const cCenterX = (cMinXpct + cMaxXpct) / 2;
          const cCenterY = (cMinYpct + cMaxYpct) / 2;

          let bestSegmentIdx = -1;
          let minDistance = 999999;

          geminiSegments.forEach((seg, sIdx) => {
            const sMinY = seg.box[0];
            const sMinX = seg.box[1];
            const sMaxY = seg.box[2];
            const sMaxX = seg.box[3];

            // Check if coordinate is inside or overlaps with segment box
            const isInsideX = cCenterX >= sMinX && cCenterX <= sMaxX;
            const isInsideY = cCenterY >= sMinY && cCenterY <= sMaxY;

            if (isInsideX && isInsideY) {
              const dist = 0; // Highest priority
              if (dist < minDistance) {
                minDistance = dist;
                bestSegmentIdx = sIdx;
              }
            } else {
              const sCenterX = (sMinX + sMaxX) / 2;
              const sCenterY = (sMinY + sMaxY) / 2;
              const dist = Math.hypot(cCenterX - sCenterX, cCenterY - sCenterY);
              if (dist < minDistance) {
                minDistance = dist;
                bestSegmentIdx = sIdx;
              }
            }
          });

          if (bestSegmentIdx !== -1) {
            if (!segmentGroups.has(bestSegmentIdx)) {
              segmentGroups.set(bestSegmentIdx, []);
            }
            segmentGroups.get(bestSegmentIdx)!.push(c);
          } else {
            leftoverGroup.push(c);
          }
        });

        // Construct ordered ElementSequence elements from the semantic segments
        geminiSegments.forEach((seg, sIdx) => {
          const components = segmentGroups.get(sIdx) || [];
          if (components.length === 0) return; // Skip empty segments

          const allPaths: Point[][] = [];
          let minX = 99999, minY = 99999, maxX = -99999, maxY = -99999;

          components.forEach(c => {
            allPaths.push(...c.paths);
            if (c.bounds.minX < minX) minX = c.bounds.minX;
            if (c.bounds.minY < minY) minY = c.bounds.minY;
            if (c.bounds.maxX > maxX) maxX = c.bounds.maxX;
            if (c.bounds.maxY > maxY) maxY = c.bounds.maxY;
          });

          const elementDir = seg.writingDirection === 'rtl' ? 'rtl' : seg.writingDirection === 'ltr' ? 'ltr' : drawDirection;
          const points = flattenPaths(allPaths, elementDir);

          newElements.push({
            id: `gemini-segment-${sIdx}-${Date.now()}`,
            paths: allPaths,
            points,
            startTime: Number(currentTime.toFixed(1)),
            duration: dur,
            bounds: { minX, minY, maxX, maxY },
            label: seg.label,
            elementType: seg.elementType || 'written',
            writingDirection: seg.writingDirection || 'auto'
          });
          currentTime += dur;
        });

        // Add leftovers as one final element if any are present
        if (leftoverGroup.length > 0) {
          const allPaths: Point[][] = [];
          let minX = 99999, minY = 99999, maxX = -99999, maxY = -99999;

          leftoverGroup.forEach(c => {
            allPaths.push(...c.paths);
            if (c.bounds.minX < minX) minX = c.bounds.minX;
            if (c.bounds.minY < minY) minY = c.bounds.minY;
            if (c.bounds.maxX > maxX) maxX = c.bounds.maxX;
            if (c.bounds.maxY > maxY) maxY = c.bounds.maxY;
          });

          const points = flattenPaths(allPaths, drawDirection);
          newElements.push({
            id: `leftover-${Date.now()}`,
            paths: allPaths,
            points,
            startTime: Number(currentTime.toFixed(1)),
            duration: dur,
            bounds: { minX, minY, maxX, maxY },
            label: isRtl ? "تفاصيل إضافية ✏️" : "Extra Details ✏️",
            elementType: 'written',
            writingDirection: 'auto'
          });
          currentTime += dur;
        }
      }
    }

    // Fallback: Use standard edge grouping if Gemini didn't return any segments or failed
    if (newElements.length === 0) {
      newElements = extraction.components.map((c, i) => {
        const points = flattenPaths(c.paths, drawDirection);
        const el = {
          id: c.id,
          paths: c.paths,
          points,
          startTime: Number(currentTime.toFixed(1)),
          duration: dur,
          bounds: c.bounds,
          label: `${isRtl ? 'عنصر حركة' : 'Visual Segment'} ${i + 1}`,
          elementType: 'written' as 'written' | 'visual',
          writingDirection: 'auto' as 'auto' | 'rtl' | 'ltr'
        };
        currentTime += dur;
        return el;
      });
    }

    // Enforce strict absolute maximum of 1800 seconds (30 minutes)
    if (currentTime > 1800) {
        const finalScale = 1800 / currentTime;
        currentTime = 0;
        newElements.forEach(el => {
            el.duration = Math.max(0.1, Number((el.duration * finalScale).toFixed(1)));
            el.startTime = Number(currentTime.toFixed(1));
            currentTime += el.duration;
        });
    }

    setElements(newElements);
    setProgress({ text: isRtl ? 'تم استخراج المسارات بنجاح!' : 'AI Paths Extracted!', percentage: 100 });
    setIsProcessing(false);
    
    // Auto-trigger sync if transcription is already there
    if (transcription.length > 0) {
       autoSyncElements();
    }

    // Automatically start after processing if just clicking preview
    setTimeout(() => startAnimation(false, newElements), 150);
  };

  const startAnimation = (recordMedia = false, overrideElements?: ElementSequence[]) => {
    const activeElements = overrideElements || elements;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (!activeElements.length || !canvasRef.current || !mainImgRef.current) return;

    setIsAnimating(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = mainImgRef.current;
    const cw = canvas.width;
    const ch = canvas.height;

    // Paint Mask Canvas
    const paintMaskCanvas = document.createElement('canvas');
    paintMaskCanvas.width = cw;
    paintMaskCanvas.height = ch;
    const paintMaskCtx = paintMaskCanvas.getContext('2d')!;
    paintMaskCtx.lineCap = 'round';
    paintMaskCtx.lineJoin = 'round';
    paintMaskCtx.strokeStyle = 'white';
    paintMaskCtx.shadowColor = 'white';

    // Outline Mask Canvas
    const outlineMaskCanvas = document.createElement('canvas');
    outlineMaskCanvas.width = cw;
    outlineMaskCanvas.height = ch;
    const outlineMaskCtx = outlineMaskCanvas.getContext('2d')!;
    outlineMaskCtx.lineCap = 'round';
    outlineMaskCtx.lineJoin = 'round';
    outlineMaskCtx.strokeStyle = canvasBgColor === '#ffffff' ? '#000000' : '#ffffff';
    outlineMaskCtx.shadowColor = 'rgba(255, 255, 255, 0.4)';

    // Reveal canvas
    const revealCanvas = document.createElement('canvas');
    revealCanvas.width = cw;
    revealCanvas.height = ch;
    const revealCtx = revealCanvas.getContext('2d')!;

    let mediaRecorder: MediaRecorder | null = null;
    let chunks: Blob[] = [];
    let recordingAudio: HTMLAudioElement | null = null;

    const getSupportedMimeType = () => {
      const types = [
        'video/mp4;codecs=avc1',
        'video/mp4',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm'
      ];
      for (const type of types) {
         if (MediaRecorder.isTypeSupported(type)) return type;
      }
      return 'video/webm';
    };

    const mimeType = getSupportedMimeType();

    if (recordMedia) {
      setProgress({ text: t.recording, percentage: 0 });
      const stream = canvas.captureStream(fps);

      // If an audio track exists, mix it securely into the recording stream
      if (audioUrl) {
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const dest = audioCtx.createMediaStreamDestination();
          
          recordingAudio = new Audio(audioUrl);
          recordingAudio.crossOrigin = "anonymous";
          
          const source = audioCtx.createMediaElementSource(recordingAudio);
          source.connect(dest);
          source.connect(audioCtx.destination); // Play speaker audio aloud for reference
          
          if (audioCtx.state === 'suspended') {
            audioCtx.resume();
          }

          const audioTracks = dest.stream.getAudioTracks();
          if (audioTracks.length > 0) {
            stream.addTrack(audioTracks[0]);
            console.log("Successfully mixed audio track into export stream");
          }
        } catch (err) {
          console.error("Web Audio capture failed (ignoring with fallback):", err);
          recordingAudio = null;
        }
      }

      try {
        mediaRecorder = new MediaRecorder(stream, { mimeType });
      } catch (err) {
        console.warn("MediaRecorder creation with mimeType failed, trying default fallback...", err);
        try {
          mediaRecorder = new MediaRecorder(stream);
        } catch (fallbackErr) {
          console.error("Critical: MediaRecorder is completely unsupported in this browser environment.", fallbackErr);
        }
      }

      if (mediaRecorder) {
        mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
        mediaRecorder.onstop = () => {
          const videoBlob = new Blob(chunks, { type: mediaRecorder?.mimeType || mimeType });
          const url = URL.createObjectURL(videoBlob);
          setVideoUrl(url);
          setProgress({ text: t.exportComplete, percentage: 100 });
          setIsExporting(false);
        };
        mediaRecorder.start();
      } else {
        setProgress({ text: "Failed to initialize MediaRecorder", percentage: 0 });
        setIsExporting(false);
      }
    }

    if (audioUrl) {
      if (recordMedia && recordingAudio) {
        recordingAudio.currentTime = 0;
        recordingAudio.play().catch(e => console.warn("Recording Audio play failed:", e));
      } else {
        if (!audioRef.current) audioRef.current = new Audio(audioUrl);
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(e => console.warn("Audio play failed:", e));
      }
    }

    const startTimeMS = performance.now();
    const maxEndTime = Math.max(...activeElements.map(e => e.startTime + e.duration));
    const FADE_DUR_S = 2.0; 

    // Store state per element
    const elementState = activeElements.map(e => ({
      ...e,
      lastDrawnIndex: 0
    }));

    const drawFrame = (time: number) => {
      const elapsedS = (time - startTimeMS) / 1000;
      
      let isDrawingDone = elapsedS > maxEndTime;
      let activePenPoint: {x: number, y: number} | null = null;

      // 1. Position the pen at the active drawing element's current exact frame point
      if (!isDrawingDone) {
        for (const el of elementState) {
          if (elapsedS >= el.startTime && elapsedS <= el.startTime + el.duration) {
            const progressRatio = (elapsedS - el.startTime) / el.duration;
            const targetIndex = Math.min(el.points.length - 1, Math.floor(progressRatio * el.points.length));
            if (targetIndex >= 0 && el.points[targetIndex]) {
              activePenPoint = el.points[targetIndex];
            }
            break; // Stop at first active element
          }
        }
      }

      // 2. Draw incremental mask reveal with trail-lag behind pen
      if (!isDrawingDone) {
        for (const el of elementState) {
          const isPaintMode = el.elementType === 'visual' || colorMode === 'paint';
          const targetMaskCtx = isPaintMode ? paintMaskCtx : outlineMaskCtx;

          // Set dynamic stroke width and blur per element
          let brushWidth = Math.max(1, cw / 500);
          if (el.elementType === 'visual') {
            brushWidth = Math.max(45, cw / 22);
            targetMaskCtx.shadowBlur = glowSize * 2;
          } else {
            // Thickened brush width for written elements:
            // This prevents jagged lines and disconnected dot appearances, and ensures elegant, smooth ink strokes.
            brushWidth = colorMode === 'paint' ? Math.max(28, cw / 35) : Math.max(6.5, cw / 140);
            targetMaskCtx.shadowBlur = glowSize;
          }
          targetMaskCtx.lineWidth = brushWidth;

          if (elapsedS >= el.startTime && elapsedS <= el.startTime + el.duration) {
            const progressRatio = (elapsedS - el.startTime) / el.duration;
            const targetIndex = Math.min(el.points.length, Math.floor(progressRatio * el.points.length));
            
            // Mathematically guaranteed lag to prevent bleed-ahead:
            // Since the brush circle extends dynamically by its radius, the mask drawing
            // must lag behind the pen's focal point (targetIndex) by at least the brush radius.
            // We append + 12 points for written elements to create a natural paper-writing ink trail gap.
            const brushRadius = brushWidth / 2;
            let lagCount = Math.ceil(brushRadius + (el.elementType === 'visual' ? 5 : 12));
            
            // Limit lag for extremely short strokes to prevent late sudden reveals
            if (lagCount > el.points.length * 0.45) {
              lagCount = Math.floor(el.points.length * 0.45);
            }
            
            const maskTargetIndex = Math.max(0, targetIndex - lagCount);
            
            if (maskTargetIndex > el.lastDrawnIndex) {
              targetMaskCtx.beginPath();
              const startPt = el.points[el.lastDrawnIndex];
              if (el.lastDrawnIndex > 0) {
                 const prevPt = el.points[el.lastDrawnIndex - 1];
                 targetMaskCtx.moveTo(prevPt.x, prevPt.y);
              } else {
                 targetMaskCtx.moveTo(startPt.x, startPt.y);
              }

              for (let i = el.lastDrawnIndex; i < maskTargetIndex; i++) {
                const pt = el.points[i];
                if (pt.isMoveTo) targetMaskCtx.moveTo(pt.x, pt.y);
                else targetMaskCtx.lineTo(pt.x, pt.y);
              }
              targetMaskCtx.stroke();
              el.lastDrawnIndex = maskTargetIndex;
            }
          } else if (elapsedS > el.startTime + el.duration && el.lastDrawnIndex < el.points.length) {
            // Draw remaining trail when element is fully drawn
            targetMaskCtx.beginPath();
            if (el.lastDrawnIndex > 0) {
                 const prevPt = el.points[el.lastDrawnIndex - 1];
                 targetMaskCtx.moveTo(prevPt.x, prevPt.y);
            }
            for (let i = el.lastDrawnIndex; i < el.points.length; i++) {
                const pt = el.points[i];
                if (pt.isMoveTo) targetMaskCtx.moveTo(pt.x, pt.y);
                else targetMaskCtx.lineTo(pt.x, pt.y);
            }
            targetMaskCtx.stroke();
            el.lastDrawnIndex = el.points.length;
          }
        }
      }

      // 3. Reveal Canvas update
      if (!isDrawingDone) {
        revealCtx.clearRect(0, 0, cw, ch);

        // A. Draw painted/source-in original color graphics
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = cw;
        tempCanvas.height = ch;
        const tempCtx = tempCanvas.getContext('2d')!;
        tempCtx.drawImage(paintMaskCanvas, 0, 0);
        tempCtx.globalCompositeOperation = 'source-in';
        tempCtx.drawImage(img, 0, 0, cw, ch);

        // B. Combine masks: first color painting, then outline strokes on top
        revealCtx.drawImage(tempCanvas, 0, 0);
        revealCtx.drawImage(outlineMaskCanvas, 0, 0);
      }

      // 4. Main Canvas Compositing
      ctx.fillStyle = canvasBgColor;
      if (canvasBgColor === 'transparent') {
         ctx.clearRect(0, 0, cw, ch);
      } else {
         ctx.fillRect(0, 0, cw, ch);
      }

      // Base previously revealed image
      ctx.globalAlpha = baseOpacity / 100;
      ctx.drawImage(img, 0, 0, cw, ch);
      
      // The drawn mask
      ctx.globalAlpha = 1.0;
      ctx.drawImage(revealCanvas, 0, 0);

      // 5. Draw Pen
      if (!isDrawingDone && activePenPoint && penImgRef.current) {
        const penSizeW = Math.max(80, (cw * penScale) / 100);
        const penRatio = penImgRef.current.height / penImgRef.current.width;
        const penSizeH = penSizeW * penRatio;
        const px = activePenPoint.x - (penSizeW * (penOffsetX / 100));
        const py = activePenPoint.y - (penSizeH * (penOffsetY / 100));
        ctx.drawImage(penImgRef.current, px, py, penSizeW, penSizeH);
      }

      // 6. Fade In Full Image at End
      if (isDrawingDone) {
         const fadeTime = elapsedS - maxEndTime;
         const fadeAlpha = Math.max(0, Math.min(1, fadeTime / FADE_DUR_S));
         ctx.globalAlpha = fadeAlpha;
         ctx.drawImage(img, 0, 0, cw, ch);
         ctx.globalAlpha = 1.0;
      }

      if (elapsedS < maxEndTime + FADE_DUR_S) {
        if (recordMedia) {
            const currentTotal = maxEndTime + FADE_DUR_S;
            const currentPct = Math.min(100, Math.round((elapsedS / currentTotal) * 100));
            setProgress({ text: t.recording, percentage: currentPct });
        }
        animationRef.current = requestAnimationFrame(drawFrame);
      } else {
        setIsAnimating(false);
        if (recordingAudio) {
          recordingAudio.pause();
          recordingAudio.currentTime = 0;
        }
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        if (recordMedia && mediaRecorder) {
          mediaRecorder.stop();
        }
      }
    };

    animationRef.current = requestAnimationFrame(drawFrame);
  };

  const updateElementSetting = (index: number, field: 'startTime' | 'duration', value: number) => {
    const newElements = [...elements];
    newElements[index][field] = value;
    setElements(newElements);
  };

  const updateElementProperty = (index: number, field: string, value: any) => {
    const newElements = [...elements];
    const el = { ...newElements[index], [field]: value };
    const direction = el.writingDirection === 'rtl' ? 'rtl' : el.writingDirection === 'ltr' ? 'ltr' : drawDirection;
    el.points = flattenPaths(el.paths, direction, el.wordIndex);
    newElements[index] = el;
    setElements(newElements);
  };

  const moveElement = (index: number, dir: -1 | 1) => {
    if (index + dir < 0 || index + dir >= elements.length) return;
    const newElements = [...elements];
    const temp = newElements[index];
    newElements[index] = newElements[index + dir];
    newElements[index + dir] = temp;
    
    // Automatically recalculate sequential start times after reordering
    let currentTime = 0;
    for (let i = 0; i < newElements.length; i++) {
        newElements[i].startTime = Number(currentTime.toFixed(1));
        currentTime += newElements[i].duration;
    }
    
    setElements(newElements);
  };

  const deleteElement = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const elToDel = elements.find(el => el.id === id);
    if (!elToDel) return;

    // Return paths to unassigned pool
    setUnassignedPaths(prev => [...prev, ...elToDel.paths]);
    const newElements = elements.filter(el => el.id !== id);
    if (activeElementId === id) setActiveElementId(null);
    
    // adjust timing
    let currentTime = 0;
    for(let i=0; i<newElements.length; i++) {
        newElements[i].startTime = Number(currentTime.toFixed(1));
        currentTime += newElements[i].duration;
    }
    setElements(newElements);
    
    if (isSelectionMode) {
       draftElementsRef.current = draftElementsRef.current.filter(el => el.id !== id);
       draftUnassignedRef.current.push(...elToDel.paths);
       if (activeElementIdRef.current === id) activeElementIdRef.current = null;
    }
  };

  const scaleTotalDuration = (targetStr: string) => {
    let target = Number(targetStr);
    if (target > 1800) target = 1800; 
    if (target <= 0) return;
    
    const currentTotal = elements.length ? elements[elements.length - 1].startTime + elements[elements.length - 1].duration : 0;
    if (currentTotal === 0) return;

    const scale = target / currentTotal;
    let currentTime = 0;
    const newElements = elements.map(el => {
      let dur = Math.max(0.1, Number((el.duration * scale).toFixed(1)));
      const newEl = { ...el, startTime: Number(currentTime.toFixed(1)), duration: dur };
      currentTime += dur;
      return newEl;
    });
    setElements(newElements);
  };

  const currentTotalTime = elements.length ? elements[elements.length - 1].startTime + elements[elements.length - 1].duration : 0;

  const TimelineMapping = () => {
    if (!audioUrl) return null;

    return (
      <div id="audio-timeline-section" className="mt-8 space-y-4 border-t border-white/10 pt-6">
        <label className="text-[10px] font-bold tracking-widest text-stone-500 uppercase flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-amber-500" />
            {t.timelineTitle}
          </span>
          {audioDuration > 0 && <span className="text-[10px] font-mono text-stone-600">{audioDuration.toFixed(1)}s</span>}
        </label>
        
        <div className="flex gap-2">
           {transcription.length > 0 && (
              <button
                onClick={autoSyncElements}
                disabled={isSyncing}
                className="flex-1 px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-[10px] font-bold uppercase rounded-lg border border-amber-500/20 transition-all flex items-center justify-center gap-2"
              >
                {isSyncing ? <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                {t.autoSync}
              </button>
           )}
        </div>

        {isTranscribing ? (
          <div className="flex flex-col items-center gap-3 py-6 bg-stone-900/30 rounded-xl border border-white/5">
             <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
             <span className="text-[10px] text-stone-500 animate-pulse">{t.transcribing}</span>
          </div>
        ) : transcription.length > 0 ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 p-3 bg-stone-900/40 rounded-xl border border-white/5 max-h-72 overflow-y-auto custom-scrollbar">
              {transcription.map((w, idx) => {
                const mappedEl = elements.find(el => el.wordIndex === idx);
                const isSelectedForWord = elements.find(el => el.id === selectedElementId)?.wordIndex === idx;
                
                return (
                  <button
                    key={idx}
                    onClick={() => selectedElementId && mapElementToWord(selectedElementId, idx)}
                    className={cn(
                      "px-3 py-2 text-xs rounded-lg transition-all border whitespace-nowrap",
                      isSelectedForWord
                        ? "bg-amber-500 border-amber-400 text-black font-bold shadow-[0_0_15px_rgba(251,191,36,0.4)]"
                        : mappedEl
                        ? "bg-amber-500/20 border-amber-500/30 text-amber-400"
                        : "bg-black/40 border-stone-800 text-stone-500 hover:border-stone-600 hover:text-stone-300"
                    )}
                  >
                    {w.word}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-stone-600 italic px-1 text-center bg-stone-900/40 py-2 rounded-lg">
              {t.mapHelp}
            </p>
          </div>
        ) : (
          <div className="p-6 bg-stone-900/20 rounded-xl border border-dashed border-stone-800 text-center flex flex-col gap-2">
            <Play className="w-5 h-5 text-stone-800 mx-auto" />
            <span className="text-[10px] text-stone-700">Awaiting transcription result...</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn("flex flex-col h-screen bg-[#050505] text-stone-200 font-sans overflow-hidden selection:bg-amber-500/30", isRtl ? "rtl" : "ltr")} dir={isRtl ? 'rtl' : 'ltr'}>
      
      <header className="h-16 px-8 flex items-center justify-between border-b border-white/5 bg-[#080808] shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-full border border-amber-500/50 flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-amber-400 rounded-full shadow-[0_0_8px_#fbbf24]"></div>
          </div>
          <span className="text-xl font-light tracking-[0.2em] uppercase" style={{ fontFamily: "'Georgia', serif" }}>
            {t.appTitle.split(' ')[0]} <span className="text-stone-500">{t.appTitle.split(' ')[1] || ''}</span>
          </span>
        </div>
        <button 
          onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded bg-stone-900 border border-stone-800 hover:bg-stone-800 transition-colors"
        >
          <Languages className="w-4 h-4 text-amber-500" />
          {lang === 'en' ? 'عربي' : 'English'}
        </button>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        <motion.aside 
          id="sidebar-left"
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="w-full lg:w-[360px] border-b lg:border-b-0 lg:border-r border-white/5 bg-[#080808]/50 p-6 flex flex-col gap-6 overflow-y-auto z-20 custom-scrollbar"
        >
          
          <div className="space-y-6">
            <div className="flex flex-col gap-3">
              <label className="text-[10px] font-bold tracking-widest text-stone-500 uppercase">{t.mainImage}</label>
              <label className={cn(
                "h-32 w-full border border-dashed rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all group",
                mainImgUrl ? "border-amber-500/50 bg-amber-500/5" : "border-stone-800 bg-stone-900/20 hover:bg-stone-900/40"
              )}>
                {mainImgUrl ? (
                  <img src={mainImgUrl} alt="preview" className="h-20 object-contain rounded-md shadow-lg" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-stone-800 flex items-center justify-center group-hover:bg-stone-700 transition-colors">
                    <UploadCloud className="w-5 h-5 text-stone-400" />
                  </div>
                )}
                <span className="text-xs text-stone-500">{mainImgUrl ? t.changeAsset : t.dropAsset}</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setMainImgUrl)} />
              </label>
            </div>

            {/* AI Storyboard Block */}
            <div className="p-4 border border-stone-800 bg-stone-950/25 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-wider text-amber-500 uppercase flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                  {t.aiStoryboardTitle}
                </span>
              </div>

              {/* Image Generator Model Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-stone-500 font-medium tracking-wide block">{t.aiStoryboardModel}</label>
                <div className="flex gap-1 bg-[#101010] p-0.5 rounded-lg border border-stone-800">
                  <button
                    type="button"
                    onClick={() => setUseFreeModel(true)}
                    className={cn(
                      "flex-1 py-1.5 rounded-md text-[10px] sm:text-[11px] font-medium transition-all text-center",
                      useFreeModel 
                        ? "bg-amber-500 text-black font-semibold shadow" 
                        : "text-stone-400 hover:text-stone-200 hover:bg-stone-900"
                    )}
                  >
                    {t.aiFreeGeminiModel}
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseFreeModel(false)}
                    className={cn(
                      "flex-1 py-1.5 rounded-md text-[10px] sm:text-[11px] font-medium transition-all text-center",
                      !useFreeModel 
                        ? "bg-amber-500 text-black font-semibold shadow" 
                        : "text-stone-400 hover:text-stone-200 hover:bg-stone-900"
                    )}
                  >
                    {t.aiPaidImagenModel}
                  </button>
                </div>
              </div>

              {/* Style Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-stone-500 font-medium tracking-wide block">{t.aiStoryboardStyle}</label>
                <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto custom-scrollbar p-1 bg-[#101010] rounded-lg border border-stone-800">
                  {['Auto-select', 'Comic Strip', 'Kawaii', 'Clay', 'Sketch Note', 'Anime', 'Editorial', 'Instructional', 'Bento Grid', 'Bricks', 'Scientific', 'Professional'].map((styleOption) => {
                    const isSelected = storyboardStyle === styleOption;
                    return (
                      <button
                        key={styleOption}
                        type="button"
                        onClick={() => setStoryboardStyle(styleOption)}
                        className={cn(
                          "px-2 py-1 rounded text-[11px] text-left transition-all border border-transparent",
                          isSelected
                            ? "bg-amber-500/10 text-amber-500 border-amber-500/20 font-medium"
                            : "text-stone-400 hover:text-stone-200 hover:bg-stone-900"
                        )}
                      >
                        {styleOption}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Generate Storyboard Button */}
              <button
                type="button"
                disabled={isGeneratingStoryboard}
                onClick={generateStoryboardImage}
                className={cn(
                  "w-full h-9 rounded-lg flex items-center justify-center gap-2 text-xs font-semibold select-none border transition-all",
                  isGeneratingStoryboard
                    ? "bg-stone-900 border-stone-800 text-stone-400 cursor-not-allowed"
                    : transcription.length === 0
                    ? "bg-stone-900/40 border-stone-900/30 text-stone-500 hover:text-stone-400 cursor-help"
                    : "bg-gradient-to-r from-amber-600 to-amber-500 text-white hover:opacity-90 active:scale-[0.98] cursor-pointer shadow-lg shadow-amber-500/10 border-amber-500"
                )}
                title={transcription.length === 0 ? t.aiStoryboardNoTranscription : ""}
              >
                {isGeneratingStoryboard ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                    <span className="text-[11px] truncate max-w-[200px]">{t.aiStoryboardGenerating}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t.aiStoryboardGenBtn}</span>
                  </>
                )}
              </button>

              {/* Error representation if empty transcription or actual error */}
              {storyboardError && (
                <div role="alert" className="p-2 border border-rose-500/20 bg-rose-500/5 rounded-lg text-[10px] text-rose-400 leading-relaxed font-medium">
                  {storyboardError}
                </div>
              )}

              {/* Visualized Prompt Used */}
              {storyboardPrompt && (
                <details className="text-[9px] text-stone-500 bg-[#0d0d0d] p-2 rounded-lg border border-stone-900/50 cursor-pointer">
                  <summary className="font-semibold text-stone-400 focus:outline-none">{t.aiStoryboardPromptUsed}</summary>
                  <p className="mt-1 leading-normal text-stone-400 italic whitespace-pre-wrap">{storyboardPrompt}</p>
                </details>
              )}
            </div>

            {/* Gemini 2.5 Image Editor Block */}
            <div className="p-4 border border-stone-800 bg-[#0c0c0c]/90 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-wider text-amber-500 uppercase flex items-center gap-1.5">
                  <Brush className="w-3.5 h-3.5 text-amber-400" />
                  {t.geminiEditTitle}
                </span>
                <span className="text-[8px] bg-amber-500/15 text-amber-500 font-mono py-0.5 px-1.5 rounded-full border border-amber-500/25">
                  Gemini-2.5
                </span>
              </div>

              {!mainImgUrl ? (
                <div className="text-stone-500 text-[10px] leading-relaxed italic bg-[#050505] p-3 rounded-lg border border-stone-900 text-center">
                  {t.geminiNoImageError}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Small image preview with indicator */}
                  <div className="relative h-16 w-full rounded-lg overflow-hidden border border-stone-800 bg-[#050505] flex items-center justify-center p-1">
                    <img src={mainImgUrl} alt="Active scene" className="h-full object-contain max-w-full opacity-60 rounded" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end justify-center pb-1">
                      <span className="text-[9px] text-stone-400 font-semibold tracking-wide uppercase">Active Image Target</span>
                    </div>
                  </div>

                  {/* TextArea prompt wrapper */}
                  <div className="space-y-1.5">
                    <textarea
                      value={editPrompt}
                      onChange={(e) => setEditPrompt(e.target.value)}
                      placeholder={t.geminiEditInputPlaceholder}
                      rows={2}
                      className="w-full text-xs bg-[#101010] text-stone-200 border border-stone-800 rounded-lg p-2.5 focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/20 outline-none resize-none placeholder:text-stone-600 leading-relaxed font-sans"
                    />
                  </div>

                  {/* Apply Edit button */}
                  <button
                    type="button"
                    disabled={isEditingImage || !editPrompt.trim()}
                    onClick={handleEditImageWithGemini}
                    className={cn(
                      "w-full h-9 rounded-lg flex items-center justify-center gap-2 text-xs font-semibold select-none border transition-all",
                      isEditingImage
                        ? "bg-stone-900 border-stone-800 text-stone-400 cursor-not-allowed"
                        : !editPrompt.trim()
                        ? "bg-stone-900/40 border-stone-900/30 text-stone-500 cursor-not-allowed"
                        : "bg-gradient-to-r from-amber-600 to-amber-500 text-white hover:opacity-90 active:scale-[0.98] cursor-pointer shadow-lg shadow-amber-500/10 border-amber-500"
                    )}
                  >
                    {isEditingImage ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                        <span className="text-[11px] truncate">{editStatus || t.geminiEditing}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                        <span>{t.geminiEditBtn}</span>
                      </>
                    )}
                  </button>

                  {/* Error block */}
                  {editError && (
                    <div role="alert" className="p-2.5 border border-rose-500/20 bg-rose-500/5 rounded-lg text-[10px] text-rose-400 leading-relaxed font-medium">
                      {editError}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-[10px] font-bold tracking-widest text-stone-500 uppercase">{t.penOverlay}</label>
              <label className={cn(
                "flex flex-col items-center gap-2 p-4 border rounded-xl cursor-pointer transition-colors",
                "border-stone-800 bg-[#0a0a0a] hover:border-amber-500/50"
              )}>
                <span className="text-xs text-stone-400 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-stone-500" />
                  {t.selectPen}
                </span>
                <input type="file" accept="image/png" className="hidden" onChange={(e) => handleImageUpload(e, setPenImgUrl)} />
              </label>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                 <label className="text-[10px] font-bold tracking-widest text-stone-500 uppercase">{t.audioTitle}</label>
                 <div className="flex rounded bg-stone-900 border border-stone-800 p-0.5 gap-0.5">
                   <button 
                     onClick={() => setScriptMode('upload')}
                     className={cn("px-2 py-0.5 text-[9px] rounded transition-all", scriptMode === 'upload' ? "bg-stone-800 text-amber-500 font-semibold" : "text-stone-500 hover:text-stone-400")}
                   >
                     {t.uploadAudioTab}
                   </button>
                   <button 
                     onClick={() => setScriptMode('text')}
                     className={cn("px-2 py-0.5 text-[9px] rounded transition-all", scriptMode === 'text' ? "bg-stone-800 text-amber-500 font-semibold" : "text-stone-500 hover:text-stone-400")}
                   >
                     {t.writeScriptTab}
                   </button>
                 </div>
              </div>

              {scriptMode === 'upload' ? (
                <label htmlFor="audio-upload" className={cn(
                  "flex flex-col items-center gap-2 p-4 border rounded-xl cursor-pointer transition-colors",
                  audioUrl ? "border-amber-500/50 bg-amber-500/5" : "border-stone-800 bg-[#0a0a0a] hover:border-amber-500/50"
                )}>
                  <span className="text-xs text-stone-400 flex items-center gap-2">
                    {isTranscribing ? <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /> : <Play className="w-4 h-4 text-stone-500" />}
                    {audioUrl ? "Audio Active" : t.selectAudio}
                  </span>
                  <input id="audio-upload" type="file" accept="audio/*" className="hidden" onChange={handleAudioUpload} />
                </label>
              ) : (
                <div className="flex flex-col gap-2.5 p-3 border border-stone-800 bg-[#070707] rounded-xl">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] text-stone-500 font-bold uppercase">{t.narratorVoiceName}</span>
                    <select
                      value={voiceName}
                      onChange={(e) => setVoiceName(e.target.value)}
                      className="bg-stone-900 border border-stone-800 text-stone-300 text-[10px] rounded px-1.5 py-0.5 outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="Kore">Kore (Warm Male)</option>
                      <option value="Puck">Puck (Rich Male)</option>
                      <option value="Fenrir">Fenrir (Deep Storyteller)</option>
                      <option value="Charon">Charon (Calm Male)</option>
                      <option value="Aoede">Aoede (Narrative Female)</option>
                    </select>
                  </div>
                  
                  <textarea
                    rows={3}
                    value={scriptText}
                    onChange={(e) => setScriptText(e.target.value)}
                    placeholder={t.scriptPlaceholder}
                    className="w-full bg-[#0a0a0a] border border-stone-800 rounded-lg p-2 text-xs text-stone-200 focus:border-amber-500/50 outline-none resize-none leading-relaxed"
                  />
                  
                  <button
                    onClick={generateNarratorVoice}
                    disabled={isGeneratingVoice || !scriptText.trim()}
                    className="w-full flex justify-center items-center gap-2 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black font-semibold text-[11px] rounded-lg transition-all shadow-md active:scale-[0.98]"
                  >
                    {isGeneratingVoice ? (
                      <>
                        <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        <span>{t.generatingVoice}</span>
                      </>
                    ) : (
                      <span>{t.generateVoiceBtn}</span>
                    )}
                  </button>

                  {audioUrl && (
                    <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg flex flex-col gap-1 text-[10px] text-amber-500 font-mono">
                      <span>🎤 Story Voiceover Loaded</span>
                      <audio src={audioUrl} controls className="w-full h-8 scale-95 mt-1" />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4 pt-2">
              <label className="text-[10px] font-bold tracking-widest text-stone-500 uppercase">{t.animationLogic}</label>
              
              <div className="flex bg-stone-900 rounded-lg p-1 gap-1">
                <button
                  onClick={() => setColorMode('outline')}
                  className={cn("flex-1 py-1.5 text-[10px] rounded leading-none transition-colors", colorMode === 'outline' ? "bg-stone-800 text-amber-500" : "text-stone-500 hover:text-stone-300")}
                >
                  {t.drawOutline}
                </button>
                <button
                  onClick={() => setColorMode('paint')}
                  className={cn("flex-1 py-1.5 text-[10px] rounded leading-none transition-colors", colorMode === 'paint' ? "bg-stone-800 text-amber-500" : "text-stone-500 hover:text-stone-300")}
                >
                  {t.paintOriginal}
                </button>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-stone-300">{t.drawDirection}</label>
                <select 
                  className="bg-stone-900 border border-stone-800 text-stone-300 text-xs rounded-lg p-2 outline-none focus:border-amber-500"
                  value={drawDirection}
                  onChange={(e) => setDrawDirection(e.target.value as any)}
                >
                  <option value="default">{t.dirDefault}</option>
                  <option value="ltr">{t.dirLTR}</option>
                  <option value="rtl">{t.dirRTL}</option>
                  <option value="ttb">{t.dirTTB}</option>
                  <option value="btt">{t.dirBTT}</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-stone-300">{t.canvasBg}</label>
                <select
                  className="bg-stone-900 border border-stone-800 text-stone-300 text-xs rounded-lg p-2 outline-none focus:border-amber-500"
                  value={canvasBgColor}
                  onChange={(e) => setCanvasBgColor(e.target.value)}
                >
                  <option value="#050505">{t.bgBlack}</option>
                  <option value="#ffffff">{t.bgWhite}</option>
                  <option value="transparent">{t.bgTrans}</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-stone-300 flex justify-between">
                  <span>{t.penSpeed}</span>
                  <span className="text-[10px] font-mono text-amber-500">{defaultPenSpeed}</span>
                </label>
                <input type="range" min="1" max="100" value={defaultPenSpeed} onChange={(e) => setDefaultPenSpeed(Number(e.target.value))} className="accent-amber-500 h-1 bg-stone-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-stone-300 flex justify-between">
                  <span>{t.edgeSensitivity}</span>
                  <span className="text-[10px] font-mono text-amber-500">{edgeSensitivity}%</span>
                </label>
                <input type="range" min="1" max="100" value={edgeSensitivity} onChange={(e) => setEdgeSensitivity(Number(e.target.value))} className="accent-amber-500 h-1 bg-stone-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-stone-300 flex justify-between">
                  <span>{t.bloomRadius}</span>
                  <span className="text-[10px] font-mono text-amber-500">{glowSize}px</span>
                </label>
                <input type="range" min="0" max="100" value={glowSize} onChange={(e) => setGlowSize(Number(e.target.value))} className="accent-amber-500 h-1 bg-stone-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-stone-300 flex justify-between">
                  <span>{t.baseOpacity}</span>
                  <span className="text-[10px] font-mono text-amber-500">{baseOpacity}%</span>
                </label>
                <input type="range" min="0" max="50" value={baseOpacity} onChange={(e) => setBaseOpacity(Number(e.target.value))} className="accent-amber-500 h-1 bg-stone-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" />
              </div>
            </div>

            <TimelineMapping />

            <div className="space-y-4 pt-2">
              <label className="text-[10px] font-bold tracking-widest text-stone-500 uppercase">{t.penCalibration}</label>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-stone-300 flex justify-between">
                  <span>{t.scale}</span>
                  <span className="text-[10px] font-mono text-amber-500">{penScale}%</span>
                </label>
                <input type="range" min="5" max="50" value={penScale} onChange={(e) => setPenScale(Number(e.target.value))} className="accent-amber-500 h-1 bg-stone-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-stone-300 flex justify-between">
                  <span>{t.tipXOffset}</span>
                  <span className="text-[10px] font-mono text-amber-500">{penOffsetX}%</span>
                </label>
                <input type="range" min="0" max="100" value={penOffsetX} onChange={(e) => setPenOffsetX(Number(e.target.value))} className="accent-amber-500 h-1 bg-stone-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-stone-300 flex justify-between">
                  <span>{t.tipYOffset}</span>
                  <span className="text-[10px] font-mono text-amber-500">{penOffsetY}%</span>
                </label>
                <input type="range" min="0" max="100" value={penOffsetY} onChange={(e) => setPenOffsetY(Number(e.target.value))} className="accent-amber-500 h-1 bg-stone-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" />
              </div>
            </div>

            <div className="mt-auto space-y-3 pt-6 border-t border-white/5">
              <button
                id="btn-preview"
                disabled={!mainImgUrl || isProcessing || isAnimating || isExporting}
                onClick={elements.length === 0 ? prepareAnimation : () => startAnimation(false)}
                className="w-full py-4 bg-stone-800 hover:bg-stone-700 disabled:opacity-50 text-stone-200 rounded-xl flex items-center justify-center gap-2 font-bold text-[11px] uppercase tracking-widest transition-all"
              >
                <Play className="w-4 h-4" />
                {isProcessing ? t.processingMap : t.previewSequence}
              </button>

              <button
                disabled={!mainImgUrl || isProcessing || isAnimating || isExporting}
                onClick={() => {
                  setVideoUrl(null);
                  setIsExporting(true);
                  if (elements.length === 0) prepareAnimation();
                  else startAnimation(true);
                }}
                className="w-full py-4 bg-amber-500 text-black font-bold text-[11px] rounded-xl hover:bg-amber-400 shadow-[0_0_30px_-10px_#f59e0b] disabled:opacity-50 active:scale-[0.98] transition-all uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <Settings className="w-4 h-4 text-black" />
                {t.generateExport}
              </button>
            </div>

            {(isExporting || isProcessing) && (
              <div className="pt-2 flex flex-col gap-2">
                <div className="flex justify-between text-[10px] tracking-widest uppercase font-bold text-amber-500">
                  <span>{progress.text}</span>
                  <span>{progress.percentage}%</span>
                </div>
                <div className="w-full bg-stone-800 rounded-full h-1 overflow-hidden">
                  <div className="bg-amber-500 h-full transition-all duration-300 ease-out" style={{ width: `${progress.percentage}%` }} />
                </div>
              </div>
            )}

            {videoUrl && (
              <div className="pt-2 flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4">
                <button
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = videoUrl;
                    const mime = videoUrl.includes('webm') ? 'webm' : 'mp4'; 
                    a.download = `cinematic-reveal.${mime}`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                  className="w-full py-4 bg-stone-100 hover:bg-white text-black rounded-xl flex items-center justify-center gap-2 font-bold text-[11px] uppercase tracking-widest transition-colors shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                >
                  <Download className="w-4 h-4" />
                  {t.saveMedia}
                </button>
              </div>
            )}
          </div>
        </motion.aside>

        {elements.length > 0 && (
          <motion.aside 
            id="sidebar-right"
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className={cn(
              "w-full lg:w-[320px] border-b lg:border-b-0 border-white/5 bg-[#080808]/80 p-5 flex flex-col gap-4 overflow-y-auto z-20 shadow-2xl backdrop-blur-xl custom-scrollbar border-l transition-all pointer-events-auto relative",
              isRtl ? "border-r border-l-0" : ""
            )}
          >
            {isSelectionMode ? (
               <div className="flex flex-col gap-4 h-full">
                 <div className="flex justify-between items-center bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                   <span className="text-[10px] font-bold tracking-widest text-amber-500 uppercase flex items-center gap-2">
                     <Brush className="w-4 h-4" />
                     {t.manualSelection}
                   </span>
                   <button onClick={() => setIsSelectionMode(false)} className="text-[10px] bg-amber-500 text-black px-3 py-1 rounded font-bold hover:bg-amber-400">
                     {t.doneSelection}
                   </button>
                 </div>
                 
                 <div className="flex flex-col gap-1">
                   <label className="text-[10px] font-bold tracking-widest text-stone-500 uppercase">{t.brushSize}</label>
                   <input type="range" min="5" max="100" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="accent-amber-500 h-1 bg-stone-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" />
                 </div>

                 <div className="flex bg-stone-900 rounded-lg p-1 gap-1">
                   <button
                     onClick={() => setIsEraser(false)}
                     className={cn("flex-1 py-2 text-[10px] flex justify-center items-center gap-2 font-bold rounded transition-colors", !isEraser ? "bg-stone-800 text-amber-500" : "text-stone-500 hover:text-stone-300")}
                   >
                     <Brush className="w-3 h-3" />
                     {t.brushMode}
                   </button>
                   <button
                     onClick={() => setIsEraser(true)}
                     className={cn("flex-1 py-2 text-[10px] flex justify-center items-center gap-2 font-bold rounded transition-colors", isEraser ? "bg-stone-800 text-red-500" : "text-stone-500 hover:text-stone-300")}
                   >
                     <Eraser className="w-3 h-3" />
                     {t.eraser}
                   </button>
                 </div>

                 <button onClick={addNewElement} className="flex items-center justify-center gap-2 w-full py-3 border border-stone-800 hover:border-amber-500/50 rounded-lg text-xs font-bold text-stone-300 transition-colors bg-[#0a0a0a]">
                   <Plus className="w-4 h-4" />
                   {t.addNewElement}
                 </button>

                 <div className="flex flex-col gap-2 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                   {elements.map((el, i) => (
                     <div 
                       key={el.id} 
                       onMouseEnter={() => setHoveredElementId(el.id)}
                       onMouseLeave={() => setHoveredElementId(null)}
                       className="relative group flex gap-1"
                     >
                       <button 
                         onClick={() => { setActiveElementId(el.id); setIsEraser(false); }}
                         className={cn(
                           "flex-1 flex items-center justify-between p-3 rounded-lg border transition-colors text-left",
                           activeElementId === el.id && !isEraser ? "border-amber-500 bg-amber-500/10" : "border-stone-800 bg-[#0a0a0a] hover:border-stone-600"
                         )}
                       >
                         <span className={cn("text-[10px] font-bold tracking-widest uppercase flex items-center gap-2", activeElementId === el.id && !isEraser ? "text-amber-500" : "text-stone-400")}>
                           {activeElementId === el.id && !isEraser && <Check className="w-3 h-3" />}
                           {el.label ? el.label : `${t.element} ${i + 1}`}
                         </span>
                         <span className="text-[9px] font-mono text-stone-500">{el.paths.length} paths</span>
                       </button>
                       <button onClick={(e) => deleteElement(e, el.id)} className="w-10 flex items-center justify-center text-stone-600 hover:text-red-500 bg-[#0a0a0a] border border-stone-800 rounded-lg hover:border-red-500/50" title={t.delete}>
                         <Trash2 className="w-4 h-4" />
                       </button>
                     </div>
                   ))}
                 </div>
               </div>
            ) : (
            <>
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold tracking-widest text-stone-500 uppercase flex items-center gap-2">
                {t.elementsTitle}
                <button onClick={() => setIsSelectionMode(true)} className="ml-2 hover:text-amber-500 transition-colors" title={t.manualSelection}>
                  <Brush className="w-3 h-3" />
                </button>
              </label>
              <div className="text-[10px] font-mono text-amber-500 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20">{elements.length}</div>
            </div>
            
            <p className="text-[10px] text-stone-500 mb-2 leading-relaxed">{t.elementsHelp}</p>

            <div className="flex flex-col gap-2 mt-4 pb-4 border-b border-white/5">
               <label className="text-[10px] font-bold tracking-widest text-stone-500 uppercase">{t.totalSettings}</label>
               <div className="flex gap-4">
                 <div className="flex-1 flex gap-2 items-center">
                   <label className="text-[9px] text-stone-400">{t.fps}</label>
                   <input type="number" min="15" max="60" value={fps} onChange={(e) => setFps(Number(e.target.value))} className="w-full bg-[#0a0a0a] border border-stone-800 rounded p-1.5 text-xs text-stone-200 focus:border-amber-500/50 outline-none text-center" />
                 </div>
                 <div className="flex-1 flex gap-2 items-center">
                   <label className="text-[9px] text-stone-400" title={t.maxDurationInfo}>{t.totalDur}</label>
                   <input type="number" min="1" max="1800" value={Math.round(currentTotalTime)} onChange={(e) => scaleTotalDuration(e.target.value)} className="w-full bg-[#0a0a0a] border border-stone-800 rounded p-1.5 text-xs text-amber-500 focus:border-amber-500/50 outline-none text-center font-mono" />
                 </div>
               </div>
            </div>

            <div className="flex flex-col gap-2 flex-1 pt-2">
              {elements.map((el, i) => (
                <div 
                  key={el.id} 
                  onMouseEnter={() => setHoveredElementId(el.id)}
                  onMouseLeave={() => setHoveredElementId(null)}
                  onClick={() => setSelectedElementId(el.id === selectedElementId ? null : el.id)}
                  className={cn(
                    "group flex flex-col gap-2 p-3 rounded-lg border transition-all cursor-pointer",
                    selectedElementId === el.id ? "border-amber-500 bg-amber-500/10 shadow-[0_0_10px_rgba(251,191,36,0.1)]" : "border-stone-800/50 bg-[#0a0a0a] hover:border-stone-700",
                    hoveredElementId === el.id && selectedElementId !== el.id && "border-stone-600 bg-stone-900/40"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "text-[10px] font-bold tracking-widest uppercase flex items-center gap-2",
                      selectedElementId === el.id ? "text-amber-500" : "text-stone-400"
                    )}>
                      <div className="flex flex-col">
                        <button disabled={i === 0} onClick={(e) => { e.stopPropagation(); moveElement(i, -1); }} className="hover:text-amber-500 disabled:opacity-30">▲</button>
                        <button disabled={i === elements.length - 1} onClick={(e) => { e.stopPropagation(); moveElement(i, 1); }} className="hover:text-amber-500 disabled:opacity-30">▼</button>
                      </div>
                      {selectedElementId === el.id && <Check className="w-3 h-3" />}
                      {el.label ? el.label : `${t.element} ${i + 1}`}
                    </span>
                    <div className="flex gap-3 items-center">
                      <span className="text-[9px] font-mono text-stone-600 border border-stone-800 px-1 rounded">{el.points.length} pts</span>
                      <button onClick={(e) => deleteElement(e, el.id)} className="text-stone-600 hover:text-red-500" title={t.delete}>
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {el.wordIndex !== undefined && transcription[el.wordIndex] && (
                    <div className="flex items-center justify-between px-2 py-1 bg-amber-500/10 rounded border border-amber-500/20">
                      <span className="text-[9px] text-amber-500/60 font-bold uppercase">{t.mapped}</span>
                      <span className="text-[10px] text-amber-400 font-medium">"{transcription[el.wordIndex].word}"</span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <div className="flex-1 flex gap-2 items-center">
                      <label className="text-[9px] text-stone-500 uppercase w-12 text-right">{t.startS}</label>
                      <input 
                        type="number" 
                        step="0.1"
                        min="0"
                        value={el.startTime} 
                        onChange={(e) => updateElementSetting(i, 'startTime', Number(e.target.value))} 
                        className="bg-stone-900 border border-stone-800 rounded p-1 text-xs text-amber-500 focus:border-amber-500/50 outline-none w-full font-mono text-center" 
                      />
                    </div>
                    <div className="flex-1 flex gap-2 items-center">
                      <label className="text-[9px] text-stone-500 uppercase w-12 text-right">{t.durS}</label>
                      <input 
                        type="number" 
                        step="0.1" 
                        min="0.1"
                        value={el.duration} 
                        onChange={(e) => updateElementSetting(i, 'duration', Number(e.target.value))} 
                        className="bg-stone-900 border border-stone-800 rounded p-1 text-xs text-amber-500 focus:border-amber-500/50 outline-none w-full font-mono text-center" 
                      />
                    </div>
                  </div>

                  {selectedElementId === el.id && (
                    <div className="mt-2 pt-2 border-t border-white/5 space-y-3" onClick={(e) => e.stopPropagation()}>
                      {/* Element Type */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-stone-400 font-bold uppercase">{t.elementTypeLabel}</label>
                        <div className="flex bg-stone-900 rounded-lg p-1 gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateElementProperty(i, 'elementType', 'written');
                            }}
                            className={cn(
                              "flex-1 py-1 text-[10px] rounded transition-all",
                              (el.elementType || 'written') === 'written' 
                                ? "bg-amber-500 text-black font-bold shadow" 
                                : "text-stone-500 hover:text-stone-300 font-medium"
                            )}
                          >
                            {t.typeWritten}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateElementProperty(i, 'elementType', 'visual');
                            }}
                            className={cn(
                              "flex-1 py-1 text-[10px] rounded transition-all",
                              el.elementType === 'visual' 
                                ? "bg-amber-500 text-black font-bold shadow" 
                                : "text-stone-500 hover:text-stone-300 font-medium"
                            )}
                          >
                            {t.typeVisual}
                          </button>
                        </div>
                      </div>

                      {/* Direction Override */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-stone-400 font-bold uppercase">{t.drawDirection}</label>
                        <select
                          className="bg-stone-900 border border-stone-800 text-stone-300 text-[10px] rounded-lg p-1.5 outline-none focus:border-amber-400 transition-colors w-full cursor-pointer font-bold"
                          value={el.writingDirection || 'auto'}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            updateElementProperty(i, 'writingDirection', e.target.value);
                          }}
                        >
                          <option value="auto">{t.dirDefault} (Auto)</option>
                          <option value="ltr">English LTR (A ➔ Z)</option>
                          <option value="rtl">Arabic RTL (أ ➔ ي)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            </>
            )}
          </motion.aside>
        )}

        <section className={cn(
          "absolute inset-0 bg-[#020202] p-8 flex flex-col items-center justify-center overflow-hidden pointer-events-none z-0",
          isRtl ? "pr-[360px]" : "pl-[360px]"
        )} style={{ 
            paddingRight: elements.length > 0 && isRtl ? '680px' : (isRtl ? '360px' : '0px'),
            paddingLeft: elements.length > 0 && !isRtl ? '680px' : (!isRtl ? '360px' : '0px')
        }}>
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "40px 40px" }}></div>
          
          <div 
            className="relative w-full max-w-5xl aspect-video rounded-2xl overflow-hidden border border-white/10 shadow-2xl flex items-center justify-center p-4"
            style={{ backgroundColor: canvasBgColor === 'transparent' ? 'rgba(5,5,5,0.2)' : canvasBgColor }}
          >
            {!mainImgUrl && (
              <div className="text-center space-y-4 opacity-40">
                <ImageIcon className="w-16 h-16 mx-auto stroke-1 text-stone-500" />
                <p className="text-sm font-light tracking-widest text-stone-400 uppercase">{t.awaitingAsset}</p>
              </div>
            )}
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onContextMenu={(e) => e.preventDefault()}
              className={cn(
                "max-w-full max-h-full object-contain pointer-events-auto transition-opacity duration-1000 relative z-10",
                mainImgUrl ? "opacity-100" : "opacity-0",
                isProcessing && "opacity-50 blur-sm grayscale",
                isSelectionMode && "cursor-crosshair"
              )}
            />
          </div>
        </section>
      </main>

      <footer className="h-10 bg-[#050505] border-t border-white/5 flex items-center justify-between px-8 text-[10px] text-stone-600 shrink-0 z-30">
        <div className="flex gap-6">
          <span>FFmpeg.wasm Embedded</span>
          <span>{t.clientSideRender}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
          <span className="uppercase tracking-tighter">{t.systemActive}</span>
        </div>
      </footer>
    </div>
  );
}
