import React from 'react';
import { 
  Send, User, Trash2, Pencil,
  ChevronLeft, Menu, Paperclip, Mic, X, Info,
  PanelLeftClose, PanelLeftOpen, Plus, Search,
  MessageSquare, Settings, LogOut, Sparkles,
  ArrowUp, Globe, Image as ImageIcon, Code, MoreHorizontal,
  AudioLines, Copy, RotateCcw, ThumbsUp, ThumbsDown, Square,
  AlertTriangle, LayoutGrid, UserPlus, FileText, Check, Play, ExternalLink,
  BrainCircuit, Sliders, Music, Search as SearchIcon, ChevronDown, Download, Loader2
} from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { motion, AnimatePresence } from 'motion/react';
import { ImageGenerationEffect } from './ImageGenerationEffect';
import { Typewriter } from './Typewriter';
import { MarkdownRenderer } from './MarkdownRenderer';
import { cn } from '../lib/utils';
import { OTIVO_BRAND } from '../constants/brand';
import { DeepSearchIcon } from './DeepSearchIcon';
import { chatWithAssistant, streamChatWithAssistant, generateImage, generateChatTitle } from '../services/aiService';
import { ProjectFile, Attachment } from '../types';
import { loadSessions, saveSessions, deleteSessionFromDB } from '../lib/db';
import { SourceLink } from './SourceLink';

import { SupportedFilesInfo } from './SupportedFilesInfo';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
  isTyping?: boolean;
  files?: { name: string; type: string; data: string; size?: number }[];
  isGeneratingImage?: boolean;
  imagePrompt?: string;
  imageUrl?: string;
  failedImagePrompt?: string;
  imageFileName?: string;
  feedback?: 'positive' | 'negative';
  researchSources?: { title: string; link: string }[];
  activeTool?: { type: string; label: string };
  thought?: string;
  isStreaming?: boolean;
  documents?: DocumentInfo[];
  isFinalizing?: boolean;
}

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  preview?: string;
  isProcessing: boolean;
}

interface DocumentInfo {
  id: string;
  title: string;
  type: 'md' | 'pdf';
  content: string;
}

interface Session {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt?: Date;
}

interface FullPageAssistantProps {
  onBack: () => void;
  onImageGenerated?: (base64: string, prompt: string, fileName?: string) => void;
  files?: ProjectFile[];
  onOpenVoiceAssistant?: () => void;
}

const IMAGE_STYLES = [
  { name: "Monochrome", prompt: "monochrome, black and white style", image: "https://images.unsplash.com/photo-1514316454349-750a7fd3da3a?q=80&w=400&auto=format&fit=crop" },
  { name: "Color block", prompt: "vibrant color block style, bold colors", image: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=400&auto=format&fit=crop" },
  { name: "Runway", prompt: "high fashion runway style, editorial photography", image: "https://images.unsplash.com/photo-1509631179647-0177331693ae?q=80&w=400&auto=format&fit=crop" },
  { name: "Anime's world", prompt: "detailed anime art style, vibrant studio style", image: "https://images.unsplash.com/photo-1560972550-aba3456b5564?q=80&w=400&auto=format&fit=crop" },
  { name: "Inkgraph", prompt: "ink drawing style, high contrast, sketchy", image: "https://images.unsplash.com/photo-1549490349-8643362247b5?q=80&w=400&auto=format&fit=crop" },
  { name: "Technicolor", prompt: "vintage technicolor movie style, high saturation", image: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=400&auto=format&fit=crop" },
  { name: "Gothic city", prompt: "dark gothic city aesthetic, moody, detailed", image: "https://images.unsplash.com/photo-1499092346589-b9b6be3e94b2?auto=format&fit=crop&q=80&w=400" },
  { name: "Cyanotype", prompt: "cyanotype print style, blue and white, antique", image: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=400&auto=format&fit=crop" },
  { name: "Salon", prompt: "classic salon painting style, fine art", image: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=400&auto=format&fit=crop" },
  { name: "Sketch", prompt: "pencil sketch style, rough lines, graphite", image: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=80&w=400&auto=format&fit=crop" },
  { name: "Cinematic", prompt: "cinematic film style, high budget movie look", image: "https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=400&auto=format&fit=crop" },
  { name: "Steampunk", prompt: "steampunk aesthetic, gears, brass, Victorian tech", image: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?q=80&w=400&auto=format&fit=crop" },
  { name: "Sunrise", prompt: "early morning sunrise lighting, warm, glowing", image: "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?q=80&w=400&auto=format&fit=crop" },
  { name: "Mythic fighter", prompt: "epic fantasy mythic fighter style", image: "https://images.unsplash.com/photo-1514539079130-25950c84af65?q=80&w=400&auto=format&fit=crop" },
  { name: "Surreal", prompt: "surrealist art style, dreamlike, abstract", image: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?q=80&w=400&auto=format&fit=crop" },
  { name: "Moody", prompt: "moody atmosphere, dark, atmospheric lighting", image: "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?q=80&w=400&auto=format&fit=crop" }
];

const MUSIC_TRACKS = [
  { name: "90's rap", prompt: "90s boom bap rap style, gritty drums, jazzy samples", image: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=400&auto=format&fit=crop" },
  { name: "Latin pop", prompt: "vibrant latin pop, danceable rhythms, acoustic guitars", image: "https://images.unsplash.com/photo-1514525253344-f21ce07ef41b?q=80&w=400&auto=format&fit=crop" },
  { name: "Folk ballad", prompt: "acoustic folk ballad, storytelling, mellow vibes", image: "https://images.unsplash.com/photo-1459749411177-fe4a16223530?q=80&w=400&auto=format&fit=crop" },
  { name: "8-bit", prompt: "retro 8-bit chip tune, video game style, electronic", image: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=400&auto=format&fit=crop" },
  { name: "Workout", prompt: "high energy workout music, fast tempo, heavy bass", image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=400&auto=format&fit=crop" },
  { name: "Reggaeton", prompt: "urban reggaeton, dembow rhythm, catchy hooks", image: "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=400&auto=format&fit=crop" },
  { name: "R&B romance", prompt: "smooth R&B romance, soulful vocals, intimate vibes", image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=400&auto=format&fit=crop" },
  { name: "Kawaii metal", prompt: "japanese kawaii metal style, heavy riffs, cute vocals", image: "https://images.unsplash.com/photo-1526218626217-dc65a29bb444?q=80&w=400&auto=format&fit=crop" },
  { name: "Cinematic", prompt: "epic cinematic orchestral, dramatic, powerful", image: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?q=80&w=400&auto=format&fit=crop" },
  { name: "Emo", prompt: "classic emo rock, emotional lyrics, melodic guitars", image: "https://images.unsplash.com/photo-1514533212735-5df27d970db0?q=80&w=400&auto=format&fit=crop" },
  { name: "Afropop", prompt: "modern afropop, syncopated rhythms, vibrant energy", image: "https://images.unsplash.com/photo-1453090927415-5f45085b6aee?q=80&w=400&auto=format&fit=crop" },
  { name: "Forest bath", prompt: "ambient forest sounds, relaxing, nature-inspired", image: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=400&auto=format&fit=crop" },
  { name: "K-pop", prompt: "polished K-pop production, catchy synths, high energy", image: "https://images.unsplash.com/photo-1528605248644-14dd04022da1?q=80&w=400&auto=format&fit=crop" },
  { name: "Birthday roast", prompt: "fun birthday roast song, upbeat, humorous", image: "https://images.unsplash.com/photo-1464349153735-7db50ed83c84?q=80&w=400&auto=format&fit=crop" },
  { name: "Folk a cappella", prompt: "pure a cappella folk harmonies, organic vocals", image: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?q=80&w=400&auto=format&fit=crop" },
  { name: "Bad music", prompt: "intentionally quirky and chaotic music style", image: "https://images.unsplash.com/photo-1504196606672-aef5c9cefc92?q=80&w=400&auto=format&fit=crop" }
];

const WRITE_OPTIONS = [
  "Write a creative story set in a futuristic city",
  "Compose a professional email for a project proposal",
  "Write a heartfelt poem about nature",
  "Draft a blog post about artificial intelligence",
  "Create a movie script for a thriller"
];

const LEARN_OPTIONS = [
  "Teach me about Quantum Physics in simple terms",
  "Explain the history of the Roman Empire",
  "Help me learn the basics of React development",
  "How does the stock market work?",
  "Tell me about the mysteries of the deep ocean"
];

const BOOST_OPTIONS = [
  "Give me some daily motivation",
  "Tell me a joke to brighten my day",
  "Share a fun fact about animals",
  "Suggest a relaxing mindfulness exercise",
  "Recommend a book that will inspire me"
];

const ToolLoadingCard: React.FC<{ activity: { type: string, label: string } }> = ({ activity }) => {
  const label = activity.label.toLowerCase();
  const domain = label.includes('youtube') ? 'youtube.com' : 
                 label.includes('github') ? 'github.com' : 
                 label.includes('google') ? 'google.com' : null;

  const iconUrl = domain 
    ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
    : '/logo.png';

  return (
    <div className="flex items-center gap-4 p-5 bg-white/5 border border-white/10 rounded-2xl animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-sm shadow-2xl backdrop-blur-xl">
      <div className="relative flex items-center justify-center shrink-0">
        <div className="absolute inset-[-6px] border-2 border-white/5 rounded-full" />
        <div className="absolute inset-[-6px] border-2 border-t-blue-500 rounded-full animate-spin" />
        <div className="w-12 h-12 rounded-full overflow-hidden bg-[#1a1a1a] flex items-center justify-center p-2 border border-white/10 shadow-inner">
          <img 
            src={iconUrl} 
            alt="" 
            className="w-full h-full object-contain"
            onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png' }}
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-white font-medium text-[15px]">{activity.label}</span>
        <div className="flex items-center gap-1.5">
          <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" />
          <span className="text-white/40 text-[10px] uppercase tracking-[0.2em] font-black">Agentic Active</span>
        </div>
      </div>
    </div>
  );
};

const ResearchSources: React.FC<{ sources?: { title: string, link: string }[] }> = ({ sources }) => {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-4 bg-blue-500/5 border border-blue-500/10 rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500 shadow-2xl">
      <div className="px-4 py-2.5 border-b border-blue-500/10 bg-blue-500/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-blue-400" />
          <h3 className="text-[10px] font-mono uppercase tracking-widest text-blue-400/70">Source Citations</h3>
        </div>
      </div>
      <div className="p-4 flex flex-wrap gap-2">
        {sources.map((source, idx) => (
          <SourceLink 
            key={idx} 
            url={source.link} 
            title={source.title} 
          />
        ))}
      </div>
    </div>
  );
};

const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = React.useState(typeof window !== 'undefined' ? navigator.onLine : true);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};
const FilePreviewItem: React.FC<{ 
  name: string; 
  type: string; 
  progress?: number; 
  preview?: string; 
  size?: number;
  onRemove?: () => void;
}> = ({ name, type, progress, preview, size, onRemove }) => {
  const isImage = type.startsWith('image/');
  const isVideo = type.startsWith('video/');
  
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 10 }}
      className="relative flex items-center gap-3 p-2 bg-white/5 border border-white/10 rounded-xl group/item min-w-[200px] max-w-[300px] backdrop-blur-md shadow-lg"
    >
      <div className="w-12 h-12 rounded-lg bg-[#1a1a1a] flex items-center justify-center overflow-hidden shrink-0 border border-white/5">
        {preview ? (
          <img src={preview} alt="" className="w-full h-full object-cover" />
        ) : isVideo ? (
          <Play className="w-5 h-5 text-blue-400" />
        ) : (
          <FileText className="w-6 h-6 text-emerald-400" />
        )}
      </div>
      
      <div className="flex-1 min-w-0 pr-6">
        <p className="text-xs font-medium text-white/90 truncate">{name}</p>
        <div className="flex items-center gap-2 mt-1">
          {progress !== undefined && progress < 100 ? (
            <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-blue-500"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
              />
            </div>
          ) : (
            <span className="text-[10px] text-white/30 uppercase tracking-wider font-bold">
              {size ? `${(size / 1024 / 1024).toFixed(2)} MB` : 'Ready'}
            </span>
          )}
          {progress !== undefined && <span className="text-[10px] font-mono text-blue-400">{progress}%</span>}
        </div>
      </div>

      {onRemove && (
        <button 
          onClick={onRemove}
          className="absolute top-1 right-1 p-1 hover:bg-white/10 rounded-full transition-all opacity-0 group-hover/item:opacity-100"
        >
          <X className="w-3.5 h-3.5 text-white/40" />
        </button>
      )}
    </motion.div>
  );
};

const MessageAttachments: React.FC<{ files: { name: string; type: string; data: string }[] }> = ({ files }) => {
  return (
    <div className="flex flex-wrap gap-3 mb-4">
      {files.map((file, idx) => {
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        
        return (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative group rounded-2xl overflow-hidden border border-white/10 bg-[#161618] shadow-2xl max-w-sm"
          >
            {isImage ? (
              <img 
                src={file.data} 
                alt={file.name} 
                className="max-h-[300px] w-full object-contain bg-black/20" 
                referrerPolicy="no-referrer"
              />
            ) : isVideo ? (
              <video 
                src={file.data} 
                controls 
                className="max-h-[300px] w-full bg-black" 
              />
            ) : (
              <div className="flex items-center gap-4 p-4 pr-6">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                  <FileText className="w-6 h-6 text-emerald-400" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-white/90 truncate max-w-[200px]">{file.name}</span>
                  <span className="text-[10px] text-white/30 uppercase tracking-widest font-black">Document Asset</span>
                </div>
              </div>
            )}
            
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
              <button 
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = file.data;
                  a.download = file.name;
                  a.click();
                }}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-all"
                title="Download"
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};


const DocumentViewer: React.FC<{ doc: DocumentInfo; onClose: () => void }> = ({ doc, onClose }) => {
  const [pdfUrl, setPdfUrl] = React.useState<string | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);

  const downloadDocument = async () => {
    if (doc.type === 'pdf') {
      if (pdfUrl) {
        const a = document.createElement('a');
        a.href = pdfUrl;
        a.download = `${doc.title || 'document'}.pdf`;
        a.click();
        return;
      }

      setIsGenerating(true);
      try {
        if (contentRef.current) {
          const opt = {
            margin:       15,
            filename:     `${doc.title || 'document'}.pdf`,
            image:        { type: 'jpeg' as const, quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
          };

          const pdf = await html2pdf().set(opt).from(contentRef.current).toPdf().get('pdf');
          const url = pdf.output('bloburl');
          setPdfUrl(url);
          setIsGenerating(false);

          const a = document.createElement('a');
          a.href = url;
          a.download = `${doc.title || 'document'}.pdf`;
          a.click();
        } else {
          setIsGenerating(false);
        }
      } catch (err) {
        console.error('PDF generation failed:', err);
        setIsGenerating(false);
      }
      return;
    }

    const blob = new Blob([doc.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.title || 'document'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex-1 flex flex-col bg-[#0a0a0a] border-l border-white/10 h-full overflow-hidden shadow-2xl"
    >
      <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-black/40 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <FileText className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white leading-tight truncate max-w-[200px]">{doc.title}</h3>
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-mono">{doc.type.toUpperCase()} VIEW</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={downloadDocument}
            disabled={isGenerating}
            className="flex items-center gap-2 px-3 py-1.5 h-10 bg-white/5 hover:bg-white/10 rounded-full text-[11px] font-bold text-white transition-all border border-white/10 disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>Download</span>
          </button>
          <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-red-500/20 rounded-full text-white/40 hover:text-red-400 transition-all border border-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-8 md:p-12 custom-scrollbar selection:bg-blue-500/30 relative">
        {doc.type === 'pdf' ? (
          <>
            <div className="absolute left-[-9999px] top-0 w-[800px] bg-white text-black p-10">
               <div ref={contentRef} className="prose prose-p:leading-relaxed prose-headings:tracking-tight prose-headings:font-bold prose-lg max-w-none text-black prose-a:text-blue-600 prose-code:text-black">
                 <MarkdownRenderer content={doc.content} pdfMode={true} />
               </div>
            </div>
            
            {/* Visible Premium High-Fidelity PDF Paper Sheet Preview */}
            <div className="w-full h-full bg-[#141416] p-4 md:p-6 overflow-y-auto custom-scrollbar flex justify-center items-start rounded-xl border border-white/5">
              <div className="w-full max-w-3xl bg-white text-black p-8 md:p-16 rounded-xl shadow-2xl border border-black/5 min-h-full">
                <div className="prose prose-p:leading-relaxed prose-headings:tracking-tight prose-headings:font-bold prose-lg max-w-none text-black prose-a:text-blue-600 prose-code:text-black">
                  <MarkdownRenderer content={doc.content} pdfMode={true} />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="max-w-3xl mx-auto prose prose-invert prose-p:leading-relaxed prose-headings:tracking-tight prose-headings:font-bold prose-lg">
            <MarkdownRenderer content={doc.content} />
          </div>
        )}
      </div>
    </motion.div>
  );
};

const StaticPreview: React.FC<{ content: string; onClose: () => void }> = ({ content, onClose }) => {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  React.useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                body { margin: 0; background: #000; color: #fff; font-family: sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                * { box-sizing: border-box; }
              </style>
            </head>
            <body>
              ${content}
            </body>
          </html>
        `);
        doc.close();
      }
    }
  }, [content]);

  const downloadHtml = () => {
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `preview-${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex-1 flex flex-col bg-[#0d0d0f] border-l border-white/10 h-full overflow-hidden"
    >
      <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-black/40 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <Globe className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white leading-tight">Live Preview</h3>
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-mono">Sandbox Environment</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={downloadHtml}
            className="flex items-center gap-2 px-3 py-1.5 h-10 bg-white/5 hover:bg-white/10 rounded-full text-[11px] font-bold text-white transition-all border border-white/10"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Save HTML</span>
          </button>
          <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-red-500/20 rounded-full text-white/40 hover:text-red-400 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="flex-1 bg-black overflow-hidden relative">
        <iframe 
          ref={iframeRef}
          title="Preview"
          className="w-full h-full border-none"
        />
      </div>
    </motion.div>
  );
};

const RESEARCH_SUGGESTIONS = [
  "Latest React & Next.js documentation",
  "Modern Tailwind UI & UX patterns",
  "State management best practices",
  "Accessible component design guides",
  "Performance optimization techniques"
];

export const FullPageAssistant: React.FC<FullPageAssistantProps> = ({ 
  onBack, 
  onImageGenerated,
  files = [],
  onOpenVoiceAssistant
}) => {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [sessions, setSessions] = React.useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = React.useState<string | null>(null);
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const isCancelledRef = React.useRef(false);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [selectedFiles, setSelectedFiles] = React.useState<{ name: string; type: string; data: string; size: number }[]>([]);
  const [uploadingFiles, setUploadingFiles] = React.useState<UploadingFile[]>([]);
  const [isVoiceActive, setIsVoiceActive] = React.useState(false);
  const [typingMessageId, setTypingMessageId] = React.useState<string | null>(null);
  const [showSupportedFiles, setShowSupportedFiles] = React.useState(false);
  const [isResearchPickerOpen, setIsResearchPickerOpen] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isEditingId, setIsEditingId] = React.useState<string | null>(null);
  const [editingContent, setEditingContent] = React.useState('');
  const [isImageStylePickerOpen, setIsImageStylePickerOpen] = React.useState(false);
  const [isMusicPickerOpen, setIsMusicPickerOpen] = React.useState(false);
  const [isWritePickerOpen, setIsWritePickerOpen] = React.useState(false);
  const [isLearnPickerOpen, setIsLearnPickerOpen] = React.useState(false);
  const [isBoostPickerOpen, setIsBoostPickerOpen] = React.useState(false);
  const [selectedStyle, setSelectedStyle] = React.useState<typeof IMAGE_STYLES[0] | null>(null);
  const [selectedTrack, setSelectedTrack] = React.useState<typeof MUSIC_TRACKS[0] | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [sessionToDelete, setSessionToDelete] = React.useState<Session | null>(null);
  const [isSharing, setIsSharing] = React.useState(false);
  const [showAppsGrid, setShowAppsGrid] = React.useState(false);
  
  // Static Preview State
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
  const [previewContent, setPreviewContent] = React.useState('');
  const [activeDocument, setActiveDocument] = React.useState<DocumentInfo | null>(null);
  const isOnline = useOnlineStatus();
  const [wasOffline, setWasOffline] = React.useState(false);

  React.useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    } else if (wasOffline) {
      // Auto-dismiss the "Connection Restored" banner after 4 seconds
      const timer = setTimeout(() => setWasOffline(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  const handleRunCode = (code: string, language: string) => {
    if (language === 'html') {
      setPreviewContent(code);
      setIsPreviewOpen(true);
    }
  };

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const inputContainerRef = React.useRef<HTMLDivElement>(null);
  const emptyInputContainerRef = React.useRef<HTMLDivElement>(null);

  // Mobile Keyboard Handling with Visual Viewport API
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handleResize = () => {
      if (!window.visualViewport) return;
      
      // Calculate the distance from the bottom of the visual viewport to the bottom of the layout
      const offset = window.innerHeight - window.visualViewport.height;
      
      // Apply offset to the input containers if they exist
      if (inputContainerRef.current) {
        // Use translate3d for better performance on mobile
        inputContainerRef.current.style.transform = `translate3d(0, -${offset}px, 0)`;
      }
      if (emptyInputContainerRef.current) {
        emptyInputContainerRef.current.style.transform = `translate3d(0, -${offset}px, 0)`;
      }

      // If keyboard is open, scroll to bottom to keep input visible
      if (offset > 100) {
        setTimeout(() => {
          textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
    };

    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);
    
    // Initial call
    handleResize();
    
    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
    };
  }, []);

  // Scroll into view on focus
  const handleFocus = () => {
    setTimeout(() => {
      textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  };

  const [showScrollButton, setShowScrollButton] = React.useState(false);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior
      });
    }
  };

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      // Show button if we are more than 100px away from the bottom
      const isNearBottom = scrollHeight - scrollTop <= clientHeight + 100;
      setShowScrollButton(!isNearBottom);
    }
  };

  const startVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onstart = () => {
      setIsVoiceActive(true);
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      // Update input with the transcript
      setInput(prev => {
        // If we have a final transcript, we append it. 
        // If we have interim, we show it but it might change.
        // This is a bit tricky to get perfect without state management for "previous text"
        return finalTranscript || interimTranscript;
      });
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsVoiceActive(false);
    };

    recognition.onend = () => {
      setIsVoiceActive(false);
    };

    recognition.start();
    (window as any).recognition = recognition;
  };

  const stopVoiceInput = () => {
    if ((window as any).recognition) {
      (window as any).recognition.stop();
    }
    setIsVoiceActive(false);
  };

  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const minHeight = messages.length === 0 ? 60 : 40;
      textareaRef.current.style.height = `${Math.max(minHeight, Math.min(textareaRef.current.scrollHeight, 200))}px`;
    }
  }, [input, messages.length]);

  const [isLoaded, setIsLoaded] = React.useState(false);

  React.useEffect(() => {
    const fetchSessions = async () => {
      try {
        const loadedSessions = await loadSessions();
        const formattedSessions = loadedSessions.map((s: any) => ({
          ...s,
          createdAt: new Date(s.createdAt),
          messages: s.messages.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp),
            isGeneratingImage: false // Reset to false to avoid stuck state
          }))
        }));
        setSessions(formattedSessions);
        if (formattedSessions.length > 0) {
          setCurrentSessionId(formattedSessions[0].id);
          setMessages(formattedSessions[0].messages);
        }
      } catch (e) {
        console.error('Failed to load sessions from DB', e);
      } finally {
        setIsLoaded(true);
      }
    };
    fetchSessions();
  }, []);

  const getSessionTimestamp = (session: Session) => {
    if (session.messages.length > 0) {
      return new Date(session.messages[session.messages.length - 1].timestamp).getTime();
    }
    return new Date(session.createdAt).getTime();
  };

  const groupedSessions = React.useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = today - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = today - 30 * 24 * 60 * 60 * 1000;

    const groups: { [key: string]: Session[] } = {
      'Today': [],
      'Yesterday': [],
      'Previous 7 Days': [],
      'Previous 30 Days': [],
      'Older': []
    };

    const sorted = [...sessions].sort((a, b) => getSessionTimestamp(b) - getSessionTimestamp(a));

    sorted.forEach(session => {
      const ts = getSessionTimestamp(session);
      if (ts >= today) groups['Today'].push(session);
      else if (ts >= yesterday) groups['Yesterday'].push(session);
      else if (ts >= sevenDaysAgo) groups['Previous 7 Days'].push(session);
      else if (ts >= thirtyDaysAgo) groups['Previous 30 Days'].push(session);
      else groups['Older'].push(session);
    });

    return Object.entries(groups).filter(([_, sess]) => sess.length > 0);
  }, [sessions]);

  React.useEffect(() => {
    if (isLoaded && sessions.length > 0) {
      saveSessions(sessions).catch(e => console.error('Failed to save sessions to DB', e));
    }
  }, [sessions, isLoaded]);

  React.useEffect(() => {
    if (isLoaded && currentSessionId) {
      const session = sessions.find(s => s.id === currentSessionId);
      if (session) {
        setMessages(session.messages);
      }
    }
  }, [currentSessionId, isLoaded]);

  React.useEffect(() => {
    if (scrollRef.current) {
      const { scrollHeight, scrollTop, clientHeight } = scrollRef.current;
      const isAtBottom = scrollHeight - scrollTop <= clientHeight + 200;
      
      // Force scroll if the user just sent a message or if we are already at the bottom
      const lastMessage = messages[messages.length - 1];
      const isUserSend = lastMessage?.role === 'user';
      const isAssistantLoading = lastMessage?.role === 'assistant' && (lastMessage.isLoading || lastMessage.isStreaming);
      
      if (isAtBottom || isUserSend || isAssistantLoading) {
        scrollRef.current.scrollTop = scrollHeight;
      }
    }
  }, [messages]);

  const createNewSession = () => {
    // Prevent duplicate empty sessions: reuse existing empty one if it exists
    const emptySession = sessions.find(s => s.messages.length === 0);
    if (emptySession) {
      setCurrentSessionId(emptySession.id);
      setMessages([]);
      return;
    }

    const newSession: Session = {
      id: Math.random().toString(36).substring(7),
      title: 'New Chat',
      messages: [],
      createdAt: new Date()
    };
    setSessions([newSession, ...sessions]);
    setCurrentSessionId(newSession.id);
    setMessages([]);
  };

  const switchSession = (id: string) => {
    const session = sessions.find(s => s.id === id);
    if (session) {
      setCurrentSessionId(id);
      setMessages(session.messages);
    }
  };

  const deleteSession = (e: React.MouseEvent, session: Session) => {
    e.stopPropagation();
    setSessionToDelete(session);
  };

  const confirmDelete = async () => {
    if (!sessionToDelete) return;
    const id = sessionToDelete.id;
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    try {
      await deleteSessionFromDB(id);
    } catch (err) {
      console.error('Failed to delete session from DB', err);
    }
    if (currentSessionId === id) {
      if (updated.length > 0) {
        switchSession(updated[0].id);
      } else {
        setMessages([]);
        setCurrentSessionId(null);
      }
    }
    setSessionToDelete(null);
  };

  const handleSend = async (overrideText?: string, previousMessagesLimit?: Message[]) => {
    isCancelledRef.current = false;
    const textToSend = overrideText !== undefined ? overrideText : input;
    if ((!textToSend.trim() && selectedFiles.length === 0 && !selectedStyle) || isLoading) return;

    let currentInput = textToSend.trim();
    
    // Safety check: Is this an API key?
    if (currentInput.startsWith('AIza') && currentInput.length > 30 && !currentInput.includes(' ')) {
      try {
        const { setRuntimeApiKey } = await import('../services/aiService');
        setRuntimeApiKey(currentInput);
        const apiKeyMsg: Message = {
          id: Math.random().toString(36).substring(7),
          role: 'assistant',
          content: "✅ **API Key Detected!** I've updated my configuration with your key. You can now continue chatting. I've cleared the key from the chat history for your security.",
          timestamp: new Date()
        };
        setMessages(prev => [...prev, apiKeyMsg]);
        setIsLoading(false);
        return;
      } catch (e) {}
    }

    if (selectedStyle) {
      currentInput = `Generate a ${selectedStyle.name} image: ${currentInput}. (Style: ${selectedStyle.prompt})`;
    }
    
    if (overrideText === undefined) setInput('');
    setSelectedFiles([]);
    setSelectedStyle(null);
    setIsImageStylePickerOpen(false);

    // 1. ADD USER MESSAGE INSTANTLY FOR SPEED
    const userMsg: Message = {
      id: Math.random().toString(36).substring(7),
      role: 'user',
      content: currentInput || 'Analyze these files',
      timestamp: new Date()
    };

    let activeSessionId = currentSessionId;
    const baseMessages = previousMessagesLimit || messages;
    if (!activeSessionId) {
      // Determine initial temporary title
      let initialTitle = 'New Chat';
      if (selectedFiles.length > 0) {
        const file = selectedFiles[0];
        if (file.type.startsWith('image/')) initialTitle = 'Analyzing Image...';
        else if (file.type === 'application/pdf') initialTitle = 'Analyzing PDF...';
        else initialTitle = 'Analyzing File...';
      }

      const newSession: Session = {
        id: Math.random().toString(36).substring(7),
        title: initialTitle,
        messages: [userMsg],
        createdAt: new Date()
      };
      setSessions([newSession, ...sessions]);
      setCurrentSessionId(newSession.id);
      activeSessionId = newSession.id;
    }

    const updatedMessages = [...baseMessages, userMsg];
    setMessages(updatedMessages);
    setIsLoading(true);
    setTimeout(() => scrollToBottom('auto'), 50);

    // 2. USE PRE-PROCESSED FILES
    const fileAttachments = [...selectedFiles];

    // 3. UPDATE USER MESSAGE WITH FILES IF ANY
    if (fileAttachments.length > 0) {
      setMessages(prev => prev.map(m => m.id === userMsg.id ? { ...m, files: fileAttachments } : m));
      setSessions(prev => prev.map(s => s.id === activeSessionId ? { 
        ...s, 
        messages: s.messages.map(m => m.id === userMsg.id ? { ...m, files: fileAttachments } : m)
      } : s));
    }

    const assistantMsgId = Math.random().toString(36).substring(7);
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true
    };
    setMessages(prev => [...prev, assistantMsg]);
    setTimeout(() => scrollToBottom('auto'), 50);

    try {
      // Prepare history for API
      const history = updatedMessages.slice(0, -1).map(m => ({
        role: m.role,
        content: m.content
      }));

      // Prepare attachment if any
      let attachment: Attachment | undefined;
      if (fileAttachments.length > 0) {
        attachment = {
          name: fileAttachments[0].name,
          type: fileAttachments[0].type,
          data: fileAttachments[0].data
        };
      }

      const stream = streamChatWithAssistant(
        currentInput, 
        history, 
        attachment, 
        files,
        (progress) => {
          setMessages(prev => prev.map(m => 
            m.id === assistantMsgId ? { ...m, activeTool: progress } : m
          ));
        }
      );

      let finalContent = "";
      let finalThought = "";
      let researchSources: any[] = [];

      for await (const chunk of stream) {
        if (isCancelledRef.current) break;
        
        finalContent = chunk.accumulatedText || "";
        finalThought = chunk.accumulatedThought || "";
        researchSources = chunk.researchSources || [];
        
        // Handle tool calls if they exist in the stream
        const activeTool = chunk.functionCalls && chunk.functionCalls.length > 0 
          ? { type: 'tool', label: `Working: ${chunk.functionCalls[0].name}` }
          : undefined;

        setMessages(prev => {
          const newMessages = prev.map(m => 
            m.id === assistantMsgId ? { 
              ...m, 
              content: finalContent, 
              thought: finalThought,
              researchSources,
              activeTool: activeTool || (finalContent ? undefined : m.activeTool),
              isLoading: false,
              isStreaming: true
            } : m
          );
          // Sync to sessions
          setSessions(s => s.map(sess => sess.id === activeSessionId ? { ...sess, messages: newMessages } : sess));
          return newMessages;
        });
      }
      
      if (isCancelledRef.current) return;

      // Finalize the message state
      setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, isStreaming: false, activeTool: undefined } : m));

      // Check for image prompt in the final content
      const imagePromptMatch = finalContent.match(/\[IMAGE_PROMPT:\s*([\s\S]*?)\]/i);
      const textResponseMatch = finalContent.match(/\[TEXT:\s*([\s\S]*?)\]/i);
      
      // Parse documents
      const documentTagRegex = /\[DOCUMENT_START:([^|]+)\|([^\]]+)\]([\s\S]*?)\[DOCUMENT_END\]/gi;
      const documents: DocumentInfo[] = [];
      let docMatch;
      while ((docMatch = documentTagRegex.exec(finalContent)) !== null) {
        documents.push({
          id: Math.random().toString(36).substring(7),
          title: docMatch[1],
          type: docMatch[2].toLowerCase() as 'md' | 'pdf',
          content: docMatch[3].trim()
        });
      }

      let cleanContent = '';
      if (textResponseMatch) {
        cleanContent = textResponseMatch[1];
      } else {
        const strContent = typeof finalContent === 'string' ? finalContent : String(finalContent || '');
        cleanContent = strContent.replace(/\[IMAGE_PROMPT:\s*[\s\S]*?\]/i, '').trim();
      }
      
      if (typeof cleanContent !== 'string') {
        cleanContent = String(cleanContent || '');
      }

      cleanContent = cleanContent
        .replace(/\[TEXT:\s*([\s\S]*?)\]/gi, '$1')
        .replace(/\[IMAGE_PROMPT:\s*[\s\S]*?\]/gi, '')
        .trim();
      
      const updateAssistantMessage = (content: string, isLoading: boolean = false, extra: Partial<Message> = {}) => {
        setMessages(prev => {
          const newMessages = prev.map(m => m.id === assistantMsgId ? { ...m, content, isLoading, researchSources, ...extra } : m);
          // Sync to sessions
          setSessions(s => s.map(sess => sess.id === activeSessionId ? { ...sess, messages: newMessages } : sess));
          return newMessages;
        });
      };

      if (cleanContent !== finalContent || documents.length > 0) {
        updateAssistantMessage(cleanContent, false, { documents: documents.length > 0 ? documents : undefined });
      }
      
      setTypingMessageId(null); // No need for typewriter if we stream

      // --- INTELLIGENT TITLE GENERATION (POST-BREAKDOWN) ---
      const isFirstTurn = updatedMessages.length === 1;
      const isSecondTurn = updatedMessages.length === 2;
      const currentTitle = sessions.find(s => s.id === activeSessionId)?.title || '';
      const isGenericTitle = currentTitle.toLowerCase().includes('new chat') || 
                             currentTitle.toLowerCase().includes('hello') ||
                             currentTitle.toLowerCase().includes('processing');

      if (isFirstTurn || (isSecondTurn && isGenericTitle)) {
        // --- Multimodal Intent Analysis ---
        // We wait until the AI has finished the full "breakdown" (streaming is done)
        // Then we immediately trigger the best title based on that analysis.
        const firstAttachment = fileAttachments.length > 0 ? {
          name: fileAttachments[0].name,
          type: fileAttachments[0].type,
          data: fileAttachments[0].data
        } : undefined;

        generateChatTitle(currentInput, cleanContent, firstAttachment).then(newTitle => {
          if (newTitle && !isCancelledRef.current) {
            setSessions(s => s.map(sess => sess.id === activeSessionId ? { ...sess, title: newTitle } : sess));
          }
        }).catch(err => console.error("[OTIVO] Async title generation failed", err));
      }
      // -----------------------------------------------------

      if (imagePromptMatch) {
        const prompt = imagePromptMatch[1];
        const fileNameMatch = finalContent.match(/\[IMAGE_FILENAME:\s*([\s\S]*?)\]/i);
        const fileName = fileNameMatch ? fileNameMatch[1] : undefined;
        
        updateAssistantMessage(finalContent, false, { 
          isGeneratingImage: true, 
          imagePrompt: prompt 
        });

        try {
          // Add timeout to image generation
          const imagePromise = generateImage(prompt);
          const timeoutPromise = new Promise<null>((_, reject) => 
            setTimeout(() => reject(new Error("Image generation timed out")), 60000)
          );
          
          const base64Image = await Promise.race([imagePromise, timeoutPromise]);
          
          if (isCancelledRef.current) return;

          if (base64Image && !base64Image.startsWith('{')) {
            const imageUrl = `data:image/png;base64,${base64Image}`;
            updateAssistantMessage(finalContent, false, { 
              isGeneratingImage: false, 
              imageUrl: imageUrl 
            });
            if (onImageGenerated) onImageGenerated(base64Image, prompt, fileName);
          } else {
            let errorMessage = "Image generation failed.";
            if (base64Image?.startsWith('{')) {
               try {
                 const err = JSON.parse(base64Image);
                 if (err.error === "IMAGE_MODELS_RESTRICTED") {
                   errorMessage = err.message;
                 }
               } catch (e) {}
            }

            updateAssistantMessage(finalContent, false, { 
              isGeneratingImage: false,
              failedImagePrompt: prompt,
              imageFileName: fileName
            });
            
            // Show a temporary alert or log for the specific error
            console.error(errorMessage);
          }
        } catch (err) {
          console.error('Image generation error:', err);
          updateAssistantMessage(finalContent, false, { 
            isGeneratingImage: false,
            failedImagePrompt: prompt,
            imageFileName: fileName
          });
        }
      }

      // Update session title if it's the first message
      if (messages.length === 0) {
        setSessions(s => s.map(sess => sess.id === activeSessionId ? { ...sess, title: currentInput.slice(0, 30) } : sess));
      }

    } catch (error) {
      console.error(error);
      const errorMsg = 'Sorry, I encountered an error.';
      setMessages(prev => {
        const newMessages = prev.map(m => m.id === assistantMsgId ? { ...m, isLoading: false, content: errorMsg } : m);
        setSessions(s => s.map(sess => sess.id === activeSessionId ? { ...sess, messages: newMessages } : sess));
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetryImage = async (messageId: string, prompt: string, fileName?: string) => {
    const updateMsg = (extra: Partial<Message>) => {
      setMessages(prev => {
        const next = prev.map(m => m.id === messageId ? { ...m, ...extra } : m);
        setSessions(s => s.map(sess => sess.id === currentSessionId ? { ...sess, messages: next } : sess));
        return next;
      });
    };

    updateMsg({ isGeneratingImage: false, failedImagePrompt: undefined });
    
    try {
      const base64Image = await generateImage(prompt);
      if (base64Image && !base64Image.startsWith('{')) {
        const imageUrl = `data:image/png;base64,${base64Image}`;
        updateMsg({ isGeneratingImage: false, imageUrl: imageUrl });
        if (onImageGenerated) onImageGenerated(base64Image, prompt, fileName);
      } else {
        updateMsg({ isGeneratingImage: false, failedImagePrompt: prompt, imageFileName: fileName });
      }
    } catch (err) {
      console.error('Retry image generation error:', err);
      updateMsg({ isGeneratingImage: false, failedImagePrompt: prompt, imageFileName: fileName });
    }
  };

  const stripMarkdown = (text: string) => {
    if (!text || typeof text !== 'string') return String(text || '');
    return text
      .replace(/(\*\*|__)(.*?)\1/g, '$2') // bold
      .replace(/(\*|_)(.*?)\1/g, '$2')    // italic
      .replace(/^#+\s+/gm, '')            // headers
      .replace(/!\[.*?\]\(.*?\)/g, '')    // images
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')  // links
      .replace(/`{3,}/g, '')              // code blocks
      .replace(/`/g, '')                  // inline code
      .replace(/^[*-]\s+/gm, '')          // bullets
      .replace(/^\d+\.\s+/gm, '')         // numbered lists
      .replace(/>\s+/gm, '')              // blockquotes
      .trim();
  };

  const handleCopy = (text: string, isCode?: boolean, id?: string) => {
    const cleanText = isCode ? text : stripMarkdown(text);
    navigator.clipboard.writeText(cleanText);
    if (id) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleEditMessage = (msg: Message) => {
    setIsEditingId(msg.id);
    setEditingContent(msg.content);
  };

  const saveEditedMessage = () => {
    if (!isEditingId) return;
    
    const editedMsgId = isEditingId;
    const content = editingContent;
    
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === editedMsgId);
      if (idx === -1) return prev;

      // Truncate history from this message onwards
      const baseMessages = prev.slice(0, idx);
      
      // Trigger resend with override and the truncated history
      setTimeout(() => {
        handleSend(content, baseMessages);
      }, 50);
      
      return baseMessages;
    });

    setIsEditingId(null);
    setEditingContent('');
  };

  const handleShare = () => {
    setIsSharing(true);
    navigator.clipboard.writeText(window.location.href);
    setTimeout(() => setIsSharing(false), 2000);
  };

  const handleFeedback = (messageId: string, type: 'positive' | 'negative') => {
    setMessages(prev => {
      const next = prev.map(m => m.id === messageId ? { ...m, feedback: m.feedback === type ? undefined : type } : m);
      if (currentSessionId) {
        setSessions(s => s.map(sess => sess.id === currentSessionId ? { ...sess, messages: next } : sess));
      }
      return next;
    });
  };

  const handleRegenerate = async (messageId: string) => {
    if (isLoading) return;
    
    const msgIndex = messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;
    
    // Find the last user message before this assistant message
    const userMsgIndex = [...messages.slice(0, msgIndex)].reverse().findIndex(m => m.role === 'user');
    if (userMsgIndex === -1) return;
    
    const actualUserMsgIndex = msgIndex - 1 - userMsgIndex;
    const userMsg = messages[actualUserMsgIndex];
    
    // Remove all messages from the assistant message onwards
    const newMessages = messages.slice(0, msgIndex);
    setMessages(newMessages);
    
    // Re-trigger handleSend logic but without adding a new user message
    setIsLoading(true);
    const assistantMsgId = Math.random().toString(36).substring(7);
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true
    };
    
    const updatedMessages = [...newMessages, assistantMsg];
    setMessages(updatedMessages);

    try {
      // Prepare history for API
      const history = newMessages.map(m => ({
        role: m.role,
        content: m.content
      }));

      // Prepare attachment if any
      let attachment: Attachment | undefined;
      if (userMsg.files && userMsg.files.length > 0) {
        attachment = {
          name: userMsg.files[0].name,
          type: userMsg.files[0].type,
          data: userMsg.files[0].data
        };
      }

      const stream = streamChatWithAssistant(userMsg.content, history, attachment, files);
      
      let finalContent = "";
      let finalThought = "";
      let researchSources: any[] = [];

      for await (const chunk of stream) {
        if (isCancelledRef.current) break;
        
        finalContent = chunk.accumulatedText || "";
        finalThought = chunk.accumulatedThought || "";
        researchSources = chunk.researchSources || [];

        setMessages(prev => {
          const newMessages = prev.map(m => 
            m.id === assistantMsgId ? { 
              ...m, 
              content: finalContent, 
              thought: finalThought,
              researchSources,
              isLoading: false,
              isStreaming: true
            } : m
          );
          // Sync to sessions
          if (currentSessionId) {
            setSessions(s => s.map(sess => sess.id === currentSessionId ? { ...sess, messages: newMessages } : sess));
          }
          return newMessages;
        });
      }
      
      if (isCancelledRef.current) return;

      // Finalize the message state
      setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, isStreaming: false } : m));

      // Check for image prompt
      const imagePromptMatch = finalContent.match(/\[IMAGE_PROMPT:\s*([\s\S]*?)\]/i);
      const textResponseMatch = finalContent.match(/\[TEXT:\s*([\s\S]*?)\]/i);
      
      let cleanContent = textResponseMatch ? textResponseMatch[1] : finalContent.replace(/\[IMAGE_PROMPT:\s*[\s\S]*?\]/i, '').trim();
      
      cleanContent = cleanContent
        .replace(/\[TEXT:\s*([\s\S]*?)\]/gi, '$1')
        .replace(/\[IMAGE_PROMPT:\s*[\s\S]*?\]/gi, '')
        .trim();
      
      const updateAssistantMessage = (content: string, isLoading: boolean = false, extra: Partial<Message> = {}) => {
        setMessages(prev => {
          const next = prev.map(m => m.id === assistantMsgId ? { ...m, content, isLoading, ...extra } : m);
          // Sync to sessions
          if (currentSessionId) {
            setSessions(s => s.map(sess => sess.id === currentSessionId ? { ...sess, messages: next } : sess));
          }
          return next;
        });
      };

      if (cleanContent !== finalContent) {
        updateAssistantMessage(cleanContent);
      }
      
      setTypingMessageId(null);

      if (imagePromptMatch) {
        const prompt = imagePromptMatch[1];
        const fileNameMatch = finalContent.match(/\[IMAGE_FILENAME:\s*([\s\S]*?)\]/i);
        const fileName = fileNameMatch ? fileNameMatch[1] : undefined;
        
        updateAssistantMessage(finalContent, false, { 
          isGeneratingImage: true, 
          imagePrompt: prompt 
        });

        try {
          const imagePromise = generateImage(prompt);
          const timeoutPromise = new Promise<null>((_, reject) => 
            setTimeout(() => reject(new Error("Image generation timed out")), 60000)
          );
          
          const base64Image = await Promise.race([imagePromise, timeoutPromise]);
          if (isCancelledRef.current) return;
          
          if (base64Image) {
            const imageUrl = `data:image/png;base64,${base64Image}`;
            updateAssistantMessage(finalContent, false, { 
              isGeneratingImage: false, 
              imageUrl: imageUrl 
            });
            if (onImageGenerated) onImageGenerated(base64Image, prompt, fileName);
          } else {
            updateAssistantMessage(finalContent, false, { 
              isGeneratingImage: false,
              failedImagePrompt: prompt,
              imageFileName: fileName
            });
          }
        } catch (err) {
          updateAssistantMessage(finalContent, false, { 
            isGeneratingImage: false,
            failedImagePrompt: prompt
          });
        }
      }
    } catch (error) {
      console.error(error);
      const errorMsg = 'Sorry, I encountered an error.';
      setMessages(prev => {
        const next = prev.map(m => m.id === assistantMsgId ? { ...m, isLoading: false, content: errorMsg } : m);
        if (currentSessionId) {
          setSessions(s => s.map(sess => sess.id === currentSessionId ? { ...sess, messages: next } : sess));
        }
        return next;
      });
    } finally {
      setIsLoading(false);
    }
  };
  const processFiles = async (files: File[]) => {
    const newUploadingFiles = files.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      progress: 0,
      isProcessing: true,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
    }));

    setUploadingFiles(prev => [...prev, ...newUploadingFiles]);

    for (const item of newUploadingFiles) {
      const reader = new FileReader();
      
      reader.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadingFiles(prev => prev.map(f => f.id === item.id ? { ...f, progress } : f));
        }
      };

      const result = await new Promise<{ name: string; type: string; data: string; size: number }>((resolve) => {
        reader.onload = (e) => {
          // Simulate some extra processing time for the "premium" feel if it's too fast
          let p = 0;
          const interval = setInterval(() => {
            p += Math.floor(Math.random() * 30) + 10;
            if (p >= 100) {
              clearInterval(interval);
              resolve({
                name: item.file.name,
                type: item.file.type,
                data: e.target?.result as string,
                size: item.file.size
              });
            } else {
              setUploadingFiles(prev => prev.map(f => f.id === item.id ? { ...f, progress: p } : f));
            }
          }, 100);
        };
        reader.readAsDataURL(item.file);
      });

      setSelectedFiles(prev => [...prev, result]);
      setUploadingFiles(prev => prev.filter(f => f.id !== item.id));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(Array.from(e.target.files));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  return (
    <div 
      className="fixed inset-0 h-[100dvh] flex w-full bg-[#0d0d0f] text-[#ececec] font-sans selection:bg-[#40414f] overflow-hidden overscroll-none touch-none"
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] bg-blue-600/20 backdrop-blur-sm border-4 border-dashed border-blue-500 flex items-center justify-center pointer-events-none"
          >
            <div className="bg-[#1a1a1a] p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 border border-white/10">
              <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Plus className="w-8 h-8 text-blue-400" />
              </div>
              <p className="text-xl font-medium text-white">Drop files to upload</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ x: -260, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -260, opacity: 0 }}
            className={cn(
              "h-full bg-[#0d0d0f] flex flex-col border-r border-white/5 shrink-0 overflow-hidden z-50",
              "fixed md:relative md:w-[260px] w-[280px]"
            )}
          >
            <div className="p-3 flex flex-col h-full">
              <div className="px-3 py-4 mb-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" referrerPolicy="no-referrer" />
                  <span className="font-bold text-white tracking-tight">OTIVO AI</span>
                </div>
                <button 
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-white/40 hover:text-white"
                  title="Hide sidebar"
                >
                  <PanelLeftClose className="w-5 h-5" />
                </button>
              </div>
              <button 
                onClick={createNewSession}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#2c2c2c] transition-colors text-sm font-medium mb-4"
              >
                <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                New Chat
              </button>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                {groupedSessions.map(([groupName, sessions]) => (
                  <div key={groupName} className="mb-4">
                    <div className="px-3 py-2 text-[11px] font-bold text-[#666] uppercase tracking-wider">
                      {groupName}
                    </div>
                    {sessions.map(session => (
                      <div 
                        key={session.id}
                        onClick={() => {
                          switchSession(session.id);
                          if (window.innerWidth < 768) setIsSidebarOpen(false);
                        }}
                        className={cn(
                          "group relative flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all text-sm",
                          currentSessionId === session.id ? "bg-[#2c2c2c]" : "hover:bg-[#2c2c2c]"
                        )}
                      >
                        <MessageSquare className="w-4 h-4 opacity-40 shrink-0" />
                        <span className="truncate flex-1">{session.title}</span>
                        <button 
                          onClick={(e) => deleteSession(e, session)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-all max-md:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5 opacity-40" />
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div className="mt-auto pt-4 border-t border-white/5 space-y-1">

                <div className="flex items-center gap-3 px-3 py-3 mt-2 group-hover:bg-white/5 rounded-xl transition-colors cursor-pointer">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold border border-white/10">
                    <User className="w-4 h-4 text-white/40" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-white/80">Sign Up</p>
                  </div>
                  <Settings className="w-4 h-4 opacity-20 group-hover:opacity-40 transition-opacity" />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-row min-w-0 relative bg-[#0d0d0f] h-full overflow-hidden">
        {/* Chat Column */}
        <div className={cn(
          "flex flex-col min-w-0 relative transition-all duration-500 ease-in-out h-full overflow-hidden",
          (activeDocument || isPreviewOpen) ? "lg:w-1/2 w-full" : "w-full"
        )}>
          {/* Top Bar - Screenshot Style */}
          <header className="h-14 md:h-20 flex items-center justify-between px-4 md:px-6 shrink-0 z-50 bg-[#0d0d0f]/80 backdrop-blur-xl border-b border-white/5">
            <AnimatePresence>
              {!isOnline && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="absolute top-full left-0 right-0 bg-orange-500/10 border-b border-orange-500/20 py-2 px-6 flex items-center justify-center gap-2 backdrop-blur-xl"
                >
                  <AlertTriangle className="w-3 h-3 text-orange-400" />
                  <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Connection lost. Attempting to reconnect...</span>
                </motion.div>
              )}
              {isOnline && wasOffline && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="absolute top-full left-0 right-0 bg-emerald-500/10 border-b border-emerald-500/20 py-2 px-6 flex items-center justify-center gap-2 backdrop-blur-xl"
                >
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Connection restored. We're back online!</span>
                </motion.div>
              )}
            </AnimatePresence>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1 hover:bg-white/10 rounded-lg transition-all flex items-center gap-3 group"
              title={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
            >
              <div className="relative">
                <div className="absolute -inset-1 bg-emerald-500/20 rounded-lg blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
                <img 
                  src={OTIVO_BRAND.logo.path} 
                  alt={OTIVO_BRAND.name} 
                  className="relative w-6 h-6 md:w-8 md:h-8 object-contain transition-transform group-hover:scale-110" 
                  referrerPolicy="no-referrer" 
                />
              </div>
            </button>
          </div>
          
          <div className="flex items-center gap-1.5 bg-white/10 p-0.5 md:p-1 rounded-full border border-white/10">
            <button 
              onClick={handleShare}
              className={cn(
                "w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full transition-all relative",
                isSharing ? "bg-white/20 text-blue-400" : "hover:bg-white/10 text-white/60 hover:text-white"
              )}
              title="Share Chat"
            >
              <UserPlus className="w-4 h-4 md:w-5 md:h-5 transition-transform active:scale-90" />
              <AnimatePresence>
                {isSharing && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: 10 }}
                    className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-[10px] py-1 px-3 rounded-full font-bold whitespace-nowrap shadow-lg shadow-blue-500/30 z-50"
                  >
                    LINK COPIED
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>
        </header>

        {/* Messages Area */}
        <div 
          ref={scrollRef} 
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto custom-scrollbar pb-10 md:pb-20 min-h-0 relative"
        >
          {isImageStylePickerOpen ? (
            <div className="h-full flex flex-col items-center p-8 overflow-y-auto custom-scrollbar animate-in fade-in duration-300">
              <div className="w-full max-w-4xl space-y-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-serif italic text-white tracking-tight">Pick a style for your image</h2>
                  <button 
                    onClick={() => setIsImageStylePickerOpen(false)}
                    className="p-2 hover:bg-white/10 rounded-full transition-all"
                  >
                    <X className="w-6 h-6 text-white/60" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {IMAGE_STYLES.map((style) => (
                    <motion.button
                      key={style.name}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setSelectedStyle(style);
                        setIsImageStylePickerOpen(false);
                        setInput(`Create an image in ${style.name} style: `);
                      }}
                      className={cn(
                        "group relative aspect-square rounded-2xl overflow-hidden border-2 transition-all",
                        selectedStyle?.name === style.name ? "border-blue-500" : "border-white/10 hover:border-white/30"
                      )}
                    >
                      <img 
                        src={style.image} 
                        alt={style.name}
                        className="w-full h-full object-cover transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/90 group-hover:text-white truncate block">
                          {style.name}
                        </span>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          ) : isMusicPickerOpen ? (
            <div className="h-full flex flex-col items-center p-8 overflow-hidden animate-in fade-in duration-300">
              <div className="w-full max-w-4xl flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-8 shrink-0">
                  <h2 className="text-3xl font-medium text-white tracking-tight">Pick a track to remix</h2>
                  <button 
                    onClick={() => setIsMusicPickerOpen(false)}
                    className="p-2 hover:bg-white/10 rounded-full transition-all"
                  >
                    <X className="w-6 h-6 text-white/60" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 mb-8">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {MUSIC_TRACKS.map((track) => (
                      <motion.button
                        key={track.name}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setSelectedTrack(track)}
                        className={cn(
                          "group relative aspect-square rounded-[24px] overflow-hidden border-2 transition-all duration-300",
                          selectedTrack?.name === track.name ? "border-blue-500 ring-4 ring-blue-500/20" : "border-white/5 hover:border-white/20 bg-[#151618]"
                        )}
                      >
                        <img 
                          src={track.image} 
                          alt={track.name}
                          className={cn(
                            "w-full h-full object-cover transition-transform duration-700",
                            selectedTrack?.name === track.name ? "scale-110" : "group-hover:scale-110"
                          )}
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
                        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                          <span className="text-xs font-bold text-white/90 group-hover:text-white truncate">
                            {track.name}
                          </span>
                          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                            <Play className="w-4 h-4 text-white fill-current" />
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div className="bg-[#151618] rounded-[24px] p-4 border border-white/5 shadow-2xl shrink-0">
                  <div className="flex flex-col gap-4">
                    <textarea 
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Describe your track"
                      className="w-full bg-transparent border-none outline-none text-white text-lg resize-none h-[40px] placeholder:text-white/20"
                    />
                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <div className="flex items-center gap-4">
                        <button className="p-2 text-white/30 hover:text-white transition-colors">
                          <Plus className="w-5 h-5" />
                        </button>
                        <button className="p-2 text-white/30 hover:text-white transition-colors">
                          <Sliders className="w-5 h-5" />
                        </button>
                        {selectedTrack && (
                          <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-[10px] text-blue-400 font-bold uppercase tracking-wider">
                            <Music className="w-3 h-3" />
                            <span>{selectedTrack.name}</span>
                            <X className="w-3.5 h-3.5 cursor-pointer hover:text-white" onClick={() => setSelectedTrack(null)} />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-white/20 text-xs font-bold uppercase tracking-widest cursor-pointer hover:text-white/40 transition-colors">
                          <span>Fast</span>
                          <ChevronDown className="w-3 h-3" />
                        </div>
                        <button 
                          onClick={() => {
                            if (!selectedTrack && !input.trim()) return;
                            handleSend(selectedTrack ? `Create music in ${selectedTrack.name} style. Description: ${input}` : input);
                            setIsMusicPickerOpen(false);
                            setSelectedTrack(null);
                          }}
                          className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                            (selectedTrack || input.trim()) ? "bg-white text-black shadow-lg" : "bg-white/5 text-white/10"
                          )}
                        >
                          <Send className="w-5 h-5 rotate-[-45deg]" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="min-h-[calc(100dvh-5rem)] md:min-h-[calc(100dvh-7rem)] flex flex-col items-center justify-center px-4 py-8 md:py-0 overflow-y-auto w-full">
              <div className="w-full max-w-[850px] flex flex-col gap-6 md:gap-12">
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="space-y-2 mt-4 md:mt-0"
                >
                  <div className="text-2xl md:text-[32px] font-normal text-white/50 text-left md:text-center">Hi there,</div>
                  <div className="text-4xl sm:text-5xl md:text-[56px] font-medium bg-gradient-to-r from-[#4b90ff] to-[#ff5546] bg-clip-text text-transparent leading-tight text-left md:text-center">
                    Where should we start?
                  </div>
                </motion.div>

                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur-xl opacity-50 group-hover:opacity-100 transition duration-1000"></div>
                  
                  {/* File Previews for Empty State */}
                  {(uploadingFiles.length > 0 || selectedFiles.length > 0) && (
                    <div className="flex flex-wrap gap-3 mb-6 px-4 justify-center">
                      <AnimatePresence>
                        {uploadingFiles.map(f => (
                          <FilePreviewItem 
                            key={f.id} 
                            name={f.file.name} 
                            type={f.file.type} 
                            progress={f.progress} 
                            preview={f.preview}
                          />
                        ))}
                        {selectedFiles.map((f, idx) => (
                          <FilePreviewItem 
                            key={idx} 
                            name={f.name} 
                            type={f.type} 
                            size={f.size}
                            onRemove={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  )}

                  <div ref={emptyInputContainerRef} className="relative bg-[#0d0d0f] rounded-2xl p-1.5 md:p-2 border border-white/10 shadow-2xl transition-transform duration-300">
                    <textarea 
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onFocus={handleFocus}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Ask anything..."
                      className="w-full bg-transparent border-none outline-none text-white text-base md:text-xl p-3 md:p-6 resize-none h-[80px] md:h-[120px] placeholder:text-white/10 custom-scrollbar leading-normal"
                    />
                    
                    <div className="flex items-center justify-between p-2 md:p-4 pt-1 border-t border-white/5">
                      <div className="flex items-center gap-1 md:gap-2">
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="p-2 md:p-3 text-white/40 hover:text-white hover:bg-white/5 rounded-2xl transition-all group/btn"
                        >
                          <Plus className="w-5 h-5 md:w-6 md:h-6 group-hover/btn:rotate-90 transition-transform duration-300" />
                        </button>
                        <button className="p-2 md:p-3 text-white/40 hover:text-white hover:bg-white/5 rounded-2xl transition-all">
                          <Globe className="w-5 h-5 md:w-6 md:h-6" />
                        </button>
                      </div>
                      
                      <button 
                        onClick={() => {
                          if (isLoading) return;
                          if (!input.trim() && selectedFiles.length === 0) {
                            if (onOpenVoiceAssistant) onOpenVoiceAssistant();
                            else if (isVoiceActive) stopVoiceInput();
                            else startVoiceInput();
                          } else {
                            handleSend();
                          }
                        }}
                        className={cn(
                          "p-2.5 md:p-3 rounded-full transition-all duration-300",
                          "bg-white text-black shadow-lg hover:scale-105 active:scale-95",
                          isVoiceActive && "ring-4 ring-blue-500/50 animate-pulse"
                        )}
                      >
                        {isLoading ? (
                          <div className="relative flex items-center justify-center w-4 h-4 md:w-5 md:h-5">
                            <Square className="w-2.5 h-2.5 md:w-3 md:h-3 fill-current" />
                          </div>
                        ) : isVoiceActive ? (
                          <div className="flex gap-1 items-center justify-center h-4 md:h-5">
                            <motion.div animate={{ height: [4, 12, 4] }} transition={{ repeat: Infinity, duration: 0.5 }} className="w-0.5 bg-black" />
                            <motion.div animate={{ height: [8, 16, 8] }} transition={{ repeat: Infinity, duration: 0.5, delay: 0.1 }} className="w-0.5 bg-black" />
                            <motion.div animate={{ height: [4, 12, 4] }} transition={{ repeat: Infinity, duration: 0.5, delay: 0.2 }} className="w-0.5 bg-black" />
                          </div>
                        ) : (!input.trim() && selectedFiles.length === 0) ? (
                          <AudioLines className="w-4 h-4 md:w-5 md:h-5" />
                        ) : (
                          <Send className="w-4 h-4 md:w-5 md:h-5 rotate-[-45deg]" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.6 }}
                  className="flex flex-wrap gap-3 relative"
                >
                  <button 
                    onClick={() => setIsImageStylePickerOpen(true)}
                    className="flex items-center gap-2 px-5 py-3 rounded-full bg-[#2c2c2c] border border-white/5 hover:bg-[#3c3c3c] hover:-translate-y-0.5 transition-all group"
                  >
                    <ImageIcon className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-medium text-white/80">Create image</span>
                  </button>
                  <button 
                    onClick={() => setIsMusicPickerOpen(true)}
                    className="flex items-center gap-2 px-5 py-3 rounded-full bg-black border border-white/5 hover:bg-[#2d2f31] hover:-translate-y-0.5 transition-all group"
                  >
                    <Music className="w-4 h-4 text-pink-400 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-medium text-white/80">Create music</span>
                  </button>
                  
                  <div className="relative">
                    <button 
                      onClick={() => setIsWritePickerOpen(!isWritePickerOpen)}
                      className="flex items-center gap-2 px-5 py-3 rounded-full bg-black border border-white/5 hover:bg-[#2d2f31] hover:-translate-y-0.5 transition-all group"
                    >
                      <Pencil className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
                      <span className="text-sm font-medium text-white/80">Write anything</span>
                    </button>
                    <AnimatePresence>
                      {isWritePickerOpen && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 10 }}
                          className="absolute bottom-full left-0 mb-3 w-64 bg-[#0d0d0f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50"
                        >
                          {WRITE_OPTIONS.map((opt, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                handleSend(opt);
                                setIsWritePickerOpen(false);
                              }}
                              className="w-full text-left px-4 py-3 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                            >
                              {opt}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="relative">
                    <button 
                      onClick={() => setIsLearnPickerOpen(!isLearnPickerOpen)}
                      className="flex items-center gap-2 px-5 py-3 rounded-full bg-black border border-white/5 hover:bg-[#2d2f31] hover:-translate-y-0.5 transition-all group"
                    >
                      <BrainCircuit className="w-4 h-4 text-yellow-400 group-hover:scale-110 transition-transform" />
                      <span className="text-sm font-medium text-white/80">Help me learn</span>
                    </button>
                    <AnimatePresence>
                      {isLearnPickerOpen && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 10 }}
                          className="absolute bottom-full left-0 mb-3 w-64 bg-[#0d0d0f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50"
                        >
                          {LEARN_OPTIONS.map((opt, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                handleSend(opt);
                                setIsLearnPickerOpen(false);
                              }}
                              className="w-full text-left px-4 py-3 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                            >
                              {opt}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="relative">
                    <button 
                      onClick={() => setIsBoostPickerOpen(!isBoostPickerOpen)}
                      className="flex items-center gap-2 px-5 py-3 rounded-full bg-black border border-white/5 hover:bg-[#2d2f31] hover:-translate-y-0.5 transition-all group"
                    >
                      <Sparkles className="w-4 h-4 text-orange-400 group-hover:scale-110 transition-transform" />
                      <span className="text-sm font-medium text-white/80">Boost my day</span>
                    </button>
                    <AnimatePresence>
                      {isBoostPickerOpen && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 10 }}
                          className="absolute bottom-full left-0 mb-3 w-64 bg-[#0d0d0f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50"
                        >
                          {BOOST_OPTIONS.map((opt, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                handleSend(opt);
                                setIsBoostPickerOpen(false);
                              }}
                              className="w-full text-left px-4 py-3 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                            >
                              {opt}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-3xl mx-auto py-8 md:py-12 px-4 space-y-8 md:space-y-12">
              {messages.map((msg) => (
                <div key={msg.id} className={cn(
                  "group animate-in fade-in slide-in-from-bottom-2 duration-500 w-full",
                  msg.role === 'user' ? "flex justify-end" : "flex justify-start"
                )}>
                  <div className={cn(
                    "flex gap-4 lg:gap-8 w-full",
                    msg.role === 'user' ? "max-w-[90%] flex-row-reverse" : "max-w-full flex-row"
                  )}>
                    {msg.role === 'user' && (
                      <div className="w-9 h-9 rounded-full bg-[#3c3c3c] flex items-center justify-center shrink-0 mt-1 border border-white/10">
                        <User className="w-5 h-5 text-white/60" />
                      </div>
                    )}
                    <div className={cn(
                      "flex-1 space-y-3 min-w-0 w-full",
                      msg.role === 'user' ? "items-end" : "items-start"
                    )}>
                      <div className={cn(
                        "text-[16px] leading-[1.6] prose prose-invert max-w-none prose-p:leading-[1.6] prose-pre:bg-transparent prose-pre:p-0 prose-pre:border-none prose-img:rounded-2xl prose-img:shadow-2xl relative w-full break-words [word-break:break-word] [overflow-wrap:anywhere]",
                        msg.role === 'user' ? "bg-white/[0.03] border border-white/10 px-6 py-5 rounded-[28px] text-white/95 shadow-2xl" : "bg-transparent py-6 px-4 max-w-full text-white/95"
                      )}>
                        {msg.files && msg.files.length > 0 && (
                          <MessageAttachments files={msg.files} />
                        )}
                        {/* Internal Monologue */}
                        {msg.role === 'assistant' && msg.thought && msg.isStreaming && (
                          <div className="grid overflow-hidden transition-all duration-300 ease-in-out" style={{ gridTemplateRows: '1fr', opacity: 1 }}>
                            <div className="min-h-0">
                              <div className="text-sm text-white/40 italic font-serif border-l-2 border-white/10 pl-4 py-2 mb-4 bg-white/[0.02] rounded-r-xl animate-pulse">
                                <div className="flex items-center gap-2 mb-2 opacity-60">
                                  <img 
                                    src={OTIVO_BRAND.logo.path} 
                                    alt="L" 
                                    className="w-3 h-3 object-contain animate-pulse brightness-125" 
                                  />
                                  <span className="text-[10px] uppercase tracking-widest font-bold">Internal Monologue</span>
                                </div>
                                {msg.thought}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Finalizing State */}
                        {msg.isFinalizing && (
                          <motion.div 
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center gap-2 mb-4 px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-lg w-fit"
                          >
                            <div className="flex gap-1">
                              <motion.div className="w-1.5 h-1.5 bg-orange-500 rounded-full" animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }} transition={{ duration: 1, repeat: Infinity, delay: 0 }} />
                              <motion.div className="w-1.5 h-1.5 bg-orange-500 rounded-full" animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }} transition={{ duration: 1, repeat: Infinity, delay: 0.2 }} />
                              <motion.div className="w-1.5 h-1.5 bg-orange-500 rounded-full" animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }} transition={{ duration: 1, repeat: Infinity, delay: 0.4 }} />
                            </div>
                            <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Finalizing...</span>
                          </motion.div>
                        )}

                        {isEditingId === msg.id ? (
                          <div className="space-y-3">
                            <textarea
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              className="w-full bg-[#1a1b1e] border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-white/20 outline-none resize-none min-h-[100px] custom-scrollbar"
                              autoFocus
                            />
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => setIsEditingId(null)}
                                className="px-3 py-1.5 text-xs font-medium text-white/40 hover:text-white transition-colors"
                              >
                                Cancel
                              </button>
                              <button 
                                onClick={saveEditedMessage}
                                className="px-3 py-1.5 bg-white text-black text-xs font-bold rounded-lg hover:bg-white/90 transition-colors"
                              >
                                Save & Submit
                              </button>
                            </div>
                          </div>
                        ) : msg.role === 'assistant' && msg.isLoading && !msg.content ? (
                          <div className="flex items-center gap-3 bg-[#111113] border border-white/5 rounded-[24px] px-5 py-3 w-fit shadow-2xl backdrop-blur-xl">
                            <div className="relative w-6 h-6 flex items-center justify-center shrink-0">
                              <div className="absolute inset-0 bg-emerald-500/10 rounded-full blur-lg animate-pulse" />
                              <img 
                                src={OTIVO_BRAND.logo.path} 
                                alt="OTIVO"
                                className="w-4 h-4 object-contain relative z-10 animate-pulse brightness-125"
                              />
                            </div>
                            <div className="flex gap-2 items-center">
                              <motion.div 
                                className="w-1.5 h-1.5 bg-[#10b981] rounded-full shadow-[0_0_8px_rgba(16,185,129,0.6)]" 
                                animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }} 
                                transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }} 
                              />
                            </div>
                          </div>
                        ) : (
                          <MarkdownRenderer 
                            content={msg.content} 
                            onCopy={(text) => handleCopy(text, true, msg.id)} 
                            onRun={handleRunCode}
                            onOpenDocument={(doc) => setActiveDocument(doc)}
                          />
                        )}

                        {(msg.isGeneratingImage || msg.imageUrl) && (
                          <div className="mt-6 mb-2">
                            <ImageGenerationEffect 
                              isGenerating={!!msg.isGeneratingImage}
                              imageUrl={msg.imageUrl}
                              prompt={msg.imagePrompt}
                            />
                          </div>
                        )}

                        {msg.role === 'assistant' && msg.activeTool && (
                          <motion.div 
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center gap-3 px-4 py-2.5 bg-blue-500/5 border border-blue-500/10 rounded-xl mt-4 w-fit"
                          >
                            <DeepSearchIcon size={20} />
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest opacity-60">Deep Search</span>
                              <span className="text-xs font-medium text-white/70 tracking-wide line-clamp-1">
                                {msg.activeTool.label}
                              </span>
                            </div>
                          </motion.div>
                        )}
                      </div>
                      
                      {msg.role === 'user' && !msg.isLoading && (
                        <div className="flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity pt-2">
                          <button 
                            onClick={() => {
                              setIsEditingId(msg.id);
                              setEditingContent(msg.content);
                            }}
                            className="p-1.5 hover:bg-white/5 rounded-md transition-colors" 
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4 opacity-40" />
                          </button>
                          <button 
                            onClick={() => handleCopy(msg.content, false, msg.id)}
                            className="p-1.5 hover:bg-white/5 rounded-md transition-colors" 
                            title="Copy prompt"
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4 opacity-40" />
                            )}
                          </button>
                        </div>
                      )}

                      {msg.role === 'assistant' && !msg.isLoading && !msg.isStreaming && (
                        <div className="flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity pt-2">
                          <button 
                            onClick={() => handleCopy(msg.content, false, msg.id)}
                            className="p-1.5 hover:bg-white/5 rounded-md transition-colors" 
                            title="Copy"
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4 opacity-40" />
                            )}
                          </button>
                          <button 
                            onClick={() => handleRegenerate(msg.id)}
                            className="p-1.5 hover:bg-white/5 rounded-md transition-colors" 
                            title="Regenerate"
                          >
                            <RotateCcw className="w-4 h-4 opacity-40" />
                          </button>
                          <button 
                            onClick={() => handleFeedback(msg.id, 'positive')}
                            className={cn(
                              "p-1.5 hover:bg-white/5 rounded-md transition-colors",
                              msg.feedback === 'positive' ? "text-green-400" : ""
                            )} 
                            title="Good response"
                          >
                            <ThumbsUp className={cn("w-4 h-4", msg.feedback === 'positive' ? "opacity-100" : "opacity-40")} />
                          </button>
                          <button 
                            onClick={() => handleFeedback(msg.id, 'negative')}
                            className={cn(
                              "p-1.5 hover:bg-white/5 rounded-md transition-colors",
                              msg.feedback === 'negative' ? "text-red-400" : ""
                            )} 
                            title="Bad response"
                          >
                            <ThumbsDown className={cn("w-4 h-4", msg.feedback === 'negative' ? "opacity-100" : "opacity-40")} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}


        </div>



        {/* Input Area - High Fidelity Refactor */}
        <div className={cn(
          "p-0 md:p-8 pb-[env(safe-area-inset-bottom)] md:pb-8 bg-[#0d0d0f] transition-all shrink-0 relative",
          messages.length === 0 ? "hidden" : "block"
        )}>
          <div className="w-full md:max-w-3xl mx-auto relative">
            {/* Floating Scroll Button - Centered above input area */}
            <AnimatePresence>
              {showScrollButton && !isSidebarOpen && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8, y: 10, x: '-50%' }}
                  animate={{ opacity: 1, scale: 1, y: 0, x: '-50%' }}
                  exit={{ opacity: 0, scale: 0.8, y: 10, x: '-50%' }}
                  onClick={() => scrollToBottom()}
                  className="absolute bottom-full left-1/2 -translate-y-4 z-[60] w-10 h-10 rounded-full bg-[#1a1a1a]/80 text-white/60 shadow-2xl backdrop-blur-xl flex items-center justify-center hover:bg-[#2a2a2a] hover:text-white transition-all border border-white/10 active:scale-95"
                >
                  <ChevronDown className="w-5 h-5" />
                </motion.button>
              )}
            </AnimatePresence>
            <SupportedFilesInfo 
              isOpen={showSupportedFiles} 
              onClose={() => setShowSupportedFiles(false)} 
            />
            
            {/* File Previews for Active Chat */}
            {(uploadingFiles.length > 0 || selectedFiles.length > 0) && (
              <div className="flex flex-wrap gap-3 mb-4 px-4 md:px-2">
                <AnimatePresence>
                  {uploadingFiles.map(f => (
                    <FilePreviewItem 
                      key={f.id} 
                      name={f.file.name} 
                      type={f.file.type} 
                      progress={f.progress} 
                      preview={f.preview}
                    />
                  ))}
                  {selectedFiles.map((f, idx) => (
                    <FilePreviewItem 
                      key={idx} 
                      name={f.name} 
                      type={f.type} 
                      size={f.size}
                      onRemove={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}

            <div ref={inputContainerRef} className="bg-[#1e1f20] md:bg-[#0d0d0f] rounded-t-[32px] rounded-b-none md:rounded-2xl overflow-visible shadow-2xl border-t border-white/5 md:border md:border-white/10 transition-transform duration-300">
              <div className="px-6 pt-5 pb-1 md:px-5 md:pt-5 md:pb-2">
                <textarea
                  ref={messages.length > 0 ? textareaRef : null}
                  value={input}
                  autoFocus={messages.length > 0}
                  onChange={(e) => setInput(e.target.value)}
                  onFocus={handleFocus}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={selectedStyle ? `Describe your ${selectedStyle.name} vision...` : "ASK OTIVO..."}
                  className="w-full bg-transparent border-none focus:ring-0 outline-none text-white text-base md:text-lg placeholder:text-white/50 resize-none min-h-[36px] max-h-[140px] md:min-h-[44px] md:max-h-[200px] custom-scrollbar leading-normal"
                  rows={1}
                />
              </div>

              <div className="flex items-center justify-between px-4 py-3 md:px-5 md:py-4 border-t border-white/5 mt-1 bg-transparent rounded-b-none md:rounded-b-2xl">
                <div className="flex items-center gap-1 md:gap-2">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 md:p-3 text-white/40 hover:text-white hover:bg-white/5 rounded-2xl transition-all group/btn"
                    title="Add file"
                  >
                    <Plus className="w-5 h-5 md:w-6 md:h-6 group-hover/btn:rotate-90 transition-transform duration-300" />
                  </button>
                  <div className="relative">
                    <button 
                      onClick={() => setIsResearchPickerOpen(!isResearchPickerOpen)}
                      className={cn(
                        "p-2 md:p-3 rounded-2xl transition-all",
                        isResearchPickerOpen ? "bg-blue-500/10 text-blue-400" : "text-white/40 hover:text-white hover:bg-white/5"
                      )}
                      title="Deep Research"
                    >
                      <Globe className="w-5 h-5 md:w-6 md:h-6" />
                    </button>

                    <AnimatePresence>
                      {isResearchPickerOpen && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 10 }}
                          className="absolute bottom-full left-0 mb-3 w-[calc(100vw-2rem)] md:w-72 bg-[#0d0d0f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[999]"
                        >
                          <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Research Suggestions</span>
                          </div>
                          {RESEARCH_SUGGESTIONS.map((suggestion, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                setInput(suggestion);
                                setIsResearchPickerOpen(false);
                                if (textareaRef.current) textareaRef.current.focus();
                              }}
                              className="w-full text-left px-4 py-3 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="flex items-center gap-3 md:gap-6">
                  <button 
                    onClick={() => {
                      if (onOpenVoiceAssistant) onOpenVoiceAssistant();
                      else if (isVoiceActive) stopVoiceInput();
                      else startVoiceInput();
                    }}
                    className={cn(
                      "p-1.5 md:p-2 rounded-full transition-all",
                      isVoiceActive ? "bg-red-500/20 text-red-500" : "text-white/50 hover:text-white"
                    )}
                    title="Voice Input"
                  >
                    <Mic className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                  <button 
                    onClick={() => {
                      if (typingMessageId || isLoading) {
                        isCancelledRef.current = true;
                        setTypingMessageId(null);
                        setIsLoading(false);
                        
                        // Also kill the "Thinking" state in the actual message list
                        setMessages(prev => {
                          const lastMsg = prev[prev.length - 1];
                          if (lastMsg && lastMsg.role === 'assistant' && lastMsg.isLoading) {
                            const newMessages = prev.map((m, i) => 
                              i === prev.length - 1 ? { ...m, isLoading: false } : m
                            );
                            // Sync to session
                            setSessions(s => s.map(sess => sess.id === currentSessionId ? { ...sess, messages: newMessages } : sess));
                            return newMessages;
                          }
                          return prev;
                        });
                        return;
                      }
                      if (!input.trim() && selectedFiles.length === 0) {
                        onOpenVoiceAssistant?.();
                        return;
                      }
                      handleSend();
                    }}
                    className={cn(
                      "p-2.5 md:p-3 rounded-full transition-all duration-300 shadow-lg",
                      "bg-white text-black hover:scale-110 active:scale-95"
                    )}
                  >
                    {typingMessageId || isLoading ? (
                      <div className="relative flex items-center justify-center w-4 h-4 md:w-5 md:h-5">
                        <Square className="w-2.5 h-2.5 md:w-3 md:h-3 fill-current" />
                      </div>
                    ) : (!input.trim() && selectedFiles.length === 0) ? (
                      <AudioLines className="w-4 h-4 md:w-5 md:h-5" />
                    ) : (
                      <Send className="w-4 h-4 md:w-5 md:h-5 rotate-[-45deg]" />
                    )}
                  </button>
                </div>
              </div>
            </div>
            
            <p className="hidden md:block text-[10px] text-center text-white/20 mt-4">
              OTIVO AI can make mistakes. Check important info.
            </p>
          </div>
        </div>
      </div>

        {/* Desktop Split View Preview Column */}
        <AnimatePresence mode="wait">
          {(activeDocument || isPreviewOpen) && (
            <motion.div 
              key={activeDocument ? `doc-${activeDocument.id}` : 'preview'}
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: "50%", opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="hidden lg:flex h-full overflow-hidden z-20 border-l border-white/5"
            >
              {activeDocument ? (
                <DocumentViewer doc={activeDocument} onClose={() => setActiveDocument(null)} />
              ) : (
                <StaticPreview content={previewContent} onClose={() => setIsPreviewOpen(false)} />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile Full Screen Preview Overlay */}
        <AnimatePresence>
          {(activeDocument || isPreviewOpen) && (
            <motion.div 
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              className="lg:hidden fixed inset-0 z-[100] bg-black"
            >
              {activeDocument ? (
                <DocumentViewer doc={activeDocument} onClose={() => setActiveDocument(null)} />
              ) : (
                <StaticPreview content={previewContent} onClose={() => setIsPreviewOpen(false)} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
          {sessionToDelete && (
            <div className="fixed inset-0 flex items-center justify-center z-[100] px-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSessionToDelete(null)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-sm bg-[#1e1e1e] border border-white/10 rounded-2xl p-6 shadow-2xl"
              >
                <h3 className="text-xl font-semibold text-white mb-2">Delete chat?</h3>
                <p className="text-[#a0a0a0] text-[15px] mb-4">
                  This will delete <span className="text-white font-medium">{sessionToDelete.title}</span>.
                </p>
                <p className="text-[#666] text-xs mb-6">
                  Visit <span className="underline cursor-pointer">settings</span> to delete any memories saved during this chat.
                </p>
                
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => setSessionToDelete(null)}
                    className="px-5 py-2.5 rounded-full text-sm font-medium border border-white/10 text-white hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="px-6 py-2.5 rounded-full text-sm font-medium bg-[#ef4444] text-white hover:bg-[#dc2626] transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        multiple 
      />
    </div>
  );
};
