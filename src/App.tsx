/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FullPageAssistant } from './components/FullPageAssistant';
import { VoiceAssistantModal } from './components/VoiceAssistantModal';
import { ProjectFile, ChatMessage } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { EnvVarDialog } from './components/EnvVarDialog';
import { setRuntimeApiKey } from './services/aiService';
import { OTIVO_BRAND } from './constants/brand';

export default function App() {
  const [files, setFiles] = React.useState<ProjectFile[]>([]);
  const [showFullPage, setShowFullPage] = React.useState(true);
  const [showVoiceAssistant, setShowVoiceAssistant] = React.useState(false);
  const [showEnvDialog, setShowEnvDialog] = React.useState(false);

  // Check for API keys on mount
  React.useEffect(() => {
    (window as any).forceRemovePreloader?.();
    const keys = [
      process.env.GEMINI_API_KEY,
      (import.meta as any).env?.VITE_GEMINI_API_KEY,
      localStorage.getItem('VITE_GEMINI_API_KEY')
    ].filter(Boolean);
    
    if (keys.length === 0) {
      setShowEnvDialog(true);
    }
  }, []);

  // Handle routing based on hash - Simplified for Assistant only
  React.useEffect(() => {
    const handleHash = () => {
      // Always stay on assistant
      if (window.location.hash !== '#/assistant') {
        window.location.hash = '#/assistant';
      }
      setShowFullPage(true);
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Prevent screen sleep while active
  React.useEffect(() => {
    let wakeLock: any = null;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) {
        console.error('Wake Lock error:', err);
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (wakeLock !== null && document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (wakeLock !== null) {
        wakeLock.release().catch(console.error);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleImageGenerated = (base64: string, prompt: string, fileName?: string) => {
    // Handle image generation callback if needed
    console.log("Image generated:", fileName);
  };

  return (
    <ErrorBoundary>
      {/* Instant header with logo and title */}
      <div className="flex items-center gap-3 p-4 bg-[#0d0d0f] text-white border-b border-white/5">
        <img src={OTIVO_BRAND.logo.path} alt={OTIVO_BRAND.name} className="h-8 w-auto" />
        <h1 className="text-xl font-bold">{OTIVO_BRAND.name}</h1>
      </div>

      <FullPageAssistant 
        onBack={() => {}} // Disabled back navigation
        onImageGenerated={handleImageGenerated} 
        files={files} 
        onOpenVoiceAssistant={() => setShowVoiceAssistant(true)}
      />      
      {showVoiceAssistant && (
        <VoiceAssistantModal 
          isOpen={showVoiceAssistant}
          onClose={() => setShowVoiceAssistant(false)} 
          files={files}
          onImageGenerated={handleImageGenerated}
          storageKey="otivo_assistant_voice_history"
        />
      )}

      <EnvVarDialog 
        isOpen={showEnvDialog}
        onClose={() => setShowEnvDialog(false)}
        onConfirm={(val) => {
          setRuntimeApiKey(val);
          setShowEnvDialog(false);
        }}
        varName="VITE_GEMINI_API_KEY"
      />
    </ErrorBoundary>
  );
}
