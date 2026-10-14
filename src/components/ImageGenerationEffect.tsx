import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, Copy, Check, ExternalLink } from 'lucide-react';
import { cn } from '../lib/utils';

interface ImageGenerationEffectProps {
  isGenerating: boolean;
  imageUrl?: string;
  prompt?: string;
}

export const ImageGenerationEffect: React.FC<ImageGenerationEffectProps> = ({ 
  isGenerating, 
  imageUrl,
  prompt 
}) => {
  const [noiseOffset, setNoiseOffset] = React.useState({ x: 0, y: 0 });
  const [isCopied, setIsCopied] = React.useState(false);

  const handleDownload = () => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `otivo-gen-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopy = async () => {
    if (!imageUrl) return;
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const item = new ClipboardItem({ [blob.type]: blob });
      await navigator.clipboard.write([item]);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy image:', err);
    }
  };

  React.useEffect(() => {
    if (isGenerating) {
      const interval = setInterval(() => {
        setNoiseOffset({
          x: Math.random() * 100,
          y: Math.random() * 100
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [isGenerating]);

  return (
    <div className="relative w-full max-w-2xl aspect-square rounded-2xl overflow-hidden bg-[#1a1a1a] border border-white/5 shadow-2xl group">
      <AnimatePresence mode="wait">
        {isGenerating ? (
          <motion.div 
            key="generating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden"
          >
            {/* Shimmering Noise Layer - More intense */}
            <div 
              className="absolute inset-0 opacity-40 pointer-events-none mix-blend-overlay"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                backgroundPosition: `${noiseOffset.x}% ${noiseOffset.y}%`,
                transform: 'scale(1.5)',
              }}
            />
            
            {/* Colorful Shimmering Glows - More dynamic */}
            <div className="absolute inset-0">
              <motion.div 
                animate={{ 
                  scale: [1, 1.4, 1],
                  opacity: [0.3, 0.6, 0.3],
                  rotate: [0, 45, 0],
                  x: [-15, 15, -15],
                  y: [-15, 15, -15]
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-0 left-0 w-full h-full bg-crimson-500/20 blur-[130px] rounded-full mix-blend-screen"
              />
              <motion.div 
                animate={{ 
                  scale: [1.3, 1, 1.3],
                  opacity: [0.3, 0.6, 0.3],
                  rotate: [0, -45, 0],
                  x: [15, -15, 15],
                  y: [15, -15, 15]
                }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute bottom-0 right-0 w-full h-full bg-emerald-500/20 blur-[130px] rounded-full mix-blend-screen"
              />
              <motion.div 
                animate={{ 
                  scale: [1, 1.2, 1],
                  opacity: [0.2, 0.4, 0.2],
                  x: [0, 20, 0],
                }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-1/4 right-1/4 w-1/2 h-1/2 bg-white/10 blur-[110px] rounded-full"
              />
            </div>

            <div className="relative z-10 flex flex-col items-center gap-6 px-8 text-center">
              <div className="space-y-3">
                <h3 className="text-xl font-serif italic text-white tracking-tight">Birth of a Vision</h3>
                <p className="text-[11px] text-white/40 uppercase tracking-[0.3em] font-black">Diffusion in Progress</p>
                <div className="w-48 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent mx-auto" />
                <p className="text-sm text-white/60 italic line-clamp-2 max-w-md mx-auto px-4">
                  {prompt || "Crafting details based on your imagination..."}
                </p>
              </div>
              <div className="flex gap-4">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ 
                      scale: [1, 1.5, 1], 
                      opacity: [0.1, 1, 0.1],
                    }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                    className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                  />
                ))}
              </div>
            </div>
          </motion.div>
        ) : imageUrl ? (
          <motion.div
            key="image"
            initial={{ opacity: 0, scale: 1.05, filter: 'blur(30px) brightness(1.5)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px) brightness(1)' }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="absolute inset-0"
          >
            <img 
              src={imageUrl || undefined} 
              alt="Generated" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            
            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => window.open(imageUrl, '_blank')}
                className="w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-all border border-white/10"
                title="View Full Size"
              >
                <ExternalLink className="w-5 h-5" />
              </motion.button>
              
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleCopy}
                className="w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-all border border-white/10"
                title="Copy Image"
              >
                {isCopied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
              </motion.button>

              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleDownload}
                className="w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-all border border-white/10"
                title="Download Image"
              >
                <Download className="w-5 h-5" />
              </motion.button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};
