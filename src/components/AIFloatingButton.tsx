import React from 'react';
import { OTIVO_BRAND } from '../constants/brand';

interface AIFloatingButtonProps {
  onClick?: () => void;
}

export const AIFloatingButton: React.FC<AIFloatingButtonProps> = ({ onClick }) => {
  return (
    <div 
      onClick={onClick}
      className="fixed bottom-10 right-10 cursor-pointer z-[9999] transition-all duration-500 hover:scale-110 group"
    >
      {/* Expanding Pulse Waves (Emerald) */}
      <div className="absolute inset-0 rounded-2xl bg-emerald-500/20 animate-ping pointer-events-none scale-150 opacity-0 group-hover:opacity-100 transition-opacity"></div>
      <div className="absolute inset-0 rounded-2xl bg-emerald-500/10 animate-pulse pointer-events-none scale-125"></div>

      {/* High-Tech Container */}
      <div className="relative w-20 h-20 bg-[#0A0F1C] rounded-2xl flex justify-center items-center shadow-[0_10px_40px_rgba(0,0,0,0.8),0_0_20px_rgba(16,185,129,0.2)] backdrop-blur-xl border border-white/10 group-hover:border-emerald-500/50 transition-all overflow-hidden">
        {/* Animated Background Gradients */}
        <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-transparent"></div>
        
        {/* Orbiting Ring */}
        <div className="absolute inset-2 rounded-xl border border-transparent border-t-emerald-500/40 border-r-emerald-500/40 animate-spin-slow"></div>
        
        {/* The Logo */}
        <img 
          src={OTIVO_BRAND.logo.path} 
          alt="OTIVO Logo" 
          className="relative w-10 h-10 object-contain z-10 transition-all duration-500 group-hover:scale-110 group-hover:rotate-[5deg] drop-shadow-[0_0_15px_rgba(16,185,129,0.4)]" 
          referrerPolicy="no-referrer"
        />
        
        {/* Scanline overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent h-[200%] -translate-y-full group-hover:translate-y-full transition-transform duration-[2000ms] ease-linear repeat-infinite" />
      </div>
    </div>
  );
};
