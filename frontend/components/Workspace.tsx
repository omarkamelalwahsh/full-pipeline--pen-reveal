import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  UploadCloud, 
  Play, 
  Pause,
  Download, 
  Settings, 
  Image as ImageIcon, 
  Languages, 
  Plus, 
  Brush, 
  Check, 
  Trash2, 
  Eraser, 
  Volume2, 
  Sparkles, 
  Loader2, 
  MousePointer, 
  X, 
  Undo2, 
  Link, 
  Layers, 
  AudioLines 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { detectEdgesAndExtractPaths, Point } from '../lib/edgeDetection';
import { cn } from '../lib/utils';
import { Language, PlotPoint, ElementSequence, Word, StoryboardScene } from '../types';

// Fallback SVG pen if user doesn't upload one
// Default "pen-in-hand": a hand holding a marker, with the nib tip at ~(12%,12%)
// of the image so it lands exactly on the active draw point (Golpo-style).
const FALLBACK_PEN = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 100 100" fill="none"><line x1="13" y1="13" x2="52" y2="52" stroke="%23111827" stroke-width="10" stroke-linecap="round"/><line x1="13" y1="13" x2="52" y2="52" stroke="%236366f1" stroke-width="6.5" stroke-linecap="round"/><line x1="16" y1="16" x2="24" y2="24" stroke="%23f59e0b" stroke-width="6.6"/><circle cx="12" cy="12" r="2.4" fill="%23111827"/><path d="M45 43 C54 38 70 44 80 57 C89 68 87 86 75 90 C62 94 49 88 43 75 C39 66 37 49 45 43 Z" fill="%23f7c9a3" stroke="%23111827" stroke-width="1.8"/><path d="M48 49 q7 -6 14 -3" stroke="%23b07a52" stroke-width="1.4"/><path d="M52 56 q7 -6 14 -2" stroke="%23b07a52" stroke-width="1.4"/><path d="M56 63 q7 -5 14 -1" stroke="%23b07a52" stroke-width="1.4"/><path d="M70 86 L88 94 L94 82 L78 74 Z" fill="%234f46e5" stroke="%23111827" stroke-width="1.6"/></svg>`;

const DEMO_IMAGE = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 100 100" fill="none" stroke="black" stroke-width="1.5"><path d="M25,80 C30,70 30,50 35,40 C40,30 50,25 65,20 C70,18 75,18 78,22 C80,25 78,30 72,35 C60,45 50,55 45,75 C43,80 35,83 30,83 C27,83 24,82 25,80 Z" /><path d="M65,20 C62,28 55,38 45,45" /><path d="M30,83 C29,86 27,88 25,86 C23,84 24,81 25,80" /><circle cx="48" cy="32" r="1.5" fill="black" /><circle cx="56" cy="28" r="1.5" fill="black" /><path d="M50,36 C52,38 54,38 55,36" stroke-linecap="round" /></svg>`;

const locales = {
  en: {
    appTitle: "Lumina Studio",
    mainImage: "Main Image",
    changeAsset: "Change Asset",
    dropAsset: "Drop your asset here",
    loadDemoArt: "Load Demo Art 🍌",
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
    geminiEditInputPlaceholder: "Describe edits (e.g., add a cartoon arrow next to the screen, make background transparent...)",
    geminiEditBtn: "Apply Magic Edit ✨",
    geminiEditing: "Re-imagining with Gemini 2.5... 🪄",
    geminiNoImageError: "Please upload an image or generate a storyboard first to edit!",
    shareTitle: "Share Workspace",
    shareSubtitle: "Let others test and view your creation",
    localNetwork: "On Same Wi-Fi / Local Network",
    localNetworkDesc: "Anyone connected to the same Wi-Fi can view this:",
    publicInternet: "Over Public Internet (Tunnel)",
    publicInternetDesc: "Share this link with anyone outside your network:",
    generatePublicBtn: "Generate Public Link 🌐",
    generatingPublic: "Generating public tunnel...",
    tunnelPasswordNote: "Note: On first open, you might be asked for a password. Use this machine's public IP:",
    copyLink: "Copy Link",
    copied: "Copied!",
    scanQrCode: "Scan QR Code",
    tunnelError: "Failed to generate public link.",
  },
  ar: {
    appTitle: "لومينا ستوديو",
    mainImage: "الصورة الرئيسية",
    changeAsset: "تغيير الصورة",
    dropAsset: "اسحب وافلت الصورة هنا",
    loadDemoArt: "تحميل رسمة تجريبية 🍌",
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
    geminiEditInputPlaceholder: "صف تعديلك (مثال: أضف سهماً كرتونياً بجانب الشاشة، اجعل الخلفية شفافة...)",
    geminiEditBtn: "تطبيق التعديل السحري ✨",
    geminiEditing: "جاري التطوير بجيميني 2.5... 🪄",
    geminiNoImageError: "يرجى رفع صورة أولاً أو توليد لوحة القصة الفنية!",
    shareTitle: "مشاركة مساحة العمل",
    shareSubtitle: "اسمح للآخرين بتجربة ورؤية إبداعك",
    localNetwork: "على نفس الشبكة المحلية / Wi-Fi",
    localNetworkDesc: "يمكن لأي شخص متصل بنفس الشبكة فتح التطبيق عبر هذا الرابط:",
    publicInternet: "عبر الإنترنت (رابط عام)",
    publicInternetDesc: "شارك هذا الرابط مع أي شخص خارج شبكتك:",
    generatePublicBtn: "إنشاء رابط عام 🌐",
    generatingPublic: "جاري إنشاء نفق اتصال آمن...",
    tunnelPasswordNote: "ملاحظة: عند فتح الرابط لأول مرة، قد يطلب كلمة مرور. أدخل عنوان الـ IP العام التالي:",
    copyLink: "نسخ الرابط",
    copied: "تم النسخ!",
    scanQrCode: "مسح رمز الـ QR",
    tunnelError: "فشل إنشاء الرابط العام.",
  }
};


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

const getSvgPathData = (paths: Point[][]) => {
  if (!paths) return '';
  return paths.map(path => {
    if (path.length === 0) return '';
    return `M ${path[0].x} ${path[0].y} ` + path.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
  }).join(' ');
};

export default function Workspace() {
  const [lang, setLang] = useState<Language>('en');
  const t = locales[lang];
  const isRtl = lang === 'ar';

  const [mainImgUrl, setMainImgUrl] = useState<string | null>(null);

  // Share / Network states
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [localNetworkUrl, setLocalNetworkUrl] = useState<string>('');
  const [publicTunnelUrl, setPublicTunnelUrl] = useState<string>('');
  const [publicIpAddress, setPublicIpAddress] = useState<string>('');
  const [isGeneratingTunnel, setIsGeneratingTunnel] = useState(false);
  const [tunnelError, setTunnelError] = useState('');
  const [copiedUrlType, setCopiedUrlType] = useState<'local' | 'public' | null>(null);

  useEffect(() => {
    const fetchNetworkInfo = async () => {
      try {
        const res = await fetch('/api/network-info');
        if (res.ok) {
          const data = await res.json();
          setLocalNetworkUrl(data.localUrl || '');
          if (data.tunnelUrl) {
            setPublicTunnelUrl(data.tunnelUrl);
          }
          if (data.publicIp) {
            setPublicIpAddress(data.publicIp);
          }
        }
      } catch (err) {
        console.error("Failed to load network info:", err);
      }
    };
    fetchNetworkInfo();
  }, []);

  const startPublicTunnel = async () => {
    setIsGeneratingTunnel(true);
    setTunnelError('');
    try {
      const res = await fetch('/api/start-tunnel', { method: 'POST' });
      if (!res.ok) {
        throw new Error('Failed to start tunnel');
      }
      const data = await res.json();
      setPublicTunnelUrl(data.url || '');
      setPublicIpAddress(data.publicIp || '');
    } catch (err: any) {
      console.error(err);
      setTunnelError(t.tunnelError || 'Failed to generate public link.');
    } finally {
      setIsGeneratingTunnel(false);
    }
  };
  const [penImgUrl, setPenImgUrl] = useState<string>(FALLBACK_PEN);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState({ text: '', percentage: 0 });
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
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
مرحباً بكم في منصة العرض والتحريك التفاعلية، الحل الإبداعي الأمثل لرسم وتوضيح الأفكار بصرياً وبطريقة مبهرة.
Welcome to the interactive display and animation platform, the ultimate creative solution to sketch and explain ideas visually.

[Section 2]
تتميز المنصة بقدرتها الفائقة على تحويل الخطوط البسيطة إلى عناصر متحركة متكاملة تتبع الصوت بانسجام تام.
The platform features an exceptional capability to transform simple lines into fully animated elements syncing seamlessly with voice.

[Section 3]
ندعم المبدعين والرسامين في لوحة تفاعلية متكاملة، لتمكينهم من رسم وتخطيط وتطوير مشاريعهم الأكثر تعقيداً بسهولة وسلاسة.
We support creators and illustrators on an integrated interactive canvas, enabling them to draw, sketch, and develop their projects smoothly.

[Section 4]
باستخدام محرك التحريك الذكي والفرشاة الرقمية، تتحول لوحة الرسم البيضاء الخاصة بك إلى قصة حية تنبض بالحركة والألوان المذهلة.
Using the smart animation engine and digital brush, your whiteboard transforms into a live story pulsing with motion and colors.

[Section 5]
ابدأ رحلتك الإبداعية واللونية المذهلة اليوم، واجعل من تصميماتك الفنية لوحات حية تتحرك لتروي قصتك للعالم بأسره.
Start your amazing creative and colorful journey today, and turn your artistic designs into alive animated scenes to tell your story.`
  );
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [voiceName, setVoiceName] = useState<string>('Kore');
  const [useFreeModel, setUseFreeModel] = useState<boolean>(true);
  const autoExtractPendingRef = useRef<boolean>(false);

  // One-click Auto Studio state machine: idle -> creating -> voicing -> idle.
  const [autoPhase, setAutoPhase] = useState<'idle' | 'creating' | 'voicing'>('idle');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Tracks which isolated frame (scene/element) is currently mounted on the
  // canvas so we can hard-clear on a scene change and avoid visual ghosting.
  const lastFrameKeyRef = useRef<string | null>(null);
  
  const [elements, setElements] = useState<ElementSequence[]>([]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);

  const currentTotalTime = elements.length ? elements[elements.length - 1].startTime + elements[elements.length - 1].duration : 0;

  // Scene isolation: track which element is active at currentTime
  const activeElement = useMemo(() => {
    if (elements.length === 0) return null;
    const found = elements.find(el => currentTime >= el.startTime && currentTime < el.startTime + el.duration);
    return found ?? (currentTime > 0 && elements.length > 0 ? elements[elements.length - 1] : null);
  }, [currentTime, elements]);

  const activeElementIndex = useMemo(() => {
    if (!activeElement) return -1;
    return elements.findIndex(el => el.id === activeElement.id);
  }, [activeElement, elements]);

  // Synchronize audio element state and ticks
  useEffect(() => {
    if (!audioUrl) {
      audioRef.current = null;
      return;
    }
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      if (!audio.paused) {
        setCurrentTime(audio.currentTime);
      }
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    audio.currentTime = currentTime;

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audioRef.current = null;
    };
  }, [audioUrl]);

  // Singular requestAnimationFrame ticker for smooth timing updates
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const tick = () => {
      if (!isPlaying) return;

      if (audioUrl && audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
        if (audioRef.current.ended) {
          setIsPlaying(false);
          setCurrentTime(0);
          return;
        }
      } else {
        const now = performance.now();
        const delta = (now - lastTime) / 1000;
        lastTime = now;

        setCurrentTime(prevTime => {
          const nextTime = prevTime + delta;
          if (nextTime >= currentTotalTime) {
            setIsPlaying(false);
            return 0;
          }
          return nextTime;
        });
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    if (isPlaying) {
      lastTime = performance.now();
      animationFrameId = requestAnimationFrame(tick);
      if (audioUrl && audioRef.current) {
        if (audioRef.current.paused) {
          audioRef.current.play().catch(e => console.warn("Audio play failed:", e));
        }
      }
    } else {
      if (audioUrl && audioRef.current) {
        if (!audioRef.current.paused) {
          audioRef.current.pause();
        }
      }
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, audioUrl, currentTotalTime]);

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      if (currentTime >= currentTotalTime) {
        setCurrentTime(0);
        if (audioUrl && audioRef.current) {
          audioRef.current.currentTime = 0;
        }
      }
      setIsPlaying(true);
    }
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left - 80;
    if (clickX >= 0) {
      const targetTime = clickX / 30;
      const newTime = Math.max(0, Math.min(currentTotalTime, targetTime));
      setCurrentTime(newTime);
      if (audioRef.current) {
        audioRef.current.currentTime = newTime;
      }
    }
  };

  interface DragState {
    id: string;
    type: 'move' | 'resize-left' | 'resize-right';
    startX: number;
    initialStartTime: number;
    initialDuration: number;
  }
  const [dragState, setDragState] = useState<DragState | null>(null);

  // Storyboard pipeline states
  const [storyboardMode, setStoryboardMode] = useState<'IDLE' | 'CREATE' | 'EDIT'>('IDLE');
  const [storyboardStatus, setStoryboardStatus] = useState<'EMPTY' | 'PROCESSING' | 'ACTIVE'>('EMPTY');
  const [scenes, setScenes] = useState<StoryboardScene[]>([]);
  const [scriptInput, setScriptInput] = useState<string>(
    'مرحباً بكم في منصتنا الإبداعية! هذا التطوير الجديد يمنحنا أداءً فائقاً وقدرة عالية على رسم وتحريك الأفكار بشكل مباشر. في المشهد الأول، يعرض الصاروخ ينطلق بسرعة نحو الفضاء. في المشهد الثاني، تظهر لوحة الرسم وتتلون بكل التفاصيل الجميلة. وينتهي المشهد الثالث برسمة فنية معبرة تدل على النجاح الباهر.'
  );
  const [activeSceneText, setActiveSceneText] = useState<string>('');

  useEffect(() => {
    const active = scenes.find(s => s.scene_id === selectedElementId);
    if (active) {
      setActiveSceneText(active.text);
    } else {
      setActiveSceneText('');
    }
  }, [selectedElementId, scenes]);
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
  const [penScale, setPenScale] = useState(16); // scale 1-100 mapped to canvas width percent (bigger so the hand reads)
  const [penOffsetX, setPenOffsetX] = useState(12); // nib tip x of the hand-in-pen graphic
  const [penOffsetY, setPenOffsetY] = useState(12); // nib tip y of the hand-in-pen graphic
  const [fps, setFps] = useState(30);
  const [defaultPenSpeed, setDefaultPenSpeed] = useState(50); // 1-100
  const [colorMode, setColorMode] = useState<'paint' | 'outline'>('outline');
  const [canvasBgColor, setCanvasBgColor] = useState('#ffffff');
  const [drawDirection, setDrawDirection] = useState<'default' | 'ltr' | 'rtl' | 'ttb' | 'btt'>('default');
  const [activeLeftTab, setActiveLeftTab] = useState<'assets' | 'script' | 'adjust' | null>('assets');

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

  const generateNarratorVoice = async (overrideScript?: string) => {
    // Called from an onClick (passes a React event) or from the Auto chain
    // (passes the script string) — only treat a real string as an override.
    const script = typeof overrideScript === 'string' ? overrideScript : scriptText;
    if (!script.trim()) return;

    setIsGeneratingVoice(true);
    setProgress({ text: t.generatingVoice, percentage: 30 });
    try {
      const response = await fetch('/api/generate-narrator-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script, voiceName })
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

  // One-click Auto Studio: script -> scenes -> single master image -> per-scene
  // pen drawing -> narrator voice -> synced playback. This only orchestrates the
  // existing engine (handleCreateStoryboard auto-extracts & auto-plays; voice
  // generation auto-scales scene timings to the audio length).
  const runAutoStudio = async () => {
    if (!scriptInput.trim() || autoPhase !== 'idle' || isProcessing || isGeneratingVoice) return;
    setScriptText(scriptInput);
    setAutoPhase('creating');
    await handleCreateStoryboard();
  };

  // Once the storyboard has finished extracting drawable points, generate the
  // narrator voice for the same script.
  useEffect(() => {
    if (autoPhase !== 'creating') return;
    if (storyboardStatus === 'EMPTY') { setAutoPhase('idle'); return; } // creation failed
    const extracted =
      storyboardStatus === 'ACTIVE' &&
      !isProcessing &&
      elements.length > 0 &&
      elements.some(e => (e.points?.length || 0) > 0);
    if (extracted) {
      setAutoPhase('voicing');
      generateNarratorVoice(scriptInput);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPhase, storyboardStatus, isProcessing, elements]);

  // Once the voice is ready (scene timings are already scaled to the audio inside
  // generateNarratorVoice), restart playback from the top so drawing + voice run
  // in sync.
  useEffect(() => {
    if (autoPhase !== 'voicing') return;
    if (audioUrl && !isGeneratingVoice) {
      setAutoPhase('idle');
      setTimeout(() => {
        setIsPlaying(false);
        setCurrentTime(0);
        if (audioRef.current) audioRef.current.currentTime = 0;
        setIsPlaying(true);
      }, 200);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPhase, audioUrl, isGeneratingVoice]);

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
    const newElements = draftElementsRef.current.map((el) => {
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
    setUnassignedPaths([]);

    let newElements: ElementSequence[] = [];
    let currentTime = 0;
    const dur = 2.0;

    // Direct 5-Panel Whiteboard Storyboard Geometrical & Chronological word-mapping Division Code
    if (isStoryboardImg) {
      // Scene count is driven by the segmentation (elements), so the timeline,
      // the master image panels and this extraction all agree on the same number.
      const numScenes = (elements.length >= 2 && elements.length <= 8) ? elements.length : 5;
      const gridCols = Math.ceil(Math.sqrt(numScenes));
      const gridRows = Math.ceil(numScenes / gridCols);

      setProgress({ text: isRtl ? `جاري تقسيم لوحة القصة لـ ${numScenes} مشاهد...` : `Dividing storyboard into ${numScenes} chronological panels...`, percentage: 40 });

      const allPaths: Point[][] = [];
      extraction.components.forEach(c => {
        allPaths.push(...c.paths);
      });

      const buckets: Point[][][] = Array.from({ length: numScenes }, () => []);
      const boundsList = Array.from({ length: numScenes }, () => ({
        minX: 99999,
        minY: 99999,
        maxX: -99999,
        maxY: -99999
      }));

      const isHorizontal = canvas.width / canvas.height > 1.5;

      const classifyPanel = (cx: number, cy: number, cw: number, ch: number, isHorizontal: boolean): number => {
        // If elements are initialized with server bounds, group paths by proximity to those bounds
        const hasValidBounds = elements.length === numScenes && elements.every(el => el.bounds && (el.bounds.maxX > el.bounds.minX));
        if (hasValidBounds) {
          let bestIdx = 0;
          let minDistance = Infinity;
          for (let i = 0; i < numScenes; i++) {
            const b = elements[i].bounds;
            const bCenterX = (b.minX + b.maxX) / 2;
            const bCenterY = (b.minY + b.maxY) / 2;
            const dx = cx - bCenterX;
            const dy = cy - bCenterY;
            const dist = dx * dx + dy * dy;
            if (dist < minDistance) {
              minDistance = dist;
              bestIdx = i;
            }
          }
          return bestIdx;
        }

        // Generic grid fallback for any scene count
        const nx = cx / cw;
        const ny = cy / ch;
        if (isHorizontal) {
          let idx = Math.floor(nx * numScenes);
          if (idx < 0) idx = 0;
          if (idx > numScenes - 1) idx = numScenes - 1;
          return idx;
        }
        let col = Math.floor(nx * gridCols);
        let row = Math.floor(ny * gridRows);
        if (col < 0) col = 0;
        if (col > gridCols - 1) col = gridCols - 1;
        if (row < 0) row = 0;
        if (row > gridRows - 1) row = gridRows - 1;
        let idx = row * gridCols + col;
        if (idx > numScenes - 1) idx = numScenes - 1;
        return idx;
      };

      allPaths.forEach(path => {
        if (path.length === 0) return;
        
        let pMinX = 99999, pMinY = 99999, pMaxX = -99999, pMaxY = -99999;
        let sumX = 0, sumY = 0;
        path.forEach(pt => {
          if (pt.x < pMinX) pMinX = pt.x;
          if (pt.x > pMaxX) pMaxX = pt.x;
          if (pt.y < pMinY) pMinY = pt.y;
          if (pt.y > pMaxY) pMaxY = pt.y;
          sumX += pt.x;
          sumY += pt.y;
        });

        const pWidth = pMaxX - pMinX;
        const pHeight = pMaxY - pMinY;

        // Exclude global borders/divider lines from being drawn during scene animation
        if (pWidth > canvas.width * 0.75 || pHeight > canvas.height * 0.75) {
          return;
        }

        const cx = sumX / path.length;
        const cy = sumY / path.length;
        const panelIdx = classifyPanel(cx, cy, canvas.width, canvas.height, isHorizontal);
        
        buckets[panelIdx].push(path);

        const b = boundsList[panelIdx];
        if (pMinX < b.minX) b.minX = pMinX;
        if (pMinY < b.minY) b.minY = pMinY;
        if (pMaxX > b.maxX) b.maxX = pMaxX;
        if (pMaxY > b.maxY) b.maxY = pMaxY;
      });

      // Fill in default safety bounds for empty/low-path panels
      boundsList.forEach((b, sIdx) => {
        if (b.minX === 99999) {
          const el = elements[sIdx];
          if (el && el.bounds && (el.bounds.maxX > el.bounds.minX)) {
            b.minX = el.bounds.minX;
            b.maxX = el.bounds.maxX;
            b.minY = el.bounds.minY;
            b.maxY = el.bounds.maxY;
          } else if (isHorizontal) {
            b.minX = (sIdx / numScenes) * canvas.width;
            b.maxX = ((sIdx + 1) / numScenes) * canvas.width;
            b.minY = 0;
            b.maxY = canvas.height;
          } else {
            const col = sIdx % gridCols;
            const row = Math.floor(sIdx / gridCols);
            b.minX = (col / gridCols) * canvas.width;
            b.maxX = ((col + 1) / gridCols) * canvas.width;
            b.minY = (row / gridRows) * canvas.height;
            b.maxY = ((row + 1) / gridRows) * canvas.height;
          }
        }
      });

      const totalWords = transcription.length;
      const stepLabels = storyboardSteps.length === numScenes ? storyboardSteps.map(s => {
        const ar = s.titleAr || s.scriptAr || '';
        const en = s.titleEn || s.scriptEn || s.desc || '';
        if (ar && en) return `${ar} | ${en}`;
        return ar || en || "Panel";
      }) : Array.from({ length: numScenes }, (_, i) => isRtl ? `المشهد ${i + 1}` : `Scene ${i + 1}`);

      newElements = buckets.map((bucketPaths, sIdx) => {
         const b = boundsList[sIdx];
         const direction = isRtl ? 'rtl' : 'ltr';
         const points = flattenPaths(bucketPaths, direction);

         // Perfectly partition active speech timing from narration
         let startTime = sIdx * 3.0;
         let elementDuration = 3.0;
         let wordIndex = -1;

         if (totalWords > 0) {
            const startWIdx = Math.floor((sIdx / numScenes) * totalWords);
            const endWIdx = Math.min(totalWords - 1, Math.floor(((sIdx + 1) / numScenes) * totalWords) - 1);
            const startWord = transcription[startWIdx];
            const endWord = transcription[endWIdx >= startWIdx ? endWIdx : startWIdx];
            if (startWord && endWord) {
               startTime = startWord.start;
               elementDuration = Math.max(0.5, endWord.end - startWord.start);
               wordIndex = startWIdx;
            }
         }

         return {
            id: (scenes[sIdx] && scenes[sIdx].scene_id) ? scenes[sIdx].scene_id : `storyboard-panel-${sIdx}-${Date.now()}`,
            paths: bucketPaths,
            points,
            startTime: Number(startTime.toFixed(1)),
            duration: Number(elementDuration.toFixed(1)),
            bounds: { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY },
            label: stepLabels[sIdx],
            // 'written' → the pen DRAWS the black ink line (outline), instead of
            // 'visual' which reveals/inks the finished image under a wide brush.
            elementType: 'written' as 'written' | 'visual',
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
    setTimeout(() => startAnimation(false), 150);
  };

  // Stroke a polyline as a smooth curve (quadratic through midpoints) up to
  // `count` points, honoring pen-lift breaks (isMoveTo). Smoother than lineTo.
  const strokeSmoothed = (maskCtx: CanvasRenderingContext2D, pts: PlotPoint[], count: number) => {
    const n = Math.min(count, pts.length);
    if (n <= 0) return;
    maskCtx.beginPath();
    let started = false;
    for (let i = 0; i < n; i++) {
      const pt = pts[i];
      if (!started || pt.isMoveTo) {
        maskCtx.moveTo(pt.x, pt.y);
        started = true;
      } else {
        const prev = pts[i - 1];
        maskCtx.quadraticCurveTo(prev.x, prev.y, (prev.x + pt.x) / 2, (prev.y + pt.y) / 2);
      }
    }
    maskCtx.stroke();
  };

  const drawCanvas = (time: number) => {
    const canvas = canvasRef.current;
    const img = mainImgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const cw = canvas.width;
    const ch = canvas.height;

    const isStoryboardActive = storyboardStatus === 'ACTIVE' && scenes.length > 0;
    const isDrawingDone = time >= currentTotalTime;

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

    let activePenPoint: { x: number; y: number } | null = null;

    if (isStoryboardActive) {
      let cumulativeTime = 0;
      const scenesWithTime = scenes.map((s) => {
        const startTime = cumulativeTime;
        const endTime = cumulativeTime + s.duration_seconds;
        cumulativeTime = endTime;
        return {
          ...s,
          startTime,
          endTime,
        };
      });

      const activeScene = scenesWithTime.find(s => time >= s.startTime && time <= s.endTime) || scenesWithTime[scenesWithTime.length - 1];
      
      if (activeScene) {
        for (const el of elements) {
          const isPaintMode = el.elementType === 'visual' || colorMode === 'paint';
          const targetMaskCtx = isPaintMode ? paintMaskCtx : outlineMaskCtx;

          // Set brush width and shadow
          let brushWidth = Math.max(1, cw / 500);
          if (el.elementType === 'visual') {
            brushWidth = Math.max(45, cw / 22);
            targetMaskCtx.shadowBlur = glowSize * 2;
          } else {
            brushWidth = colorMode === 'paint' ? Math.max(28, cw / 35) : Math.max(6.5, cw / 140);
            targetMaskCtx.shadowBlur = glowSize;
          }
          targetMaskCtx.lineWidth = brushWidth;

          const pointsCount = el.points?.length || 0;
          if (pointsCount === 0) continue;

          // Check if this element is in a past scene, current active scene, or future scene
          const isPastElement = el.startTime < activeScene.startTime;
          const isFutureElement = el.startTime >= activeScene.endTime;
          const isActiveElement = !isPastElement && !isFutureElement;

          if (!isDrawingDone) {
            if (!isActiveElement) {
              continue; // Hide all other scenes' assets during playback
            }

            // Compute total stroke points inside this scene
            const activeSceneElements = elements.filter(e => {
              return e.id === activeScene.scene_id || 
                     (e.startTime >= activeScene.startTime && e.startTime < activeScene.endTime);
            });
            const totalStrokePoints = activeSceneElements.reduce((acc: number, e: ElementSequence) => acc + (e.points?.length || 1), 0);
            const sceneAudioDuration = activeScene.endTime - activeScene.startTime;
            const automatedPenSpeed = sceneAudioDuration > 0 ? totalStrokePoints / sceneAudioDuration : 0;
            const elapsedSceneTime = time - activeScene.startTime;
            const pointsToDraw = elapsedSceneTime * automatedPenSpeed;

            // Sequential draw across elements within the active scene
            let pointsBeforeThisEl = 0;
            for (const activeEl of activeSceneElements) {
              if (activeEl.id === el.id) break;
              pointsBeforeThisEl += activeEl.points?.length || 0;
            }

            const remainingPointsForThisEl = pointsToDraw - pointsBeforeThisEl;

            if (remainingPointsForThisEl <= 0) {
              continue;
            }

            if (remainingPointsForThisEl >= pointsCount) {
              strokeSmoothed(targetMaskCtx, el.points, pointsCount);
            } else {
              const targetIndex = Math.min(pointsCount, Math.floor(remainingPointsForThisEl));
              const brushRadius = brushWidth / 2;
              let lagCount = Math.ceil(brushRadius + (el.elementType === 'visual' ? 5 : 12));
              if (lagCount > pointsCount * 0.45) {
                lagCount = Math.floor(pointsCount * 0.45);
              }
              const maskTargetIndex = Math.max(0, targetIndex - lagCount);

              if (maskTargetIndex > 0) {
                strokeSmoothed(targetMaskCtx, el.points, maskTargetIndex);
              }

              if (targetIndex > 0 && el.points[targetIndex - 1]) {
                activePenPoint = el.points[targetIndex - 1];
              }
            }
          } else {
            // Drawing is done: Draw all elements of all scenes fully
            strokeSmoothed(targetMaskCtx, el.points, pointsCount);
          }
        }
      }
    } else {
      // Non-storyboard mode: draw elements sequentially based on their individual timings
      for (const el of elements) {
        const isPaintMode = el.elementType === 'visual' || colorMode === 'paint';
        const targetMaskCtx = isPaintMode ? paintMaskCtx : outlineMaskCtx;

        let brushWidth = Math.max(1, cw / 500);
        if (el.elementType === 'visual') {
          brushWidth = Math.max(45, cw / 22);
          targetMaskCtx.shadowBlur = glowSize * 2;
        } else {
          brushWidth = colorMode === 'paint' ? Math.max(28, cw / 35) : Math.max(6.5, cw / 140);
          targetMaskCtx.shadowBlur = glowSize;
        }
        targetMaskCtx.lineWidth = brushWidth;

        if (time < el.startTime) {
          continue;
        }

        const pointsCount = el.points?.length || 0;
        if (pointsCount === 0) continue;

        if (time >= el.startTime + el.duration) {
          targetMaskCtx.beginPath();
          const startPt = el.points[0];
          targetMaskCtx.moveTo(startPt.x, startPt.y);
          for (let i = 1; i < pointsCount; i++) {
            const pt = el.points[i];
            if (pt.isMoveTo) targetMaskCtx.moveTo(pt.x, pt.y);
            else targetMaskCtx.lineTo(pt.x, pt.y);
          }
          targetMaskCtx.stroke();
        } else {
          const progressRatio = (time - el.startTime) / el.duration;
          const targetIndex = Math.min(pointsCount, Math.floor(progressRatio * pointsCount));
          const brushRadius = brushWidth / 2;
          let lagCount = Math.ceil(brushRadius + (el.elementType === 'visual' ? 5 : 12));
          if (lagCount > pointsCount * 0.45) {
            lagCount = Math.floor(pointsCount * 0.45);
          }
          const maskTargetIndex = Math.max(0, targetIndex - lagCount);

          if (maskTargetIndex > 0) {
            targetMaskCtx.beginPath();
            const startPt = el.points[0];
            targetMaskCtx.moveTo(startPt.x, startPt.y);
            for (let i = 1; i < maskTargetIndex; i++) {
              const pt = el.points[i];
              if (pt.isMoveTo) targetMaskCtx.moveTo(pt.x, pt.y);
              else targetMaskCtx.lineTo(pt.x, pt.y);
            }
            targetMaskCtx.stroke();
          }

          if (targetIndex > 0 && el.points[targetIndex - 1]) {
            activePenPoint = el.points[targetIndex - 1];
          }
        }
      }
    }

    revealCtx.clearRect(0, 0, cw, ch);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = cw;
    tempCanvas.height = ch;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.drawImage(paintMaskCanvas, 0, 0);
    tempCtx.globalCompositeOperation = 'source-in';
    tempCtx.drawImage(img, 0, 0, cw, ch);

    revealCtx.drawImage(tempCanvas, 0, 0);
    revealCtx.drawImage(outlineMaskCanvas, 0, 0);

    let minX = 0, minY = 0, w = cw, h = ch;
    // isDrawingDone is already declared at the top of drawCanvas

    // --- ABSOLUTE SINGLE-FRAME ISOLATION ---
    // Resolve the bounding box of ONLY the frame active at `time` (the grouped
    // elements of a storyboard scene, or the single active element otherwise)
    // and crop strictly to it. The remaining frames of the composite sheet are
    // never drawn or scaled into view, so exactly one frame fills the canvas.
    // NOTE: the active frame is derived from the `time` argument (not the
    // `activeElement` memo) so this stays correct inside the export RAF loop,
    // where drawCanvas runs from a closure with a frozen render snapshot.
    let frameBounds: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
    let frameKey: string | null = null;

    if (!isSelectionMode && !isDrawingDone) {
      if (isStoryboardActive) {
        let cumulativeTime = 0;
        const scenesWithTime = scenes.map((s) => {
          const startTime = cumulativeTime;
          const endTime = cumulativeTime + s.duration_seconds;
          cumulativeTime = endTime;
          return { ...s, startTime, endTime };
        });

        const activeScene = scenesWithTime.find(s => time >= s.startTime && time <= s.endTime) || scenesWithTime[scenesWithTime.length - 1];

        if (activeScene) {
          frameKey = `scene:${activeScene.scene_id}`;
          let tempMinX = 99999, tempMinY = 99999, tempMaxX = -99999, tempMaxY = -99999;
          const activeSceneElements = elements.filter(el => {
            return el.id === activeScene.scene_id ||
                   (el.startTime >= activeScene.startTime && el.startTime < activeScene.endTime);
          });
          activeSceneElements.forEach(el => {
            if (el.bounds) {
              if (el.bounds.minX < tempMinX) tempMinX = el.bounds.minX;
              if (el.bounds.minY < tempMinY) tempMinY = el.bounds.minY;
              if (el.bounds.maxX > tempMaxX) tempMaxX = el.bounds.maxX;
              if (el.bounds.maxY > tempMaxY) tempMaxY = el.bounds.maxY;
            }
          });
          if (tempMinX !== 99999 && tempMaxX > tempMinX && tempMaxY > tempMinY) {
            frameBounds = { minX: tempMinX, minY: tempMinY, maxX: tempMaxX, maxY: tempMaxY };
          }
        }
      } else {
        const activeEl = elements.find(el => time >= el.startTime && time < el.startTime + el.duration)
          || (time > 0 && elements.length > 0 ? elements[elements.length - 1] : null);
        if (activeEl && activeEl.bounds && activeEl.bounds.maxX > activeEl.bounds.minX + 10 && activeEl.bounds.maxY > activeEl.bounds.minY + 10) {
          frameKey = `el:${activeEl.id}`;
          frameBounds = { ...activeEl.bounds };
        }
      }
    }

    const shouldZoom = frameBounds !== null;

    if (frameBounds) {
      // Integer-snap the active frame box so the clip rect + camera translate land
      // on whole pixels. Float bounds left a sub-pixel seam that interpolated the
      // neighbouring scene (Scene 2) into the active frame (Scene 1).
      minX = Math.floor(frameBounds.minX);
      minY = Math.floor(frameBounds.minY);
      w = Math.ceil(frameBounds.maxX) - minX;
      h = Math.ceil(frameBounds.maxY) - minY;
    }

    // SMOOTH TRANSITION JUMP: the moment the playhead crosses into a new frame,
    // wipe the whole canvas before mounting the next isolated frame so no pixels
    // from the previous scene ghost through during the swap.
    if (frameKey !== lastFrameKeyRef.current) {
      ctx.clearRect(0, 0, cw, ch);
      lastFrameKeyRef.current = frameKey;
    }

    const scaleX = shouldZoom ? cw / w : 1;
    const scaleY = shouldZoom ? ch / h : 1;
    const scale = shouldZoom ? Math.min(scaleX, scaleY) * 0.9 : 1; // 90% view fill

    ctx.fillStyle = canvasBgColor;
    if (canvasBgColor === 'transparent') {
      ctx.clearRect(0, 0, cw, ch);
    } else {
      ctx.fillRect(0, 0, cw, ch);
    }

    ctx.save();

    if (shouldZoom) {
      // Scale and translate the context so this specific box stretches to fill the
      // entire canvas viewport. Round the translation to whole device pixels so the
      // scaled master image samples cleanly at the clip edge (no sub-seam bleed).
      const tx = Math.round(-minX * scale + (cw - w * scale) / 2);
      const ty = Math.round(-minY * scale + (ch - h * scale) / 2);
      ctx.translate(tx, ty);
      ctx.scale(scale, scale);

      ctx.beginPath();
      // Clip to ONLY the active scene's integer rectangle BEFORE drawing the master
      // image chunk, so adjacent grid scenes can never warp into this frame.
      ctx.rect(minX, minY, w, h);
      ctx.clip();
    }

    ctx.globalAlpha = baseOpacity / 100;
    ctx.drawImage(img, 0, 0, cw, ch);

    ctx.globalAlpha = 1.0;
    ctx.drawImage(revealCanvas, 0, 0);

    if (hoveredElementId) {
      const el = elements.find(e => e.id === hoveredElementId);
      if (el) {
        ctx.beginPath();
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = Math.max(2, cw / 400);
        for (const path of el.paths) {
          if (!path.length) continue;
          ctx.moveTo(path[0].x, path[0].y);
          for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
        }
        ctx.stroke();
        
        if (colorMode === 'paint') {
           ctx.shadowBlur = 15;
           ctx.shadowColor = 'white';
           ctx.stroke();
           ctx.shadowBlur = 0;
        }
      }
    }

    if (activePenPoint && penImgRef.current) {
      const penSizeW = Math.max(80, (cw * penScale) / 100) / scale;
      const penRatio = penImgRef.current.height / penImgRef.current.width;
      const penSizeH = penSizeW * penRatio;
      const px = activePenPoint.x - (penSizeW * (penOffsetX / 100));
      const py = activePenPoint.y - (penSizeH * (penOffsetY / 100));
      ctx.drawImage(penImgRef.current, px, py, penSizeW, penSizeH);
    }
    ctx.restore();

    // Fade in full color image at the end of the timeline
    if (isDrawingDone) {
      const fadeTime = time - currentTotalTime;
      const fadeAlpha = Math.max(0, Math.min(1, fadeTime / 2.0)); // 2s fade duration
      ctx.save();
      ctx.globalAlpha = fadeAlpha;
      ctx.drawImage(img, 0, 0, cw, ch);
      ctx.restore();
    }
  };

  // Reactive canvas drawing effect
  useEffect(() => {
    drawCanvas(currentTime);
  }, [
    currentTime, 
    elements, 
    scenes, 
    canvasBgColor, 
    colorMode, 
    baseOpacity, 
    glowSize, 
    penScale, 
    penOffsetX, 
    penOffsetY, 
    hoveredElementId,
    selectedElementId,
    storyboardStatus
  ]);

  const startAnimation = (recordMedia = false) => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    if (!recordMedia) {
      setCurrentTime(0);
      setIsPlaying(true);
      return;
    }

    if (!canvasRef.current || !mainImgRef.current) return;

    setIsAnimating(true);
    const canvas = canvasRef.current;

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

      if (audioUrl) {
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const dest = audioCtx.createMediaStreamDestination();
          
          recordingAudio = new Audio(audioUrl);
          recordingAudio.crossOrigin = "anonymous";
          
          const source = audioCtx.createMediaElementSource(recordingAudio);
          source.connect(dest);
          source.connect(audioCtx.destination);
          
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
        console.warn("MediaRecorder creation failed, using fallback...", err);
        try {
          mediaRecorder = new MediaRecorder(stream);
        } catch (fallbackErr) {
          console.error("MediaRecorder completely unsupported.", fallbackErr);
        }
      }

      if (mediaRecorder) {
        mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
        mediaRecorder.onstop = () => {
          const videoBlob = new Blob(chunks, { type: mediaRecorder?.mimeType || mimeType });
          const url = URL.createObjectURL(videoBlob);
          
          const a = document.createElement('a');
          a.href = url;
          const mimeExt = mimeType.includes('webm') ? 'webm' : 'mp4'; 
          a.download = `cinematic-reveal.${mimeExt}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          
          setProgress({ text: t.exportComplete, percentage: 100 });
          setIsExporting(false);
        };
        mediaRecorder.start();
      } else {
        setProgress({ text: "Failed to initialize MediaRecorder", percentage: 0 });
        setIsExporting(false);
      }
    }

    if (audioUrl && recordingAudio) {
      recordingAudio.currentTime = 0;
      recordingAudio.play().catch(e => console.warn("Recording Audio play failed:", e));
    }

    const startTimeMS = performance.now();
    const maxEndTime = currentTotalTime;
    const FADE_DUR_S = 2.0;

    const drawFrame = (time: number) => {
      const elapsedS = (time - startTimeMS) / 1000;
      
      drawCanvas(elapsedS);
      setCurrentTime(Math.min(elapsedS, maxEndTime));

      if (elapsedS < maxEndTime + FADE_DUR_S) {
        const currentTotal = maxEndTime + FADE_DUR_S;
        const currentPct = Math.min(100, Math.round((elapsedS / currentTotal) * 100));
        setProgress({ text: t.recording, percentage: currentPct });
        animationRef.current = requestAnimationFrame(drawFrame);
      } else {
        setIsAnimating(false);
        if (recordingAudio) {
          recordingAudio.pause();
          recordingAudio.currentTime = 0;
        }
        if (recordMedia && mediaRecorder) {
          mediaRecorder.stop();
        }
      }
    };

    animationRef.current = requestAnimationFrame(drawFrame);
  };



  const handleTimelinePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    el: ElementSequence,
    type: 'move' | 'resize-left' | 'resize-right'
  ) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragState({
      id: el.id,
      type,
      startX: e.clientX,
      initialStartTime: el.startTime,
      initialDuration: el.duration
    });
    setSelectedElementId(el.id);
  };

  const handleTimelinePointerMove = (e: React.PointerEvent<HTMLDivElement>, id: string) => {
    if (!dragState || dragState.id !== id) return;
    e.stopPropagation();

    const dx = e.clientX - dragState.startX;
    const dt = dx / 30; // 30px per second

    setElements(prevElements => {
      const idx = prevElements.findIndex(el => el.id === id);
      if (idx === -1) return prevElements;

      const newElements = [...prevElements];
      const el = { ...newElements[idx] };

      if (dragState.type === 'move') {
        let newStart = Math.max(0, dragState.initialStartTime + dt);
        newStart = Math.round(newStart * 10) / 10;
        el.startTime = newStart;
      } else if (dragState.type === 'resize-right') {
        let newDur = Math.max(0.1, dragState.initialDuration + dt);
        newDur = Math.round(newDur * 10) / 10;
        el.duration = newDur;
      } else if (dragState.type === 'resize-left') {
        let newStart = Math.max(0, dragState.initialStartTime + dt);
        newStart = Math.min(newStart, dragState.initialStartTime + dragState.initialDuration - 0.1);
        newStart = Math.round(newStart * 10) / 10;

        let newDur = dragState.initialDuration + (dragState.initialStartTime - newStart);
        newDur = Math.round(newDur * 10) / 10;

        el.startTime = newStart;
        el.duration = newDur;
      }

      newElements[idx] = el;
      return newElements;
    });
  };

  const handleTimelinePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragState(null);
    setElements(prev => [...prev].sort((a, b) => a.startTime - b.startTime));
  };

  const addNewTimelineElement = () => {
    const nextStartTime = elements.length ? elements[elements.length - 1].startTime + elements[elements.length - 1].duration : 0;
    const id = `manual-${Date.now()}`;
    const newEl = {
      id,
      paths: [],
      points: [],
      startTime: Number(nextStartTime.toFixed(1)),
      duration: 2.0,
      bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
      label: lang === 'en' ? `Scene ${elements.length + 1}` : `مشهد ${elements.length + 1}`,
      elementType: 'visual' as const,
      writingDirection: 'auto' as const
    };
    
    if (isSelectionMode) {
      draftElementsRef.current.push(newEl);
    }
    setElements([...elements, newEl]);
    setSelectedElementId(id);
    setActiveElementId(id);
    setIsEraser(false);
  };

  const handleCreateStoryboard = async () => {
    if (!scriptInput.trim()) return;
    setScenes([]);
    setElements([]);
    setMainImgUrl(null);
    setIsStoryboardImg(false);
    setStoryboardStatus('PROCESSING');
    setStoryboardMode('CREATE');
    
    try {
      const response = await fetch('/api/pipeline/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: scriptInput })
      });
      if (!response.ok) {
        let errMsg = 'Failed to create storyboard';
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            errMsg = `${errMsg}: ${errData.error}`;
          } else if (errData && errData.message) {
            errMsg = `${errMsg}: ${errData.message}`;
          }
        } catch {
          try {
            const text = await response.text();
            if (text) {
              errMsg = `${errMsg} (Status ${response.status}): ${text.substring(0, 150)}`;
            } else {
              errMsg = `${errMsg} (Status: ${response.status})`;
            }
          } catch {
            errMsg = `${errMsg} (Status: ${response.status})`;
          }
        }
        throw new Error(errMsg);
      }
      const data = await response.json();
      if (data.scenes && Array.isArray(data.scenes)) {
        setScenes(data.scenes);
        
        let currentStart = 0;
        const tempElements: ElementSequence[] = data.scenes.map((scene: StoryboardScene) => {
          const dur = scene.duration_seconds || 5;
          const start = currentStart;
          currentStart += dur;

          // Scale bounds from 1920x1080 design space to actual canvas dimensions
          const sceneBounds = scene.bounds || { minX: 0, maxX: 1920, minY: 0, maxY: 1080 };
          const canvasWidth = canvasRef.current?.width || 1920;
          const canvasHeight = canvasRef.current?.height || 1080;
          const minX = (sceneBounds.minX / 1920) * canvasWidth;
          const maxX = (sceneBounds.maxX / 1920) * canvasWidth;
          const minY = (sceneBounds.minY / 1080) * canvasHeight;
          const maxY = (sceneBounds.maxY / 1080) * canvasHeight;

          return {
            id: scene.scene_id,
            paths: [],
            points: [],
            startTime: Number(start.toFixed(1)),
            duration: dur,
            bounds: { minX, maxX, minY, maxY },
            label: lang === 'en' ? `Scene ${scene.scene_number}` : `مشهد ${scene.scene_number}`,
            elementType: 'written' as const,
            writingDirection: 'auto' as const
          };
        });
        setElements(tempElements);
        setCurrentTime(0);

        // Call the image generation endpoint to generate the storyboard image
        // automatically. Force the REAL image model (useFreeModel: false) — the
        // free path makes the LLM write raw SVG/path code, which renders as a
        // blueprint of code unrelated to the script. We want a drawn illustration.
        const imgResponse = await fetch('/api/generate-storyboard-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: scriptInput,
            style: storyboardStyle,
            bgColor: 'white',
            useFreeModel: false,
            sceneCount: data.scenes.length
          })
        });

        if (imgResponse.ok) {
          const imgData = await imgResponse.json();
          if (imgData.imageUrl) {
            setIsStoryboardImg(true);
            setStoryboardSteps(imgData.steps || []);
            autoExtractPendingRef.current = true;
            setCanvasBgColor('#ffffff'); // Force background white
            setMainImgUrl(imgData.imageUrl);
            if (imgData.prompt) {
              setStoryboardPrompt(imgData.prompt);
            }
          }
        }
        
        setStoryboardStatus('ACTIVE');
        setStoryboardMode('IDLE');
      }
    } catch (err) {
      console.error(err);
      setStoryboardStatus('EMPTY');
      setStoryboardMode('IDLE');
    }
  };

  const handleEditStoryboard = async () => {
    if (!selectedElementId || !activeSceneText.trim()) return;
    setStoryboardMode('EDIT');
    
    try {
      const response = await fetch('/api/pipeline/edit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: 'default-project',
          scene_id: selectedElementId,
          text: activeSceneText
        })
      });
      if (!response.ok) {
        let errMsg = 'Failed to edit storyboard';
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            errMsg = `${errMsg}: ${errData.error}`;
          } else if (errData && errData.message) {
            errMsg = `${errMsg}: ${errData.message}`;
          }
        } catch {
          try {
            const text = await response.text();
            if (text) {
              errMsg = `${errMsg} (Status ${response.status}): ${text.substring(0, 150)}`;
            } else {
              errMsg = `${errMsg} (Status: ${response.status})`;
            }
          } catch {
            errMsg = `${errMsg} (Status: ${response.status})`;
          }
        }
        throw new Error(errMsg);
      }
      const data = await response.json();
      if (data.success && data.scene) {
        const updatedScenes = scenes.map(s => {
          if (s.scene_id === selectedElementId) {
            return {
              ...s,
              text: data.scene.text,
              duration_seconds: data.scene.duration_seconds
            };
          }
          return s;
        });
        setScenes(updatedScenes);
        
        const updatedElements = elements.map(el => {
          if (el.id === selectedElementId) {
            return {
              ...el,
              duration: data.scene.duration_seconds
            };
          }
          return el;
        });
        
        let timeAccumulator = 0;
        const adjustedElements = updatedElements.map(el => {
          const newEl = { ...el, startTime: Number(timeAccumulator.toFixed(1)) };
          timeAccumulator += el.duration;
          return newEl;
        });
        
        setElements(adjustedElements);
        setStoryboardMode('IDLE');
      }
    } catch (err) {
      console.error(err);
      setStoryboardMode('IDLE');
    }
  };

  const updateElementProperty = <K extends keyof ElementSequence>(
    index: number,
    field: K,
    value: ElementSequence[K]
  ) => {
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



  const TimelineMapping = () => {
    if (!audioUrl) return null;

    return (
      <div id="audio-timeline-section" className="mt-8 space-y-4 border-t border-white/10 pt-6">
        <label className="text-[10px] font-bold tracking-widest text-stone-500 uppercase flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-amber-500" />
            <Volume2 className="w-4 h-4 text-indigo-600" />
            {t.timelineTitle}
          </span>
          {audioDuration > 0 && <span className="text-[10px] font-mono text-slate-400">{audioDuration.toFixed(1)}s</span>}
        </label>
        
        <div className="flex gap-2">
           {transcription.length > 0 && (
              <button
                onClick={autoSyncElements}
                disabled={isSyncing}
                className="flex-1 px-3 py-2 bg-indigo-50 hover:bg-indigo-100/70 text-indigo-700 text-[10px] font-bold uppercase rounded-lg border border-indigo-100 transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                {isSyncing ? <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                {t.autoSync}
              </button>
           )}
        </div>

        {isTranscribing ? (
          <div className="flex flex-col items-center gap-3 py-6 bg-slate-50 rounded-xl border border-slate-100">
             <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
             <span className="text-[10px] text-slate-500 animate-pulse">{t.transcribing}</span>
          </div>
        ) : transcription.length > 0 ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 max-h-72 overflow-y-auto custom-scrollbar">
              {transcription.map((w, idx) => {
                const mappedEl = elements.find(el => el.wordIndex === idx);
                const isSelectedForWord = elements.find(el => el.id === selectedElementId)?.wordIndex === idx;
                
                return (
                  <button
                    key={idx}
                    onClick={() => selectedElementId && mapElementToWord(selectedElementId, idx)}
                    className={cn(
                      "px-3 py-2 text-xs rounded-lg transition-all border whitespace-nowrap shadow-sm",
                      isSelectedForWord
                        ? "bg-indigo-600 border-indigo-600 text-white font-bold"
                        : mappedEl
                        ? "bg-indigo-50 border-indigo-100 text-indigo-700"
                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                    )}
                  >
                    {w.word}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400 italic px-1 text-center bg-slate-50 py-2 rounded-lg">
              {t.mapHelp}
            </p>
          </div>
        ) : (
          <div className="p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center flex flex-col gap-2">
            <Play className="w-5 h-5 text-slate-300 mx-auto" />
            <span className="text-[10px] text-slate-400">Awaiting transcription result...</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn("flex flex-col h-screen bg-[#f4f5f8] text-slate-800 font-sans overflow-hidden selection:bg-indigo-500/30", isRtl ? "rtl" : "ltr")} dir={isRtl ? 'rtl' : 'ltr'}>
      
      {/* Header */}
      <header className="h-16 px-8 flex items-center justify-between border-b border-slate-200 bg-white shrink-0 z-30 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
            <div className="w-2 h-2 bg-indigo-600 rounded-full shadow-[0_0_8px_rgba(79,70,229,0.4)] animate-pulse"></div>
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-800 font-display">
            Pen-Reveal <span className="text-indigo-600 font-normal">Studio</span>
          </span>
        </div>
        
        {/* Progress Bar for Rendering/Exporting */}
        {(isExporting || isProcessing) && (
          <div className="flex-1 max-w-xs mx-8 flex flex-col gap-1">
            <div className="flex justify-between text-[9px] tracking-wider uppercase font-bold text-indigo-600">
              <span>{progress.text}</span>
              <span>{progress.percentage}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
              <div className="bg-indigo-600 h-full transition-all duration-300 ease-out" style={{ width: `${progress.percentage}%` }} />
            </div>
          </div>
        )}
        
        <div className="flex items-center gap-3">
          {/* Language Switcher */}
          <button 
            onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shadow-sm"
          >
            <Languages className="w-3.5 h-3.5 text-indigo-600" />
            {lang === 'en' ? 'عربي' : 'English'}
          </button>

          {/* Share Option */}
          <button 
            onClick={() => setIsShareModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 hover:bg-indigo-100/70 transition-colors cursor-pointer shadow-sm"
          >
            <Link className="w-3.5 h-3.5 text-indigo-600" />
            {lang === 'en' ? 'Share / Invite' : 'مشاركة / دعوة'}
          </button>
          
          {/* One-Click Auto Studio */}
          <button
            disabled={isProcessing || isGeneratingVoice || autoPhase !== 'idle' || !scriptInput.trim()}
            onClick={runAutoStudio}
            title={lang === 'en'
              ? 'Generate scenes, master image, voice and synced drawing automatically from the script'
              : 'توليد المشاهد والصورة الماستر والصوت والرسم المتزامن تلقائياً من السكريبت'}
            className={cn(
              "h-9 px-4 rounded-lg flex items-center justify-center gap-2 text-xs font-bold select-none border transition-all shadow-sm",
              (isProcessing || isGeneratingVoice || autoPhase !== 'idle')
                ? "bg-indigo-100 border-indigo-100 text-indigo-400 cursor-wait"
                : !scriptInput.trim()
                ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                : "bg-gradient-to-r from-indigo-600 to-purple-600 border-transparent text-white hover:from-indigo-700 hover:to-purple-700 active:scale-[0.98] cursor-pointer"
            )}
          >
            {autoPhase !== 'idle'
              ? <Loader2 className="w-3.5 h-3.5 animate-spin text-current" />
              : <Sparkles className="w-3.5 h-3.5 text-current" />}
            {autoPhase === 'creating'
              ? (lang === 'en' ? 'Building…' : 'بيرسم…')
              : autoPhase === 'voicing'
              ? (lang === 'en' ? 'Voicing…' : 'الصوت…')
              : (lang === 'en' ? 'Auto ✨' : 'تلقائي ✨')}
          </button>

          {/* Export Video Button */}
          <button
            disabled={!mainImgUrl || isProcessing || isAnimating || isExporting}
            onClick={() => {
              setIsExporting(true);
              if (elements.length === 0) prepareAnimation();
              else startAnimation(true);
            }}
            className={cn(
              "h-9 px-4 rounded-lg flex items-center justify-center gap-2 text-xs font-semibold select-none border transition-all cursor-pointer shadow-sm",
              !mainImgUrl || isProcessing || isAnimating || isExporting
                ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                : "bg-indigo-600 border-indigo-600 hover:bg-indigo-700 text-white active:scale-[0.98] font-bold"
            )}
          >
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
            ) : (
              <Download className="w-3.5 h-3.5 text-white" />
            )}
            {t.generateExport}
          </button>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <main className="flex-1 flex overflow-hidden relative bg-[#f4f5f8]">
        
        {/* Left Canva-style Tab Bar */}
        <div className="w-20 shrink-0 bg-white border-r border-slate-200 flex flex-col items-center py-6 gap-6 z-30 shadow-[1px_0_3px_rgba(0,0,0,0.015)]">
          {[
            { id: 'assets', label: lang === 'en' ? 'Assets' : 'الوسائط', icon: UploadCloud },
            { id: 'script', label: lang === 'en' ? 'Script' : 'النص والذكاء', icon: Sparkles },
            { id: 'adjust', label: lang === 'en' ? 'Adjust' : 'التعديل', icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeLeftTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveLeftTab(activeLeftTab === tab.id ? null : tab.id as any)}
                className={cn(
                  "w-14 h-14 rounded-xl flex flex-col items-center justify-center gap-1 transition-all relative group cursor-pointer border",
                  isActive 
                    ? "bg-indigo-50 border-indigo-100 text-indigo-700 font-bold" 
                    : "border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                )}
              >
                {isActive && (
                  <div className={cn(
                    "absolute top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-600 rounded-full",
                    isRtl ? "left-0" : "right-0"
                  )} />
                )}
                <Icon className="w-5 h-5" />
                <span className="text-[9px] font-medium tracking-tight leading-none">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Slideout Drawer Panel */}
        <AnimatePresence>
          {activeLeftTab && (
            <motion.div
              id="sidebar-left"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 340, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="h-full shrink-0 border-r border-slate-200 bg-white z-20 overflow-y-auto flex flex-col custom-scrollbar text-slate-800"
            >
              <div className="p-6 flex-grow flex flex-col justify-between space-y-6">
                <div className="space-y-6">
                  
                  {/* Header Title */}
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      {activeLeftTab === 'assets' && (lang === 'en' ? 'Asset Management' : 'إدارة الوسائط')}
                      {activeLeftTab === 'script' && (lang === 'en' ? 'AI Storyboard & Script' : 'لوحة القصة والذكاء')}
                      {activeLeftTab === 'adjust' && (lang === 'en' ? 'Animation Adjustments' : 'إعدادات الحركة')}
                    </h3>
                    <button 
                      onClick={() => setActiveLeftTab(null)}
                      className="text-slate-400 hover:text-slate-700 transition-colors text-xs font-semibold cursor-pointer"
                    >
                      {lang === 'en' ? 'Close' : 'إغلاق'}
                    </button>
                  </div>

                  {/* 1. ASSETS TAB CONTENT */}
                  {activeLeftTab === 'assets' && (
                    <div className="space-y-6">
                      {/* AI Storyboard Creator */}
                      <div className="p-4 border border-slate-200 bg-slate-50/50 rounded-xl space-y-4 shadow-sm">
                        <span className="text-[10px] font-bold tracking-widest text-indigo-600 uppercase flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" />
                          AI Storyboard Creator
                        </span>
                        
                        {storyboardStatus === 'EMPTY' && (
                          <div className="space-y-3">
                            <textarea
                              rows={4}
                              value={scriptInput}
                              onChange={(e) => setScriptInput(e.target.value)}
                              placeholder="Type script here to auto-generate scenes..."
                              dir="auto"
                              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:border-indigo-500/50 outline-none resize-none leading-normal shadow-inner"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={handleCreateStoryboard}
                                disabled={!scriptInput.trim()}
                                className="flex-grow py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-[10.5px] rounded-lg cursor-pointer transition-colors shadow-sm"
                              >
                                Create Storyboard
                              </button>
                              <button
                                disabled={true}
                                className="flex-grow py-2 border border-slate-200 text-slate-400 font-bold text-[10.5px] rounded-lg cursor-not-allowed bg-slate-100"
                              >
                                Edit Storyboard
                              </button>
                            </div>
                          </div>
                        )}

                        {storyboardStatus === 'PROCESSING' && (
                          <div className="space-y-3 py-4 flex flex-col items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                            <span className="text-[10px] font-bold text-slate-500 animate-pulse">Generating Storyboard...</span>
                          </div>
                        )}

                        {storyboardStatus === 'ACTIVE' && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-505 font-bold">Active Storyboard ({scenes.length} Scenes)</span>
                              <button
                                onClick={() => {
                                  setStoryboardStatus('EMPTY');
                                  setScenes([]);
                                  setElements([]);
                                }}
                                className="text-[9px] text-rose-605 hover:text-rose-700 font-bold cursor-pointer"
                              >
                                Reset
                              </button>
                            </div>

                            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                              {scenes.map((scene) => {
                                const isSelected = selectedElementId === scene.scene_id;
                                return (
                                  <div
                                    key={scene.scene_id}
                                    onClick={() => setSelectedElementId(isSelected ? null : scene.scene_id)}
                                    className={cn(
                                      "p-2 rounded-lg border transition-all cursor-pointer flex gap-2 text-[10px]",
                                      isSelected
                                        ? "border-indigo-500 bg-indigo-50/70 text-indigo-700 font-bold shadow-sm"
                                        : "border-slate-200 bg-white text-slate-605 hover:border-slate-350"
                                    )}
                                  >
                                    <span className="font-bold text-indigo-600 shrink-0">#{scene.scene_number}</span>
                                    <span className="truncate flex-1 text-slate-700">{scene.text}</span>
                                  </div>
                                );
                              })}
                            </div>

                            {selectedElementId && scenes.some(s => s.scene_id === selectedElementId) && (
                              <div className="space-y-2 pt-2 border-t border-slate-100">
                                <textarea
                                  rows={2}
                                  value={activeSceneText}
                                  onChange={(e) => setActiveSceneText(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-[11px] text-slate-800 focus:border-indigo-500/50 outline-none resize-none leading-normal shadow-inner"
                                />
                                <button
                                  onClick={handleEditStoryboard}
                                  disabled={storyboardMode === 'EDIT' || !activeSceneText.trim()}
                                  className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-[10px] rounded-lg transition-all shadow-sm"
                                >
                                  {storyboardMode === 'EDIT' ? "Updating..." : "Edit Storyboard"}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Custom Media Uploads */}
                      <div className="space-y-5 border-t border-slate-100 pt-4">
                        <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                          Custom Media Uploads
                        </span>
                        
                        {/* Main Image Upload */}
                        <div className="flex flex-col gap-2.5">
                          <label className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">{t.mainImage}</label>
                          <label className={cn(
                            "h-32 w-full border border-dashed rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all group",
                            mainImgUrl ? "border-indigo-500 bg-indigo-50/10" : "border-slate-200 bg-slate-50 hover:bg-slate-100/70"
                          )}>
                            {mainImgUrl ? (
                              <img src={mainImgUrl} alt="preview" className="h-20 object-contain rounded-md shadow-sm" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors text-slate-400">
                                <UploadCloud className="w-5 h-5" />
                              </div>
                            )}
                            <span className="text-xs text-slate-500">{mainImgUrl ? t.changeAsset : t.dropAsset}</span>
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setMainImgUrl)} />
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setMainImgUrl(DEMO_IMAGE);
                              setIsStoryboardImg(false);
                            }}
                            className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-indigo-600 text-xs font-semibold rounded-lg border border-slate-200 transition-all cursor-pointer text-center shadow-sm"
                          >
                            {t.loadDemoArt}
                          </button>
                        </div>

                        {/* Pen Overlay */}
                        <div className="flex flex-col gap-2.5">
                          <label className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">{t.penOverlay}</label>
                          <label className={cn(
                            "flex flex-col items-center gap-2 p-4 border border-dashed rounded-xl cursor-pointer transition-colors",
                            "border-slate-200 bg-slate-50 hover:bg-slate-100/70"
                          )}>
                            <span className="text-xs text-slate-500 flex items-center gap-2">
                              <ImageIcon className="w-4 h-4 text-slate-400" />
                              {t.selectPen}
                            </span>
                            <input type="file" accept="image/png" className="hidden" onChange={(e) => handleImageUpload(e, setPenImgUrl)} />
                          </label>
                        </div>

                        {/* Audio Asset */}
                        <div className="flex flex-col gap-2.5">
                          <div className="flex justify-between items-center">
                            <label className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">{t.audioTitle}</label>
                            <div className="flex rounded bg-slate-100 border border-slate-200 p-0.5 gap-0.5 shadow-sm">
                              <button 
                                onClick={() => setScriptMode('upload')}
                                className={cn("px-2 py-0.5 text-[9px] rounded transition-all cursor-pointer", scriptMode === 'upload' ? "bg-white text-indigo-600 font-semibold shadow-sm" : "text-slate-500 hover:text-slate-700")}
                              >
                                {t.uploadAudioTab}
                              </button>
                              <button 
                                onClick={() => setScriptMode('text')}
                                className={cn("px-2 py-0.5 text-[9px] rounded transition-all cursor-pointer", scriptMode === 'text' ? "bg-white text-indigo-600 font-semibold shadow-sm" : "text-slate-500 hover:text-slate-700")}
                              >
                                {t.writeScriptTab}
                              </button>
                            </div>
                          </div>

                          {scriptMode === 'upload' ? (
                            <label htmlFor="audio-upload" className={cn(
                              "flex flex-col items-center gap-2 p-4 border border-dashed rounded-xl cursor-pointer transition-colors",
                              audioUrl ? "border-indigo-500 bg-indigo-50/10" : "border-slate-200 bg-slate-50 hover:bg-slate-100/70"
                            )}>
                              <span className="text-xs text-slate-500 flex items-center gap-2">
                                {isTranscribing ? <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /> : <Play className="w-4 h-4 text-slate-400" />}
                                {audioUrl ? "Audio Active" : t.selectAudio}
                              </span>
                              <input id="audio-upload" type="file" accept="audio/*" className="hidden" onChange={handleAudioUpload} />
                            </label>
                          ) : (
                            <div className="flex flex-col gap-2.5 p-3 border border-slate-200 bg-slate-50/50 rounded-xl">
                              <div className="flex justify-between items-center">
                                <span className="text-[9px] text-slate-500 font-bold uppercase">{t.narratorVoiceName}</span>
                                <select
                                  value={voiceName}
                                  onChange={(e) => setVoiceName(e.target.value)}
                                  className="bg-white border border-slate-200 text-slate-700 text-[10px] rounded px-1.5 py-0.5 outline-none focus:border-indigo-500 cursor-pointer font-semibold shadow-sm"
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
                                dir="auto"
                                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:border-indigo-500/50 outline-none resize-none leading-relaxed shadow-inner"
                              />
                              
                              <button
                                onClick={generateNarratorVoice}
                                disabled={isGeneratingVoice || !scriptText.trim()}
                                className="w-full flex justify-center items-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-[11px] rounded-lg transition-all shadow-sm active:scale-[0.98] cursor-pointer"
                              >
                                {isGeneratingVoice ? (
                                  <>
                                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>{t.generatingVoice}</span>
                                  </>
                                ) : (
                                  <span>{t.generateVoiceBtn}</span>
                                )}
                              </button>

                              {audioUrl && (
                                <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-lg flex flex-col gap-1 text-[10px] text-indigo-700 font-mono">
                                  <span>🎙️ Voiceover Loaded</span>
                                  <div className="flex items-center justify-between mt-2 p-2 bg-white/50 rounded-lg border border-indigo-100/50">
                                    <button
                                      type="button"
                                      onClick={togglePlay}
                                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-[10px] font-bold uppercase transition-all shadow-sm cursor-pointer flex items-center gap-1"
                                    >
                                      {isPlaying ? <span className="w-2 h-2 bg-white rounded-full animate-ping inline-block mr-1" /> : null}
                                      {isPlaying ? (lang === 'en' ? 'Pause' : 'إيقاف') : (lang === 'en' ? 'Play Voiceover' : 'تشغيل الصوت')}
                                    </button>
                                    <span className="text-[10px] font-mono text-slate-500">
                                      {currentTime.toFixed(1)}s / {audioDuration.toFixed(1)}s
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 2. SCRIPT TAB CONTENT */}
                  {activeLeftTab === 'script' && (
                    <div className="space-y-6">
                      {/* AI Storyboard Block */}
                      <div className="p-4 border border-slate-200 bg-slate-50/50 rounded-xl space-y-4 shadow-sm">
                        <span className="text-[11px] font-bold tracking-wider text-indigo-600 uppercase flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                          {t.aiStoryboardTitle}
                        </span>

                        {/* Image Generator Model Selector */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-slate-500 font-medium tracking-wide block">{t.aiStoryboardModel}</label>
                          <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 shadow-inner">
                            <button
                              type="button"
                              onClick={() => setUseFreeModel(true)}
                              className={cn(
                                "flex-1 py-1.5 rounded-md text-[10px] sm:text-[11px] font-medium transition-all text-center cursor-pointer",
                                useFreeModel 
                                  ? "bg-white text-indigo-600 font-semibold shadow-sm" 
                                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50/50"
                              )}
                            >
                              {t.aiFreeGeminiModel}
                            </button>
                            <button
                              type="button"
                              onClick={() => setUseFreeModel(false)}
                              className={cn(
                                "flex-1 py-1.5 rounded-md text-[10px] sm:text-[11px] font-medium transition-all text-center cursor-pointer",
                                !useFreeModel 
                                  ? "bg-white text-indigo-600 font-semibold shadow-sm" 
                                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50/50"
                              )}
                            >
                              {t.aiPaidImagenModel}
                            </button>
                          </div>
                        </div>

                        {/* Style Selector */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-slate-505 font-medium tracking-wide block">{t.aiStoryboardStyle}</label>
                          <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto custom-scrollbar p-1 bg-slate-100 rounded-lg border border-slate-200">
                            {['Auto-select', 'Comic Strip', 'Kawaii', 'Clay', 'Sketch Note', 'Anime', 'Editorial', 'Instructional', 'Bento Grid', 'Bricks', 'Scientific', 'Professional'].map((styleOption) => {
                              const isSelected = storyboardStyle === styleOption;
                              return (
                                <button
                                  key={styleOption}
                                  type="button"
                                  onClick={() => setStoryboardStyle(styleOption)}
                                  className={cn(
                                    "px-2 py-1 rounded text-[11px] text-left transition-all border border-transparent cursor-pointer",
                                    isSelected
                                      ? "bg-white text-indigo-600 border-indigo-100 font-medium shadow-sm"
                                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50/50"
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
                            "w-full h-9 rounded-lg flex items-center justify-center gap-2 text-xs font-semibold select-none border transition-all cursor-pointer shadow-sm",
                            isGeneratingStoryboard
                              ? "bg-slate-105 border-slate-200 text-slate-400 cursor-not-allowed"
                              : transcription.length === 0
                              ? "bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600 cursor-help"
                              : "bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98]"
                          )}
                          title={transcription.length === 0 ? t.aiStoryboardNoTranscription : ""}
                        >
                          {isGeneratingStoryboard ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                              <span className="text-[11px] truncate max-w-[200px]">{t.aiStoryboardGenerating}</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>{t.aiStoryboardGenBtn}</span>
                            </>
                          )}
                        </button>

                        {storyboardError && (
                          <div role="alert" className="p-2 border border-rose-200 bg-rose-50 rounded-lg text-[10px] text-rose-600 leading-relaxed font-medium">
                            {storyboardError}
                          </div>
                        )}

                        {storyboardPrompt && (
                          <details className="text-[9px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-200 cursor-pointer shadow-inner">
                            <summary className="font-semibold text-slate-600 focus:outline-none">{t.aiStoryboardPromptUsed}</summary>
                            <p className="mt-1 leading-normal text-slate-600 italic whitespace-pre-wrap">{storyboardPrompt}</p>
                          </details>
                        )}
                      </div>

                      {/* Gemini 2.5 Image Editor */}
                      <div className="p-4 border border-slate-200 bg-slate-50/50 rounded-xl space-y-4 shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold tracking-wider text-indigo-600 uppercase flex items-center gap-1.5">
                            <Brush className="w-3.5 h-3.5" />
                            {t.geminiEditTitle}
                          </span>
                          <span className="text-[8px] bg-indigo-50 text-indigo-600 font-mono py-0.5 px-1.5 rounded-full border border-indigo-100">
                            Gemini-2.5
                          </span>
                        </div>

                        {!mainImgUrl ? (
                          <div className="text-slate-500 text-[10px] leading-relaxed italic bg-white p-3 rounded-lg border border-slate-200 text-center">
                            {t.geminiNoImageError}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="relative h-16 w-full rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center p-1 shadow-inner">
                              <img src={mainImgUrl} alt="Active scene" className="h-full object-contain max-w-full opacity-60 rounded" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent flex items-end justify-center pb-1">
                                <span className="text-[9px] text-white font-semibold tracking-wide uppercase">Active Image Target</span>
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <textarea
                                value={editPrompt}
                                onChange={(e) => setEditPrompt(e.target.value)}
                                placeholder={t.geminiEditInputPlaceholder}
                                rows={2}
                                className="w-full text-xs bg-white text-slate-800 border border-slate-200 rounded-lg p-2.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none resize-none placeholder:text-slate-400 leading-relaxed font-sans shadow-inner"
                              />
                            </div>

                            <button
                              type="button"
                              disabled={isEditingImage || !editPrompt.trim()}
                              onClick={handleEditImageWithGemini}
                              className={cn(
                                "w-full h-9 rounded-lg flex items-center justify-center gap-2 text-xs font-semibold select-none border transition-all cursor-pointer shadow-sm",
                                isEditingImage
                                  ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                                  : !editPrompt.trim()
                                  ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
                                  : "bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98]"
                              )}
                            >
                              {isEditingImage ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                                  <span className="text-[11px] truncate">{editStatus || t.geminiEditing}</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
                                  <span>{t.geminiEditBtn}</span>
                                </>
                              )}
                            </button>

                            {editError && (
                              <div role="alert" className="p-2.5 border border-rose-200 bg-rose-50 rounded-lg text-[10px] text-rose-600 leading-relaxed font-medium">
                                {editError}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 3. ADJUST TAB CONTENT */}
                  {activeLeftTab === 'adjust' && (
                    <div className="space-y-6">
                      {/* Animation Logic */}
                      <div className="p-4 border border-slate-200 bg-slate-50/50 rounded-xl space-y-4 shadow-sm">
                        <span className="text-[10px] font-bold tracking-widest text-indigo-600 uppercase block">
                          {t.animationLogic}
                        </span>

                        <div className="flex bg-slate-100 rounded-lg p-1 gap-1 border border-slate-200 shadow-inner">
                          <button
                            type="button"
                            onClick={() => setColorMode('outline')}
                            className={cn("flex-grow py-1.5 text-[10px] rounded leading-none transition-colors cursor-pointer", colorMode === 'outline' ? "bg-white text-indigo-600 font-bold shadow-sm" : "text-slate-500 hover:text-slate-700")}
                          >
                            {t.drawOutline}
                          </button>
                          <button
                            type="button"
                            onClick={() => setColorMode('paint')}
                            className={cn("flex-grow py-1.5 text-[10px] rounded leading-none transition-colors cursor-pointer", colorMode === 'paint' ? "bg-white text-indigo-600 font-bold shadow-sm" : "text-slate-505 hover:text-slate-700")}
                          >
                            {t.paintOriginal}
                          </button>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs text-slate-700 font-medium flex justify-between">
                            <span>{t.penSpeed}</span>
                            {storyboardStatus === 'ACTIVE' ? (
                              <span className="text-[9px] bg-indigo-50 text-indigo-650 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider animate-pulse">Optimized by AI</span>
                            ) : (
                              <span className="text-[10px] font-mono text-indigo-600 font-bold">{defaultPenSpeed}</span>
                            )}
                          </label>
                          <input 
                            type="range" 
                            min="1" 
                            max="100" 
                            value={defaultPenSpeed} 
                            onChange={(e) => setDefaultPenSpeed(Number(e.target.value))} 
                            disabled={storyboardStatus === 'ACTIVE'}
                            className={cn("accent-indigo-600 h-1 bg-slate-200 rounded-full appearance-none", storyboardStatus === 'ACTIVE' ? "opacity-50 cursor-not-allowed" : "cursor-pointer")} 
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs text-slate-700 font-medium flex justify-between">
                            <span>{t.edgeSensitivity}</span>
                            {storyboardStatus === 'ACTIVE' ? (
                              <span className="text-[9px] bg-indigo-50 text-indigo-650 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider animate-pulse">Optimized by AI</span>
                            ) : (
                              <span className="text-[10px] font-mono text-indigo-600 font-bold">{edgeSensitivity}%</span>
                            )}
                          </label>
                          <input 
                            type="range" 
                            min="1" 
                            max="100" 
                            value={edgeSensitivity} 
                            onChange={(e) => setEdgeSensitivity(Number(e.target.value))} 
                            onMouseUp={() => { if (mainImgUrl) prepareAnimation(); }} 
                            onTouchEnd={() => { if (mainImgUrl) prepareAnimation(); }} 
                            disabled={storyboardStatus === 'ACTIVE'}
                            className={cn("accent-indigo-600 h-1 bg-slate-200 rounded-full appearance-none", storyboardStatus === 'ACTIVE' ? "opacity-50 cursor-not-allowed" : "cursor-pointer")} 
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs text-slate-700 font-medium flex justify-between">
                            <span>{t.bloomRadius}</span>
                            <span className="text-[10px] font-mono text-indigo-600 font-bold">{glowSize}px</span>
                          </label>
                          <input type="range" min="0" max="100" value={glowSize} onChange={(e) => setGlowSize(Number(e.target.value))} className="accent-indigo-600 h-1 bg-slate-200 rounded-full appearance-none cursor-pointer" />
                        </div>
                        
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs text-slate-700 font-medium flex justify-between">
                            <span>{t.baseOpacity}</span>
                            <span className="text-[10px] font-mono text-indigo-600 font-bold">{baseOpacity}%</span>
                          </label>
                          <input type="range" min="0" max="50" value={baseOpacity} onChange={(e) => setBaseOpacity(Number(e.target.value))} className="accent-indigo-600 h-1 bg-slate-200 rounded-full appearance-none cursor-pointer" />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-slate-700 font-medium">{t.drawDirection}</label>
                          <select 
                            className="bg-white border border-slate-200 text-slate-700 text-xs rounded-lg p-2 outline-none focus:border-indigo-500 shadow-sm font-semibold cursor-pointer"
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
                          <label className="text-xs text-slate-700 font-medium">{t.canvasBg}</label>
                          <select
                            className="bg-white border border-slate-200 text-slate-700 text-xs rounded-lg p-2 outline-none focus:border-indigo-500 shadow-sm font-semibold cursor-pointer"
                            value={canvasBgColor}
                            onChange={(e) => setCanvasBgColor(e.target.value)}
                          >
                            <option value="#050505">{t.bgBlack}</option>
                            <option value="#ffffff">{t.bgWhite}</option>
                            <option value="transparent">{t.bgTrans}</option>
                          </select>
                        </div>
                      </div>

                      {/* Timeline mapping mapping */}
                      <TimelineMapping />

                      {/* Pen Calibration */}
                      <div className="p-4 border border-slate-200 bg-slate-50/50 rounded-xl space-y-4 shadow-sm">
                        <label className="text-[10px] font-bold tracking-widest text-slate-400 uppercase block">{t.penCalibration}</label>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-slate-750 font-medium flex justify-between">
                            <span>{t.scale}</span>
                            <span className="text-[10px] font-mono text-indigo-600 font-bold">{penScale}%</span>
                          </label>
                          <input type="range" min="5" max="50" value={penScale} onChange={(e) => setPenScale(Number(e.target.value))} className="accent-indigo-600 h-1 bg-slate-200 rounded-full appearance-none cursor-pointer" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-slate-750 font-medium flex justify-between">
                            <span>{t.tipXOffset}</span>
                            <span className="text-[10px] font-mono text-indigo-600 font-bold">{penOffsetX}%</span>
                          </label>
                          <input type="range" min="0" max="100" value={penOffsetX} onChange={(e) => setPenOffsetX(Number(e.target.value))} className="accent-indigo-600 h-1 bg-slate-200 rounded-full appearance-none cursor-pointer" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-slate-750 font-medium flex justify-between">
                            <span>{t.tipYOffset}</span>
                            <span className="text-[10px] font-mono text-indigo-600 font-bold">{penOffsetY}%</span>
                          </label>
                          <input type="range" min="0" max="100" value={penOffsetY} onChange={(e) => setPenOffsetY(Number(e.target.value))} className="accent-indigo-600 h-1 bg-slate-200 rounded-full appearance-none cursor-pointer" />
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center Canvas Area & Timeline Track */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-[#f4f5f8]">
          
          {/* Canvas Section */}
          <div className="flex-1 flex items-center justify-center p-8 relative overflow-hidden">
            {/* Whiteboard Dots Background */}
            <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "radial-gradient(#64748b 1.5px, transparent 1.5px)", backgroundSize: "40px 40px" }}></div>
            
            {/* Canvas Aspect Box */}
            <div
              className="relative w-full max-w-5xl aspect-video rounded-3xl overflow-hidden border border-slate-200 shadow-xl flex items-center justify-center z-5 bg-white animate-in fade-in"
            >
              {/* Floating Vertical Toolbar (Left of Canvas Area) */}
              <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col gap-3 bg-white p-2.5 rounded-2xl shadow-lg border border-slate-200/80 z-30">
                <button
                  type="button"
                  onClick={() => { setIsSelectionMode(false); setIsEraser(false); }}
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer",
                    !isSelectionMode && !isEraser 
                      ? "bg-indigo-50 text-indigo-600 shadow-sm border border-indigo-100" 
                      : "text-slate-400 hover:text-slate-700 hover:bg-slate-55 border border-transparent"
                  )}
                  title="Select Tool"
                >
                  <MousePointer className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => { setIsSelectionMode(true); setIsEraser(false); }}
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer",
                    isSelectionMode && !isEraser
                      ? "bg-indigo-50 text-indigo-600 shadow-sm border border-indigo-100" 
                      : "text-slate-400 hover:text-slate-700 hover:bg-slate-55 border border-transparent"
                  )}
                  title="Brush Tool"
                >
                  <Brush className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => { setIsSelectionMode(true); setIsEraser(true); }}
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer",
                    isSelectionMode && isEraser
                      ? "bg-rose-50 text-rose-600 shadow-sm border border-rose-100" 
                      : "text-slate-400 hover:text-slate-700 hover:bg-slate-55 border border-transparent"
                  )}
                  title="Eraser Tool"
                >
                  <Eraser className="w-4 h-4" />
                </button>
                <div className="h-px bg-slate-100 mx-1.5" />
                <button
                  type="button"
                  onClick={() => setActiveLeftTab('adjust')}
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer",
                    activeLeftTab === 'adjust'
                      ? "bg-indigo-50 text-indigo-600 shadow-sm border border-indigo-100" 
                      : "text-slate-400 hover:text-slate-700 hover:bg-slate-55 border border-transparent"
                  )}
                  title="Adjust Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>

              {/* Floating Horizontal Toolbar (Bottom Center of Canvas Area) */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2.5 bg-white/95 backdrop-blur-sm px-4 py-2.5 rounded-full shadow-lg border border-slate-200/80 z-30">
                <button
                  type="button"
                  disabled={!mainImgUrl || isProcessing || isAnimating || isExporting}
                  onClick={elements.length === 0 ? prepareAnimation : togglePlay}
                  className="px-4.5 py-2.5 bg-indigo-50 hover:bg-indigo-100/70 disabled:opacity-50 text-indigo-700 text-[10.5px] font-bold uppercase rounded-full transition-all flex items-center justify-center gap-1.5 border border-indigo-100 shadow-sm cursor-pointer active:scale-95"
                >
                  {isPlaying ? (
                    <Pause className="w-3.5 h-3.5 fill-current text-indigo-600" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current text-indigo-600" />
                  )}
                  <span>
                    {isProcessing 
                      ? t.processingMap 
                      : (isPlaying 
                          ? (lang === 'en' ? 'Pause' : 'إيقاف') 
                          : t.previewSequence)}
                  </span>
                </button>
                <div className="w-px h-5 bg-slate-200" />
                <button
                  type="button"
                  disabled={!mainImgUrl || isProcessing || isAnimating || isExporting}
                  onClick={prepareAnimation}
                  className="px-4 py-2 hover:bg-slate-50 text-slate-600 hover:text-slate-800 disabled:opacity-50 text-[10.5px] font-bold uppercase rounded-full transition-all cursor-pointer active:scale-95 border border-transparent"
                >
                  Analyze Assets
                </button>
                <div className="w-px h-5 bg-slate-200" />
                <button
                  type="button"
                  onClick={() => {
                    setMainImgUrl(null);
                    setElements([]);
                    setScenes([]);
                    setStoryboardStatus('EMPTY');
                    setStoryboardMode('IDLE');
                    setAudioUrl(null);
                    setTranscription([]);
                  }}
                  className="px-4 py-2 hover:bg-rose-50 text-rose-600 hover:text-rose-700 text-[10.5px] font-bold uppercase rounded-full transition-all cursor-pointer active:scale-95 border border-transparent"
                >
                  Reset
                </button>
              </div>

              {storyboardStatus === 'EMPTY' && (
                <div className="text-center space-y-5 max-w-md p-7 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200 shadow-lg pointer-events-none z-20 animate-in fade-in zoom-in-95">
                  <div className="w-14 h-14 mx-auto rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 animate-bounce">
                    <Sparkles className="w-7 h-7" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-base font-bold text-slate-800">Welcome to StoryFlow Workspace</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Enter your script in the left panel and click <b>Create Storyboard</b> to segment your story into visual scene blocks automatically.
                    </p>
                  </div>
                </div>
              )}

              {storyboardStatus !== 'EMPTY' && !mainImgUrl && (
                <div className="text-center space-y-4 opacity-50 z-20">
                  <ImageIcon className="w-16 h-16 mx-auto stroke-1 text-slate-400" />
                  <p className="text-sm font-light tracking-widest text-slate-550 uppercase font-display">{t.awaitingAsset}</p>
                </div>
              )}

              {/* Floating Camera Scene Badge */}
              {activeElement && (isPlaying || currentTime > 0) && !isSelectionMode && (
                <div className="absolute top-4 right-4 z-40 pointer-events-none select-none">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/75 backdrop-blur-sm rounded-full border border-white/10 shadow-lg">
                    <div className={cn("w-1.5 h-1.5 rounded-full", isPlaying ? "bg-red-500 animate-pulse" : "bg-slate-400")} />
                    <span className="text-white text-[10px] font-bold tracking-wide">
                      Camera: {activeElement.label || `Scene ${activeElementIndex + 1}`} Active
                    </span>
                  </div>
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
                  // Single isolated frame fills the stage. The pan/scale "camera"
                  // CSS transform was removed: the active frame is now cropped &
                  // stretched inside the draw loop, so no composite-sheet panning.
                  "object-contain pointer-events-auto transition-opacity duration-700 relative z-10",
                  // In selection mode the element shrinks to its bitmap so brush
                  // pointer coordinates map 1:1; during playback it fills the view.
                  isSelectionMode ? "max-w-full max-h-full" : "w-full h-full max-h-[90%]",
                  mainImgUrl && storyboardStatus !== 'EMPTY' ? "opacity-100" : "opacity-0 pointer-events-none absolute",
                  isProcessing && "opacity-50 blur-sm grayscale",
                  isSelectionMode && "cursor-crosshair"
                )}
              />
            </div>
          </div>

          {/* Bottom Timeline Section */}
          <div className="h-48 border-t border-slate-200 bg-white flex flex-col shrink-0 z-10 relative">
            {/* Timeline Controls Header */}
            <div className="h-10 border-b border-slate-200 px-6 flex items-center justify-between shrink-0 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={!mainImgUrl || isProcessing}
                  onClick={togglePlay}
                  className="w-7 h-7 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-sm disabled:opacity-40 cursor-pointer border border-indigo-600"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <Pause className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentTime(0);
                    if (audioUrl && audioRef.current) {
                      audioRef.current.currentTime = 0;
                    }
                    const canvas = canvasRef.current;
                    if (canvas) {
                      const ctx = canvas.getContext('2d');
                      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
                    }
                  }}
                  className="w-7 h-7 rounded-lg bg-white border border-slate-205 hover:bg-slate-50 text-slate-500 flex items-center justify-center shadow-sm cursor-pointer"
                  title="Rewind / Clear Canvas Draw"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <div className="w-px h-4 bg-slate-200" />
                <span className="text-[10px] text-slate-500 font-mono font-bold">
                  Time: {currentTime.toFixed(1)}s / {currentTotalTime.toFixed(1)}s
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-550">
                <AudioLines className="w-4 h-4 text-indigo-600" />
                <span className="text-[10px] font-medium font-mono">
                  {audioUrl ? 'Voiceover Active' : 'No Voiceover Audio'}
                </span>
              </div>
            </div>

            {/* Timeline Tracks scrolling */}
            <div className="flex-1 overflow-x-auto custom-scrollbar flex flex-col min-w-0 bg-slate-50/20">
              {(() => {
                const maxRulerTime = Math.max(60, currentTotalTime);
                const tickCount = Math.ceil(maxRulerTime / 2) + 2;
                const totalTimelineWidth = 80 + maxRulerTime * 30 + 100;
                const barCount = Math.max(160, Math.ceil(maxRulerTime * 4.5));
                return (
                  <div 
                    className="flex-grow flex flex-col select-none relative" 
                    style={{ width: `${totalTimelineWidth}px` }}
                  >
                    {/* Playhead indicator bar */}
                    <div 
                      className="absolute top-0 bottom-0 w-[2px] bg-indigo-500/80 pointer-events-none z-30 flex flex-col items-center"
                      style={{ left: `${80 + currentTime * 30}px` }}
                    >
                      <div className="w-2.5 h-2.5 bg-indigo-600 rotate-45 -mt-[5px] shadow" />
                      <div className="w-px h-full bg-indigo-500" />
                    </div>

                    {/* 1. Time Ruler */}
                    <div 
                      onClick={handleTimelineClick}
                      className="h-6 border-b border-slate-100 flex items-end relative shrink-0 bg-slate-50/50 cursor-pointer"
                    >
                      {Array.from({ length: tickCount }).map((_, i) => (
                        <div 
                          key={i} 
                          className="absolute bottom-0 text-[8px] font-mono text-slate-400 flex flex-col items-center pointer-events-none"
                          style={{ left: `${80 + i * 60}px` }}
                        >
                          <span className="h-1.5 w-px bg-slate-200 mb-0.5"></span>
                          {Math.floor(i * 2 / 60).toString().padStart(2, '0')}:{(i * 2 % 60).toString().padStart(2, '0')}
                        </div>
                      ))}
                    </div>

                    {/* 2. Visual Scene/Elements track */}
                    <div className="h-16 border-b border-slate-100 flex items-center relative bg-white shrink-0">
                      <div className="absolute left-4 flex items-center gap-1.5 z-10 w-20 pointer-events-auto">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pointer-events-none">
                          Scenes
                        </span>
                        <button
                          type="button"
                          onClick={addNewTimelineElement}
                          className="w-5 h-5 rounded bg-white border border-slate-250 hover:bg-slate-50 hover:border-slate-300 text-indigo-650 flex items-center justify-center cursor-pointer shadow-sm transition-all"
                          title={lang === 'en' ? 'Add Scene' : 'إضافة مشهد'}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      
                      {elements.map((el, idx) => {
                        const blockLeft = el.startTime * 30; // 30px per second
                        const blockWidth = el.duration * 30;
                        const isSelected = selectedElementId === el.id;
                        
                        return (
                          <div
                            key={el.id}
                            onPointerMove={(e) => handleTimelinePointerMove(e, el.id)}
                            onPointerUp={handleTimelinePointerUp}
                            onPointerCancel={handleTimelinePointerUp}
                            className={cn(
                              "absolute h-11 rounded-xl border flex items-center justify-between transition-all cursor-pointer shadow-sm select-none group pointer-events-auto",
                              isSelected
                                ? "bg-indigo-50 border-indigo-500 text-indigo-700 font-bold z-20 ring-1 ring-indigo-250"
                                : "bg-white border-slate-200 text-slate-700 hover:border-slate-350 hover:bg-slate-50/50"
                            )}
                            style={{ left: `${80 + blockLeft}px`, width: `${Math.max(65, blockWidth)}px` }}
                          >
                            {/* Left Resize Handle */}
                            <div
                              onPointerDown={(e) => handleTimelinePointerDown(e, el, 'resize-left')}
                              className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-indigo-500/10 active:bg-indigo-500/20 z-30 rounded-l-xl transition-colors"
                              title={lang === 'en' ? 'Drag to resize' : 'اسحب لتغيير المدة'}
                            />

                            {/* Middle Body */}
                            <div
                              onPointerDown={(e) => handleTimelinePointerDown(e, el, 'move')}
                              className="w-full h-full flex items-center pl-2.5 pr-2.5 py-1 overflow-hidden pointer-events-auto"
                            >
                              <div className="flex items-center min-w-0 gap-1.5 flex-1 pr-1.5">
                                {/* Visual Thumbnail Preview */}
                                <div className="w-8 h-6 bg-slate-105 border border-slate-200 rounded overflow-hidden flex items-center justify-center relative shrink-0 select-none shadow-sm">
                                  {mainImgUrl && el.bounds && el.bounds.maxX > el.bounds.minX ? (
                                    <div className="relative w-full h-full overflow-hidden">
                                      <img
                                        src={mainImgUrl}
                                        alt=""
                                        className="absolute max-w-none origin-top-left"
                                        style={{
                                          left: `${-el.bounds.minX * (24 / Math.max(1, el.bounds.maxY - el.bounds.minY))}px`,
                                          top: `${-el.bounds.minY * (24 / Math.max(1, el.bounds.maxY - el.bounds.minY))}px`,
                                          width: `${(canvasRef.current?.width || 1) * (24 / Math.max(1, el.bounds.maxY - el.bounds.minY))}px`,
                                          height: `${(canvasRef.current?.height || 1) * (24 / Math.max(1, el.bounds.maxY - el.bounds.minY))}px`,
                                        }}
                                      />
                                    </div>
                                  ) : (
                                    <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                                  )}

                                  {/* Overlaid inline SVG path preview */}
                                  {el.paths && el.paths.length > 0 && (
                                    <svg
                                      className="absolute inset-0 w-full h-full pointer-events-none"
                                      viewBox={`${el.bounds.minX - 2} ${el.bounds.minY - 2} ${Math.max(5, el.bounds.maxX - el.bounds.minX) + 4} ${Math.max(5, el.bounds.maxY - el.bounds.minY) + 4}`}
                                      fill="none"
                                      stroke="#4f46e5"
                                      strokeWidth="1.5"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <path d={getSvgPathData(el.paths)} />
                                    </svg>
                                  )}
                                </div>

                                <div className="flex flex-col min-w-0 leading-tight">
                                  <span className="text-[9.5px] font-bold truncate text-slate-700">
                                    {el.label || `El ${idx + 1}`}
                                  </span>
                                  <span className="text-[8px] font-mono opacity-65 font-medium text-slate-500">
                                    {el.duration.toFixed(1)}s
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Right Resize Handle */}
                            <div
                              onPointerDown={(e) => handleTimelinePointerDown(e, el, 'resize-right')}
                              className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-indigo-500/10 active:bg-indigo-500/20 z-30 rounded-r-xl transition-colors"
                              title={lang === 'en' ? 'Drag to resize' : 'اسحب لتغيير المدة'}
                            />

                            {/* Delete floating button */}
                            <button
                              type="button"
                              onClick={(e) => deleteElement(e, el.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-[-6px] right-[-6px] w-4.5 h-4.5 bg-rose-600 text-white rounded-full flex items-center justify-center shadow border border-rose-500 hover:bg-rose-700 cursor-pointer z-35"
                              title={t.delete}
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* 3. Audio/Voiceover waveform Track */}
                    <div className="h-10 flex items-center relative bg-slate-50/50 shrink-0">
                      <div className="absolute left-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest pointer-events-none z-10 w-16">
                        Voiceover
                      </div>
                      <div className="absolute inset-0 left-20 right-0 flex items-center h-full pointer-events-none opacity-45">
                        <div className="flex items-center gap-0.5 w-full px-2">
                          {Array.from({ length: barCount }).map((_, idx) => {
                            const hVal = Math.sin(idx * 0.15) * 8 + Math.cos(idx * 0.05) * 6 + 18;
                            return (
                              <div 
                                key={idx} 
                                className={cn(
                                  "w-0.5 rounded-full",
                                  audioUrl ? "bg-indigo-500" : "bg-slate-300"
                                )}
                                style={{ height: `${Math.max(2, hVal)}px` }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Right Sidebar (Layers / Elements) */}
        {elements.length > 0 && (
          !isSelectionMode ? (
          <div className="w-80 shrink-0 border-l border-slate-200 bg-white z-20 flex flex-col text-slate-800">
            <div className="flex flex-col h-full">
              {/* Layers List Header */}
              <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/30">
                <label className="text-[10px] font-bold tracking-widest text-slate-555 uppercase flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  {t.elementsTitle}
                  <button onClick={() => setIsSelectionMode(true)} className="ml-1.5 hover:text-indigo-605 text-slate-400 transition-colors cursor-pointer border border-transparent bg-transparent" title={t.manualSelection}>
                    <Brush className="w-3.5 h-3.5" />
                  </button>
                </label>
                <div className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">{elements.length}</div>
              </div>
              
              <div className="p-4 border-b border-slate-200 bg-slate-50/10">
                <p className="text-[10px] text-slate-400 leading-relaxed">{t.elementsHelp}</p>
                
                {/* Total settings inside sidebar */}
                <div className="flex gap-4 mt-3 pt-3 border-t border-slate-100">
                  <div className="flex-1 flex gap-2 items-center">
                    <label className="text-[9px] text-slate-500 font-bold uppercase">{t.fps}</label>
                    <input type="number" min="15" max="60" value={fps} onChange={(e) => setFps(Number(e.target.value))} className="w-full bg-white border border-slate-205 rounded-lg p-1 text-xs text-slate-800 focus:border-indigo-500/50 outline-none text-center shadow-inner font-semibold" />
                  </div>
                  <div className="flex-1 flex gap-2 items-center">
                    <label className="text-[9px] text-slate-500 font-bold uppercase" title={t.maxDurationInfo}>{t.totalDur}</label>
                    <input type="number" min="1" max="1800" value={Math.round(currentTotalTime)} onChange={(e) => scaleTotalDuration(e.target.value)} className="w-full bg-white border border-slate-205 rounded-lg p-1 text-xs text-indigo-600 focus:border-indigo-500/50 outline-none text-center font-mono font-semibold shadow-inner" />
                  </div>
                </div>
              </div>

              {/* Elements Scroll list */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                {elements.map((el, i) => (
                  <div 
                    key={el.id} 
                    onMouseEnter={() => setHoveredElementId(el.id)}
                    onMouseLeave={() => setHoveredElementId(null)}
                    onClick={() => setSelectedElementId(el.id === selectedElementId ? null : el.id)}
                    className={cn(
                      "group flex flex-col gap-2.5 p-3.5 rounded-xl border transition-all cursor-pointer shadow-sm",
                      selectedElementId === el.id 
                        ? "border-indigo-500 bg-indigo-50/40 shadow-sm" 
                        : "border-slate-200 bg-white hover:border-slate-350",
                      hoveredElementId === el.id && selectedElementId !== el.id && "border-slate-300 bg-slate-50/30"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "text-[10px] font-bold tracking-widest uppercase flex items-center gap-2",
                        selectedElementId === el.id ? "text-indigo-600" : "text-slate-500"
                      )}>
                        <div className="flex flex-col leading-none text-[8px] text-slate-400">
                          <button disabled={i === 0} onClick={(e) => { e.stopPropagation(); moveElement(i, -1); }} className="hover:text-indigo-600 disabled:opacity-30 cursor-pointer bg-transparent border-none">▲</button>
                          <button disabled={i === elements.length - 1} onClick={(e) => { e.stopPropagation(); moveElement(i, 1); }} className="hover:text-indigo-600 disabled:opacity-30 cursor-pointer bg-transparent border-none">▼</button>
                        </div>
                        {selectedElementId === el.id && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                        {el.label ? el.label : `${t.element} ${i + 1}`}
                      </span>
                      <div className="flex gap-2.5 items-center">
                        <span className="text-[9px] font-mono text-slate-400 border border-slate-200 bg-slate-50 px-1 rounded font-medium">{(el.points || el.paths?.flatMap(p=>p) || []).length} pts</span>
                        <button onClick={(e) => deleteElement(e, el.id)} className="text-slate-450 hover:text-rose-600 transition-colors bg-transparent border-none cursor-pointer" title={t.delete}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {el.wordIndex !== undefined && transcription[el.wordIndex] && (
                      <div className="flex items-center justify-between px-2 py-1 bg-indigo-50 rounded-lg border border-indigo-100 shadow-inner">
                        <span className="text-[9px] text-indigo-600/60 font-bold uppercase flex items-center gap-1">
                          <Link className="w-3 h-3" />
                          {t.mapped}
                        </span>
                        <span className="text-[10px] text-indigo-755 font-medium">"{transcription[el.wordIndex].word}"</span>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <div className="flex-1 flex gap-1.5 items-center">
                        <span className="text-[9px] text-slate-400 uppercase w-10 text-right font-medium">{t.startS}</span>
                        <input 
                          type="number" 
                          step="0.1"
                          min="0"
                          value={el.startTime} 
                          onChange={(e) => updateElementProperty(i, 'startTime', Number(e.target.value))} 
                          className="bg-white border border-slate-200 rounded-lg p-1 text-xs text-indigo-600 focus:border-indigo-500/50 outline-none w-full font-mono text-center shadow-inner font-semibold" 
                        />
                      </div>
                      <div className="flex-1 flex gap-1.5 items-center">
                        <span className="text-[9px] text-slate-400 uppercase w-10 text-right font-medium">{t.durS}</span>
                        <input 
                          type="number" 
                          step="0.1" 
                          min="0.1"
                          value={el.duration} 
                          onChange={(e) => updateElementProperty(i, 'duration', Number(e.target.value))} 
                          className="bg-white border border-slate-200 rounded-lg p-1 text-xs text-indigo-600 focus:border-indigo-500/50 outline-none w-full font-mono text-center shadow-inner font-semibold" 
                        />
                      </div>
                    </div>

                    {selectedElementId === el.id && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-3" onClick={(e) => e.stopPropagation()}>
                        {/* Element Type selection */}
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[9px] text-slate-500 font-bold uppercase">{t.elementTypeLabel}</label>
                          <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-0.5 gap-0.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                  e.stopPropagation();
                                  updateElementProperty(i, 'elementType', 'written');
                              }}
                              className={cn(
                                "flex-1 py-1 text-[9px] rounded-md transition-all cursor-pointer font-medium border border-transparent",
                                (el.elementType || 'written') === 'written' 
                                  ? "bg-white text-indigo-600 shadow-sm font-bold" 
                                  : "text-slate-500 hover:text-slate-700"
                              )}
                            >
                              {t.typeWritten}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                  e.stopPropagation();
                                  updateElementProperty(i, 'elementType', 'visual');
                              }}
                              className={cn(
                                "flex-1 py-1 text-[9px] rounded-md transition-all cursor-pointer font-medium border border-transparent",
                                el.elementType === 'visual' 
                                  ? "bg-white text-indigo-600 shadow-sm font-bold" 
                                  : "text-slate-500 hover:text-slate-700"
                              )}
                            >
                              {t.typeVisual}
                            </button>
                          </div>
                        </div>

                        {/* Writing Direction Override */}
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] text-slate-500 font-bold uppercase">{t.drawDirection}</label>
                          <select
                            className="bg-white border border-slate-200 text-slate-700 text-[10px] rounded-lg p-1.5 outline-none focus:border-indigo-500 transition-colors w-full cursor-pointer font-semibold shadow-sm"
                            value={el.writingDirection || 'auto'}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              updateElementProperty(i, 'writingDirection', e.target.value as 'auto' | 'rtl' | 'ltr');
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
            </div>
          </div>
        ) : (
          <div className="w-80 shrink-0 border-l border-slate-200 bg-white z-20 flex flex-col text-slate-800 p-6 space-y-4 animate-in slide-in-from-right">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-slate-600 tracking-wider">
                {t.manualSelection}
              </span>
              <button 
                type="button"
                onClick={() => setIsSelectionMode(false)}
                className="text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg shadow-sm cursor-pointer border border-transparent"
              >
                {t.exitSelection}
              </button>
            </div>

            <p className="text-[10.5px] text-slate-500 leading-normal">
              Brush tool is active. Click and drag over the canvas to group specific paths.
            </p>

            <div className="flex flex-col gap-1.5 pt-2">
              <label className="text-[10px] text-slate-500 font-bold uppercase flex justify-between">
                <span>{t.brushSize}</span>
                <span className="text-indigo-600 font-bold">{brushSize}px</span>
              </label>
              <input 
                type="range" 
                min="5" 
                max="100" 
                value={brushSize} 
                onChange={(e) => setBrushSize(Number(e.target.value))} 
                className="accent-indigo-600 h-1 bg-slate-200 rounded-full appearance-none cursor-pointer" 
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEraser(false)}
                className={cn("flex-grow py-2 text-[10px] flex justify-center items-center gap-1.5 font-bold rounded-lg transition-all cursor-pointer border", !isEraser ? "bg-indigo-50 border-indigo-100 text-indigo-600 shadow-sm font-semibold" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50")}
              >
                <Brush className="w-3.5 h-3.5" />
                {t.brushMode}
              </button>
              <button
                type="button"
                onClick={() => setIsEraser(true)}
                className={cn("flex-grow py-2 text-[10px] flex justify-center items-center gap-1.5 font-bold rounded-lg transition-all cursor-pointer border", isEraser ? "bg-rose-50 border-rose-150 text-rose-600 shadow-sm font-semibold" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50")}
              >
                <Eraser className="w-3.5 h-3.5" />
                {t.eraser}
              </button>
            </div>

            <button type="button" onClick={addNewElement} className="flex items-center justify-center gap-2 w-full py-2.5 border border-indigo-100 hover:bg-indigo-50/30 rounded-lg text-xs font-bold text-indigo-600 transition-all bg-white cursor-pointer shadow-sm">
              <Plus className="w-4 h-4 text-indigo-600" />
              {t.addNewElement}
            </button>

            <div className="flex flex-col gap-2 flex-grow overflow-y-auto pr-1 custom-scrollbar">
              {elements.map((el, i) => (
                <div 
                  key={el.id} 
                  onMouseEnter={() => setHoveredElementId(el.id)}
                  onMouseLeave={() => setHoveredElementId(null)}
                  className="relative group flex gap-1.5"
                >
                  <button 
                    type="button"
                    onClick={() => { setActiveElementId(el.id); setIsEraser(false); }}
                    className={cn(
                      "flex-grow flex items-center justify-between p-2.5 rounded-lg border transition-all text-left cursor-pointer",
                      activeElementId === el.id && !isEraser ? "border-indigo-500 bg-indigo-50/40" : "border-slate-200 bg-white hover:border-slate-350 shadow-sm"
                    )}
                  >
                    <span className={cn("text-[10px] font-bold tracking-widest uppercase flex items-center gap-1.5", activeElementId === el.id && !isEraser ? "text-indigo-600" : "text-slate-500")}>
                      {activeElementId === el.id && !isEraser && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                      {el.label ? el.label : `${t.element} ${i + 1}`}
                    </span>
                    <span className="text-[9px] font-mono text-slate-400">{el.paths.length} paths</span>
                  </button>
                  <button type="button" onClick={(e) => deleteElement(e, el.id)} className="w-9 flex items-center justify-center text-slate-405 hover:text-rose-600 bg-white border border-slate-250 rounded-lg hover:border-rose-300 cursor-pointer shadow-sm" title={t.delete}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          )
        )}

      </main>

      {/* Footer */}
      <footer className="h-10 bg-white border-t border-slate-200 flex items-center justify-between px-8 text-[10px] text-slate-505 shrink-0 z-30 shadow-[0_-1px_3px_rgba(0,0,0,0.015)]">
        <div className="flex gap-6">
          <span>FFmpeg.wasm Embedded</span>
          <span>{t.clientSideRender}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
          <span className="uppercase tracking-tighter font-semibold">{t.systemActive}</span>
        </div>
      </footer>

      {/* Share / Invite Modal */}
      <AnimatePresence>
        {isShareModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsShareModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 relative z-10 overflow-hidden text-slate-800"
            >
              {/* Decorative accent gradient top bar */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

              {/* Close Button */}
              <button 
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer border border-transparent bg-transparent"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex flex-col gap-4">
                <div className="space-y-1 pt-2">
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Link className="w-5 h-5 text-indigo-600" />
                    {t.shareTitle}
                  </h3>
                  <p className="text-xs text-slate-500">{t.shareSubtitle}</p>
                </div>

                {/* Local Network Share Section */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">{t.localNetwork}</h4>
                    <p className="text-[11px] text-slate-505 leading-normal">{t.localNetworkDesc}</p>
                  </div>

                  {localNetworkUrl ? (
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      {/* Link field and copy */}
                      <div className="flex bg-white border border-slate-200 rounded-xl p-1.5 items-center gap-2 shadow-inner flex-1 w-full">
                        <input 
                          type="text" 
                          readOnly 
                          value={localNetworkUrl}
                          className="flex-1 text-xs text-slate-700 bg-transparent outline-none px-2 font-mono font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(localNetworkUrl);
                            setCopiedUrlType('local');
                            setTimeout(() => setCopiedUrlType(null), 2000);
                          }}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-750 text-[10px] font-bold rounded-lg transition-colors cursor-pointer border border-transparent"
                        >
                          {copiedUrlType === 'local' ? t.copied : t.copyLink}
                        </button>
                      </div>

                      {/* QR Code */}
                      <div className="shrink-0 flex flex-col items-center gap-1.5 p-2 bg-white rounded-2xl border border-slate-200 shadow-sm">
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(localNetworkUrl)}`} 
                          alt="QR Code" 
                          className="w-20 h-20"
                        />
                        <span className="text-[9px] text-slate-400 font-semibold uppercase">{t.scanQrCode}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-400 text-xs italic">Loading local IP address...</div>
                  )}
                </div>

                {/* Public Internet Share Section */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">{t.publicInternet}</h4>
                    <p className="text-[11px] text-slate-505 leading-normal">{t.publicInternetDesc}</p>
                  </div>

                  {publicTunnelUrl ? (
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      {/* Link field, copy and password */}
                      <div className="flex-1 w-full space-y-3">
                        <div className="flex bg-white border border-slate-200 rounded-xl p-1.5 items-center gap-2 shadow-inner">
                          <input 
                            type="text" 
                            readOnly 
                            value={publicTunnelUrl}
                            className="flex-1 text-xs text-slate-700 bg-transparent outline-none px-2 font-mono font-medium"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(publicTunnelUrl);
                              setCopiedUrlType('public');
                              setTimeout(() => setCopiedUrlType(null), 2000);
                            }}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-750 text-[10px] font-bold rounded-lg transition-colors cursor-pointer border border-transparent"
                          >
                            {copiedUrlType === 'public' ? t.copied : t.copyLink}
                          </button>
                        </div>

                        {publicIpAddress && (
                          <div className="p-2.5 bg-amber-50 border border-amber-250 rounded-xl text-[10.5px] text-amber-800 leading-relaxed font-sans shadow-sm">
                            <span className="font-bold block text-amber-900 mb-0.5">⚠️ {t.tunnelPasswordNote.split(":")[0]}</span>
                            <span>{t.tunnelPasswordNote.split(":")[1]} </span>
                            <code className="bg-white border border-amber-200 px-1.5 py-0.5 rounded font-mono font-bold select-all text-amber-950">{publicIpAddress}</code>
                          </div>
                        )}
                      </div>

                      {/* QR Code */}
                      <div className="shrink-0 flex flex-col items-center gap-1.5 p-2 bg-white rounded-2xl border border-slate-200/60 shadow-sm">
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(publicTunnelUrl)}`} 
                          alt="QR Code" 
                          className="w-20 h-20"
                        />
                        <span className="text-[9px] text-slate-400 font-semibold uppercase">{t.scanQrCode}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button
                        onClick={startPublicTunnel}
                        disabled={isGeneratingTunnel}
                        className="w-full flex justify-center items-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-755 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-md active:scale-[0.98] cursor-pointer"
                      >
                        {isGeneratingTunnel ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                            <span>{t.generatingPublic}</span>
                          </>
                        ) : (
                          <span>{t.generatePublicBtn}</span>
                        )}
                      </button>
                      
                      {tunnelError && (
                        <div className="text-[10px] text-rose-600 font-medium">
                          {tunnelError}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );

}