import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'motion/react';
import { BrainCircuit } from 'lucide-react';

interface FadeTypewriterProps {
  thought: string;
  isStreaming?: boolean;
}

export const FadeTypewriter: React.FC<FadeTypewriterProps> = ({ thought, isStreaming }) => {
  return (
    <div className="prose prose-invert prose-xs max-w-none text-[12.5px] text-white/50 leading-relaxed font-sans relative">
      <div className="whitespace-pre-wrap transition-all duration-300">
        {thought}
        {isStreaming && (
          <motion.span
            className="inline-block w-1.5 h-3.5 bg-blue-500/50 ml-1 rounded-sm align-middle"
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            style={{ 
              boxShadow: '0 0 8px rgba(59, 130, 246, 0.4)',
              filter: 'blur(0.2px)'
            }}
          />
        )}
      </div>
      {!thought && isStreaming && (
        <div className="flex items-center gap-2 text-white/30 italic">
          <BrainCircuit className="w-3 h-3 animate-pulse" />
          <span>Formulating strategic logic...</span>
        </div>
      )}
    </div>
  );
};
