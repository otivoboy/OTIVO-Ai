import React, { useEffect, useRef, useState } from 'react';
import { X, Mic, Settings, Search, AlertTriangle, Info, Trash2, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { cn, overlayLogo } from '../lib/utils';
import { getAI, generateImage as aiGenerateImage, performSerperSearch, fetchWebPage } from '../services/aiService';
import { Modality, LiveServerMessage, Type } from '@google/genai';
import { motion, AnimatePresence } from 'motion/react';

import { ProjectFile } from '../types';

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImageGenerated?: (base64: string, prompt: string, fileName?: string) => void;
  files?: ProjectFile[];
  storageKey?: string;
}

// Global API Keys and URLs
let SERPER_API_KEY = (import.meta as any).env?.VITE_SERPER_API_KEY || '7b1c8f10b05978a64f04b36c3bf0659b7be129ac';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';

// Update from server if possible
if (typeof window !== 'undefined') {
  fetch('/api/config')
    .then(res => res.json())
    .then(data => {
      if (data.SERPER_API_KEY) SERPER_API_KEY = data.SERPER_API_KEY;
    })
    .catch(() => {});
}

const GEMINI_API_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
  process.env.GEMINI_API_KEY_5,
].filter(Boolean) as string[];

// Complete Voice Mapping Database for Microsoft Natural Voices
const MICROSOFT_VOICE_MAPPING: Record<string, any[]> = {
    // English - United States
    'en-US': [
        { displayName: 'Ava (US)', technicalName: 'Microsoft Ava Online (Natural) - English (United States)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Andrew (US)', technicalName: 'Microsoft Andrew Online (Natural) - English (United States)', gender: 'male', style: 'confident, warm', neural: true, multilingual: false },
        { displayName: 'Emma (US)', technicalName: 'Microsoft Emma Online (Natural) - English (United States)', gender: 'female', style: 'cheerful, warm', neural: true, multilingual: false },
        { displayName: 'Brian (US)', technicalName: 'Microsoft Brian Online (Natural) - English (United States)', gender: 'male', style: 'professional, warm', neural: true, multilingual: false },
        { displayName: 'Jenny (US)', technicalName: 'Microsoft Jenny Online (Natural) - English (United States)', gender: 'female', style: 'friendly, empathetic', neural: true, multilingual: false },
        { displayName: 'Guy (US)', technicalName: 'Microsoft Guy Online (Natural) - English (United States)', gender: 'male', style: 'energetic, casual', neural: true, multilingual: false },
        { displayName: 'Aria (US)', technicalName: 'Microsoft Aria Online (Natural) - English (United States)', gender: 'female', style: 'energetic, expressive', neural: true, multilingual: false },
        { displayName: 'Davis (US)', technicalName: 'Microsoft Davis Online (Natural) - English (United States)', gender: 'male', style: 'assistant-like, warm', neural: true, multilingual: false },
        { displayName: 'Jane (US)', technicalName: 'Microsoft Jane Online (Natural) - English (United States)', gender: 'female', style: 'professional, warm', neural: true, multilingual: false },
        { displayName: 'Jason (US)', technicalName: 'Microsoft Jason Online (Natural) - English (United States)', gender: 'male', style: 'energetic, casual', neural: true, multilingual: false },
        { displayName: 'Nancy (US)', technicalName: 'Microsoft Nancy Online (Natural) - English (United States)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Sara (US)', technicalName: 'Microsoft Sara Online (Natural) - English (United States)', gender: 'female', style: 'cheerful, warm', neural: true, multilingual: false },
        { displayName: 'Tony (US)', technicalName: 'Microsoft Tony Online (Natural) - English (United States)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'David (US)', technicalName: 'Microsoft David Desktop - English (United States)', gender: 'male', style: 'standard', neural: false, multilingual: false },
        { displayName: 'Zira (US)', technicalName: 'Microsoft Zira Desktop - English (United States)', gender: 'female', style: 'standard', neural: false, multilingual: false },
        { displayName: 'Mark (US)', technicalName: 'Microsoft Mark Desktop - English (United States)', gender: 'male', style: 'standard', neural: false, multilingual: false }
    ],
    // English - United Kingdom
    'en-GB': [
        { displayName: 'Sonia (UK)', technicalName: 'Microsoft Sonia Online (Natural) - English (United Kingdom)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Ryan (UK)', technicalName: 'Microsoft Ryan Online (Natural) - English (United Kingdom)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Libby (UK)', technicalName: 'Microsoft Libby Online (Natural) - English (United Kingdom)', gender: 'female', style: 'cheerful, warm', neural: true, multilingual: false },
        { displayName: 'Mia (UK)', technicalName: 'Microsoft Mia Online (Natural) - English (United Kingdom)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Hazel (UK)', technicalName: 'Microsoft Hazel Desktop - English (United Kingdom)', gender: 'female', style: 'standard', neural: false, multilingual: false },
        { displayName: 'George (UK)', technicalName: 'Microsoft George Desktop - English (United Kingdom)', gender: 'male', style: 'standard', neural: false, multilingual: false },
        { displayName: 'Susan (UK)', technicalName: 'Microsoft Susan Desktop - English (United Kingdom)', gender: 'female', style: 'standard', neural: false, multilingual: false }
    ],
    // English - Australia
    'en-AU': [
        { displayName: 'Natasha (AU)', technicalName: 'Microsoft Natasha Online (Natural) - English (Australia)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'William (AU)', technicalName: 'Microsoft William Online (Natural) - English (Australia)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Annette (AU)', technicalName: 'Microsoft Annette Online (Natural) - English (Australia)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Carly (AU)', technicalName: 'Microsoft Carly Online (Natural) - English (Australia)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Darren (AU)', technicalName: 'Microsoft Darren Online (Natural) - English (Australia)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Duncan (AU)', technicalName: 'Microsoft Duncan Online (Natural) - English (Australia)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Elsie (AU)', technicalName: 'Microsoft Elsie Online (Natural) - English (Australia)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Freya (AU)', technicalName: 'Microsoft Freya Online (Natural) - English (Australia)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Joanne (AU)', technicalName: 'Microsoft Joanne Online (Natural) - English (Australia)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Ken (AU)', technicalName: 'Microsoft Ken Online (Natural) - English (Australia)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Kim (AU)', technicalName: 'Microsoft Kim Online (Natural) - English (Australia)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Neil (AU)', technicalName: 'Microsoft Neil Online (Natural) - English (Australia)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Tim (AU)', technicalName: 'Microsoft Tim Online (Natural) - English (Australia)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Tina (AU)', technicalName: 'Microsoft Tina Online (Natural) - English (Australia)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false }
    ],
    // English - India
    'en-IN': [
        { displayName: 'Neerja (IN)', technicalName: 'Microsoft Neerja Online (Natural) - English (India)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Prabhat (IN)', technicalName: 'Microsoft Prabhat Online (Natural) - English (India)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Ananya (IN)', technicalName: 'Microsoft Ananya Online (Natural) - English (India)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Kavya (IN)', technicalName: 'Microsoft Kavya Online (Natural) - English (India)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Kunal (IN)', technicalName: 'Microsoft Kunal Online (Natural) - English (India)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Reeti (IN)', technicalName: 'Microsoft Reeti Online (Natural) - English (India)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Rishi (IN)', technicalName: 'Microsoft Rishi Online (Natural) - English (India)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false }
    ],
    // Swahili - Kenya
    'sw-KE': [
        { displayName: 'Asilia (KE)', technicalName: 'Microsoft Asilia Online (Natural) - Swahili (Kenya)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Rafiki (KE)', technicalName: 'Microsoft Rafiki Online (Natural) - Swahili (Kenya)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false }
    ],
    // French - France
    'fr-FR': [
        { displayName: 'Denise (FR)', technicalName: 'Microsoft Denise Online (Natural) - French (France)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Henri (FR)', technicalName: 'Microsoft Henri Online (Natural) - French (France)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Coralie (FR)', technicalName: 'Microsoft Coralie Online (Natural) - French (France)', gender: 'female', style: 'cheerful, warm', neural: true, multilingual: false },
        { displayName: 'Alain (FR)', technicalName: 'Microsoft Alain Online (Natural) - French (France)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Brigitte (FR)', technicalName: 'Microsoft Brigitte Online (Natural) - French (France)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Celeste (FR)', technicalName: 'Microsoft Celeste Online (Natural) - French (France)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Claude (FR)', technicalName: 'Microsoft Claude Online (Natural) - French (France)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Eloise (FR)', technicalName: 'Microsoft Eloise Online (Natural) - French (France)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Jacqueline (FR)', technicalName: 'Microsoft Jacqueline Online (Natural) - French (France)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Jerome (FR)', technicalName: 'Microsoft Jerome Online (Natural) - French (France)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Josephine (FR)', technicalName: 'Microsoft Josephine Online (Natural) - French (France)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Maurice (FR)', technicalName: 'Microsoft Maurice Online (Natural) - French (France)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Yves (FR)', technicalName: 'Microsoft Yves Online (Natural) - French (France)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Julie (FR)', technicalName: 'Microsoft Julie Desktop - French (France)', gender: 'female', style: 'standard', neural: false, multilingual: false },
        { displayName: 'Paul (FR)', technicalName: 'Microsoft Paul Desktop - French (France)', gender: 'male', style: 'standard', neural: false, multilingual: false }
    ],
    // Spanish - Spain
    'es-ES': [
        { displayName: 'Alvaro (ES)', technicalName: 'Microsoft Alvaro Online (Natural) - Spanish (Spain)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Elvira (ES)', technicalName: 'Microsoft Elvira Online (Natural) - Spanish (Spain)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Abril (ES)', technicalName: 'Microsoft Abril Online (Natural) - Spanish (Spain)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Arnau (ES)', technicalName: 'Microsoft Arnau Online (Natural) - Spanish (Spain)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Dario (ES)', technicalName: 'Microsoft Dario Online (Natural) - Spanish (Spain)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Elias (ES)', technicalName: 'Microsoft Elias Online (Natural) - Spanish (Spain)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Estrella (ES)', technicalName: 'Microsoft Estrella Online (Natural) - Spanish (Spain)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Irene (ES)', technicalName: 'Microsoft Irene Online (Natural) - Spanish (Spain)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Laia (ES)', technicalName: 'Microsoft Laia Online (Natural) - Spanish (Spain)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Nil (ES)', technicalName: 'Microsoft Nil Online (Natural) - Spanish (Spain)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Saul (ES)', technicalName: 'Microsoft Saul Online (Natural) - Spanish (Spain)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Teo (ES)', technicalName: 'Microsoft Teo Online (Natural) - Spanish (Spain)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Triana (ES)', technicalName: 'Microsoft Triana Online (Natural) - Spanish (Spain)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Helena (ES)', technicalName: 'Microsoft Helena Desktop - Spanish (Spain)', gender: 'female', style: 'standard', neural: false, multilingual: false },
        { displayName: 'Luis (ES)', technicalName: 'Microsoft Luis Desktop - Spanish (Spain)', gender: 'male', style: 'standard', neural: false, multilingual: false }
    ],
    // German - Germany
    'de-DE': [
        { displayName: 'Katja (DE)', technicalName: 'Microsoft Katja Online (Natural) - German (Germany)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Conrad (DE)', technicalName: 'Microsoft Conrad Online (Natural) - German (Germany)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Amala (DE)', technicalName: 'Microsoft Amala Online (Natural) - German (Germany)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Bernd (DE)', technicalName: 'Microsoft Bernd Online (Natural) - German (Germany)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Christoph (DE)', technicalName: 'Microsoft Christoph Online (Natural) - German (Germany)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Elke (DE)', technicalName: 'Microsoft Elke Online (Natural) - German (Germany)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Gisela (DE)', technicalName: 'Microsoft Gisela Online (Natural) - German (Germany)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Kasper (DE)', technicalName: 'Microsoft Kasper Online (Natural) - German (Germany)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Killian (DE)', technicalName: 'Microsoft Killian Online (Natural) - German (Germany)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Klarissa (DE)', technicalName: 'Microsoft Klarissa Online (Natural) - German (Germany)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Klaus (DE)', technicalName: 'Microsoft Klaus Online (Natural) - German (Germany)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Louisa (DE)', technicalName: 'Microsoft Louisa Online (Natural) - German (Germany)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Maja (DE)', technicalName: 'Microsoft Maja Online (Natural) - German (Germany)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Ralf (DE)', technicalName: 'Microsoft Ralf Online (Natural) - German (Germany)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Stefan (DE)', technicalName: 'Microsoft Stefan Desktop - German (Germany)', gender: 'male', style: 'standard', neural: false, multilingual: false },
        { displayName: 'Hedda (DE)', technicalName: 'Microsoft Hedda Desktop - German (Germany)', gender: 'female', style: 'standard', neural: false, multilingual: false }
    ],
    // Italian - Italy
    'it-IT': [
        { displayName: 'Elsa (IT)', technicalName: 'Microsoft Elsa Online (Natural) - Italian (Italy)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Isabella (IT)', technicalName: 'Microsoft Isabella Online (Natural) - Italian (Italy)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Diego (IT)', technicalName: 'Microsoft Diego Online (Natural) - Italian (Italy)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Benigno (IT)', technicalName: 'Microsoft Benigno Online (Natural) - Italian (Italy)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Calimero (IT)', technicalName: 'Microsoft Calimero Online (Natural) - Italian (Italy)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Cataldo (IT)', technicalName: 'Microsoft Cataldo Online (Natural) - Italian (Italy)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Fabiola (IT)', technicalName: 'Microsoft Fabiola Online (Natural) - Italian (Italy)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Fiamma (IT)', technicalName: 'Microsoft Fiamma Online (Natural) - Italian (Italy)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Gianni (IT)', technicalName: 'Microsoft Gianni Online (Natural) - Italian (Italy)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Imelda (IT)', technicalName: 'Microsoft Imelda Online (Natural) - Italian (Italy)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Irma (IT)', technicalName: 'Microsoft Irma Online (Natural) - Italian (Italy)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Lisandro (IT)', technicalName: 'Microsoft Lisandro Online (Natural) - Italian (Italy)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Palmira (IT)', technicalName: 'Microsoft Palmira Online (Natural) - Italian (Italy)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Pierina (IT)', technicalName: 'Microsoft Pierina Online (Natural) - Italian (Italy)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Rinaldo (IT)', technicalName: 'Microsoft Rinaldo Online (Natural) - Italian (Italy)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Cosimo (IT)', technicalName: 'Microsoft Cosimo Desktop - Italian (Italy)', gender: 'male', style: 'standard', neural: false, multilingual: false }
    ],
    // Portuguese - Brazil
    'pt-BR': [
        { displayName: 'Francisca (BR)', technicalName: 'Microsoft Francisca Online (Natural) - Portuguese (Brazil)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Antonio (BR)', technicalName: 'Microsoft Antonio Online (Natural) - Portuguese (Brazil)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Brenda (BR)', technicalName: 'Microsoft Brenda Online (Natural) - Portuguese (Brazil)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Donato (BR)', technicalName: 'Microsoft Donato Online (Natural) - Portuguese (Brazil)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Eliane (BR)', technicalName: 'Microsoft Eliane Online (Natural) - Portuguese (Brazil)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Fabio (BR)', technicalName: 'Microsoft Fabio Online (Natural) - Portuguese (Brazil)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Giovanna (BR)', technicalName: 'Microsoft Giovanna Online (Natural) - Portuguese (Brazil)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Humberto (BR)', technicalName: 'Microsoft Humberto Online (Natural) - Portuguese (Brazil)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Julio (BR)', technicalName: 'Microsoft Julio Online (Natural) - Portuguese (Brazil)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Leila (BR)', technicalName: 'Microsoft Leila Online (Natural) - Portuguese (Brazil)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Leticia (BR)', technicalName: 'Microsoft Leticia Online (Natural) - Portuguese (Brazil)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Manuela (BR)', technicalName: 'Microsoft Manuela Online (Natural) - Portuguese (Brazil)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Nicolau (BR)', technicalName: 'Microsoft Nicolau Online (Natural) - Portuguese (Brazil)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Valerio (BR)', technicalName: 'Microsoft Valerio Online (Natural) - Portuguese (Brazil)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Yara (BR)', technicalName: 'Microsoft Yara Online (Natural) - Portuguese (Brazil)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Daniel (BR)', technicalName: 'Microsoft Daniel Desktop - Portuguese (Brazil)', gender: 'male', style: 'standard', neural: false, multilingual: false },
        { displayName: 'Maria (BR)', technicalName: 'Microsoft Maria Desktop - Portuguese (Brazil)', gender: 'female', style: 'standard', neural: false, multilingual: false }
    ],
    // Japanese - Japan
    'ja-JP': [
        { displayName: 'Nanami (JP)', technicalName: 'Microsoft Nanami Online (Natural) - Japanese (Japan)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Keita (JP)', technicalName: 'Microsoft Keita Online (Natural) - Japanese (Japan)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Aoi (JP)', technicalName: 'Microsoft Aoi Online (Natural) - Japanese (Japan)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Daichi (JP)', technicalName: 'Microsoft Daichi Online (Natural) - Japanese (Japan)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Mayu (JP)', technicalName: 'Microsoft Mayu Online (Natural) - Japanese (Japan)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Naoki (JP)', technicalName: 'Microsoft Naoki Online (Natural) - Japanese (Japan)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Shiori (JP)', technicalName: 'Microsoft Shiori Online (Natural) - Japanese (Japan)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Ayumi (JP)', technicalName: 'Microsoft Ayumi Desktop - Japanese (Japan)', gender: 'female', style: 'standard', neural: false, multilingual: false },
        { displayName: 'Ichiro (JP)', technicalName: 'Microsoft Ichiro Desktop - Japanese (Japan)', gender: 'male', style: 'standard', neural: false, multilingual: false },
        { displayName: 'Haruka (JP)', technicalName: 'Microsoft Haruka Desktop - Japanese (Japan)', gender: 'female', style: 'standard', neural: false, multilingual: false }
    ],
    // Chinese - Mainland
    'zh-CN': [
        { displayName: 'Xiaoxiao (CN)', technicalName: 'Microsoft Xiaoxiao Online (Natural) - Chinese (Mainland)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Yunxi (CN)', technicalName: 'Microsoft Yunxi Online (Natural) - Chinese (Mainland)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Xiaoyi (CN)', technicalName: 'Microsoft Xiaoyi Online (Natural) - Chinese (Mainland)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Yunjian (CN)', technicalName: 'Microsoft Yunjian Online (Natural) - Chinese (Mainland)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Yunye (CN)', technicalName: 'Microsoft Yunye Online (Natural) - Chinese (Mainland)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Xiaochen (CN)', technicalName: 'Microsoft Xiaochen Online (Natural) - Chinese (Mainland)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Xiaohan (CN)', technicalName: 'Microsoft Xiaohan Online (Natural) - Chinese (Mainland)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Xiaomeng (CN)', technicalName: 'Microsoft Xiaomeng Online (Natural) - Chinese (Mainland)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Xiaomo (CN)', technicalName: 'Microsoft Xiaomo Online (Natural) - Chinese (Mainland)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Xiaoqiu (CN)', technicalName: 'Microsoft Xiaoqiu Online (Natural) - Chinese (Mainland)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Xiaorui (CN)', technicalName: 'Microsoft Xiaorui Online (Natural) - Chinese (Mainland)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Xiaoshuang (CN)', technicalName: 'Microsoft Xiaoshuang Online (Natural) - Chinese (Mainland)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Xiaoxuan (CN)', technicalName: 'Microsoft Xiaoxuan Online (Natural) - Chinese (Mainland)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Xiaozhen (CN)', technicalName: 'Microsoft Xiaozhen Online (Natural) - Chinese (Mainland)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Yunfeng (CN)', technicalName: 'Microsoft Yunfeng Online (Natural) - Chinese (Mainland)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Yunhao (CN)', technicalName: 'Microsoft Yunhao Online (Natural) - Chinese (Mainland)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Yunjhe (CN)', technicalName: 'Microsoft Yunjhe Online (Natural) - Chinese (Mainland)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Yunxia (CN)', technicalName: 'Microsoft Yunxia Online (Natural) - Chinese (Mainland)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Yunyang (CN)', technicalName: 'Microsoft Yunyang Online (Natural) - Chinese (Mainland)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Yunze (CN)', technicalName: 'Microsoft Yunze Online (Natural) - Chinese (Mainland)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Huihui (CN)', technicalName: 'Microsoft Huihui Desktop - Chinese (Mainland)', gender: 'female', style: 'standard', neural: false, multilingual: false },
        { displayName: 'Yaoyao (CN)', technicalName: 'Microsoft Yaoyao Desktop - Chinese (Mainland)', gender: 'female', style: 'standard', neural: false, multilingual: false },
        { displayName: 'Kangkang (CN)', technicalName: 'Microsoft Kangkang Desktop - Chinese (Mainland)', gender: 'male', style: 'standard', neural: false, multilingual: false }
    ],
    // Hindi - India
    'hi-IN': [
        { displayName: 'Swara (IN)', technicalName: 'Microsoft Swara Online (Natural) - Hindi (India)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Madhur (IN)', technicalName: 'Microsoft Madhur Online (Natural) - Hindi (India)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Ananya (IN)', technicalName: 'Microsoft Ananya Online (Natural) - Hindi (India)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Kavya (IN)', technicalName: 'Microsoft Kavya Online (Natural) - Hindi (India)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Kunal (IN)', technicalName: 'Microsoft Kunal Online (Natural) - Hindi (India)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Reeti (IN)', technicalName: 'Microsoft Reeti Online (Natural) - Hindi (India)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Rishi (IN)', technicalName: 'Microsoft Rishi Online (Natural) - Hindi (India)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Hemant (IN)', technicalName: 'Microsoft Hemant Desktop - Hindi (India)', gender: 'male', style: 'standard', neural: false, multilingual: false },
        { displayName: 'Kalpana (IN)', technicalName: 'Microsoft Kalpana Desktop - Hindi (India)', gender: 'female', style: 'standard', neural: false, multilingual: false }
    ],
    // Arabic - Saudi Arabia
    'ar-SA': [
        { displayName: 'Zariyah (SA)', technicalName: 'Microsoft Zariyah Online (Natural) - Arabic (Saudi Arabia)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Hamed (SA)', technicalName: 'Microsoft Hamed Online (Natural) - Arabic (Saudi Arabia)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Naayf (SA)', technicalName: 'Microsoft Naayf Desktop - Arabic (Saudi Arabia)', gender: 'male', style: 'standard', neural: false, multilingual: false }
    ],
    // Russian - Russia
    'ru-RU': [
        { displayName: 'Svetlana (RU)', technicalName: 'Microsoft Svetlana Online (Natural) - Russian (Russia)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Dmitry (RU)', technicalName: 'Microsoft Dmitry Online (Natural) - Russian (Russia)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Irina (RU)', technicalName: 'Microsoft Irina Desktop - Russian (Russia)', gender: 'female', style: 'standard', neural: false, multilingual: false }
    ],
    // Korean - South Korea
    'ko-KR': [
        { displayName: 'SunHi (KR)', technicalName: 'Microsoft SunHi Online (Natural) - Korean (South Korea)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'InJoon (KR)', technicalName: 'Microsoft InJoon Online (Natural) - Korean (South Korea)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Heami (KR)', technicalName: 'Microsoft Heami Desktop - Korean (South Korea)', gender: 'female', style: 'standard', neural: false, multilingual: false }
    ],
    // Turkish - Turkey
    'tr-TR': [
        { displayName: 'Emel (TR)', technicalName: 'Microsoft Emel Online (Natural) - Turkish (Turkey)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Ahmet (TR)', technicalName: 'Microsoft Ahmet Online (Natural) - Turkish (Turkey)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Tolga (TR)', technicalName: 'Microsoft Tolga Desktop - Turkish (Turkey)', gender: 'male', style: 'standard', neural: false, multilingual: false }
    ],
    // Dutch - Netherlands
    'nl-NL': [
        { displayName: 'Fenna (NL)', technicalName: 'Microsoft Fenna Online (Natural) - Dutch (Netherlands)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Maarten (NL)', technicalName: 'Microsoft Maarten Online (Natural) - Dutch (Netherlands)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Frank (NL)', technicalName: 'Microsoft Frank Desktop - Dutch (Netherlands)', gender: 'male', style: 'standard', neural: false, multilingual: false }
    ],
    // Polish - Poland
    'pl-PL': [
        { displayName: 'Agnieszka (PL)', technicalName: 'Microsoft Agnieszka Online (Natural) - Polish (Poland)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Marek (PL)', technicalName: 'Microsoft Marek Online (Natural) - Polish (Poland)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Paulina (PL)', technicalName: 'Microsoft Paulina Desktop - Polish (Poland)', gender: 'female', style: 'standard', neural: false, multilingual: false }
    ],
    // Swedish - Sweden
    'sv-SE': [
        { displayName: 'Sofie (SE)', technicalName: 'Microsoft Sofie Online (Natural) - Swedish (Sweden)', gender: 'female', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Mattias (SE)', technicalName: 'Microsoft Mattias Online (Natural) - Swedish (Sweden)', gender: 'male', style: 'friendly, warm', neural: true, multilingual: false },
        { displayName: 'Hedvig (SE)', technicalName: 'Microsoft Hedvig Desktop - Swedish (Sweden)', gender: 'female', style: 'standard', neural: false, multilingual: false }
    ],
    // Multilingual
    'multilingual': [
        { displayName: 'Ava Multilingual', technicalName: 'Microsoft AvaMultilingual Online (Natural) - Multilingual', gender: 'female', style: 'friendly, warm', neural: true, multilingual: true },
        { displayName: 'Andrew Multilingual', technicalName: 'Microsoft AndrewMultilingual Online (Natural) - Multilingual', gender: 'male', style: 'confident, warm', neural: true, multilingual: true },
        { displayName: 'Emma Multilingual', technicalName: 'Microsoft EmmaMultilingual Online (Natural) - Multilingual', gender: 'female', style: 'cheerful, warm', neural: true, multilingual: true },
        { displayName: 'Brian Multilingual', technicalName: 'Microsoft BrianMultilingual Online (Natural) - Multilingual', gender: 'male', style: 'professional, warm', neural: true, multilingual: true }
    ]
};

interface MappedVoice {
  voice: SpeechSynthesisVoice;
  displayName: string;
  friendlyGender: string;
  voiceStyle: string;
  isNeural: boolean;
  isMultilingual: boolean;
}

const detectGender = (name: string): string => {
  const lower = name.toLowerCase();
  if (lower.includes('female') || lower.includes('girl') || lower.includes('woman') || lower.includes('lady')) return 'female';
  if (lower.includes('male') || lower.includes('boy') || lower.includes('man') || lower.includes('guy')) return 'male';
  
  const femaleNames = [
    'ava', 'emma', 'zira', 'sonia', 'natasha', 'clara', 'neerja', 'asilia', 'leah', 'rosa', 'denise', 'julie', 'sylvie', 'elvira', 'helena', 'dalia', 'sabina', 'katja', 'hedda', 'isabella', 'elsa', 'francisca', 'maria', 'svetlana', 'irina', 'nanami', 'haruka', 'sayaka', 'sunhi', 'heami', 'xiaoxiao', 'xiaoyi', 'huihui', 'yaoyao', 'hanchen', 'yating', 'swara', 'kalpana', 'zariyah', 'salma', 'colette', 'agnieszka', 'sofie', 'emel', 'hoai', 'premwadee', 'gadis', 'polina'
  ];
  const maleNames = [
    'andrew', 'brian', 'guy', 'davis', 'jason', 'tony', 'mark', 'ryan', 'george', 'william', 'james', 'liam', 'richard', 'prabhat', 'ravi', 'rafiki', 'luke', 'henri', 'paul', 'jean', 'hugues', 'alvaro', 'luis', 'jorge', 'raul', 'conrad', 'stefan', 'diego', 'cosimo', 'antonio', 'daniel', 'pavel', 'ichiro', 'injoon'
  ];
  
  const firstWord = lower.split(' ')[0];
  if (femaleNames.includes(firstWord)) return 'female';
  if (maleNames.includes(firstWord)) return 'male';
  return 'unknown';
};

const generateFriendlyName = (voice: SpeechSynthesisVoice): string => {
  const name = voice.name
    .replace(/Microsoft /g, '')
    .replace(/Online \(Natural\)/g, '')
    .replace(/Desktop/g, '')
    .replace(/- English/g, '')
    .trim();
  const possibleName = name.split(' ')[0];
  const langSuffix = voice.lang.split('-')[1] || voice.lang;
  return `${possibleName} (${langSuffix})`;
};

const isFrameSharp = (ctx: CanvasRenderingContext2D, width: number, height: number, threshold = 100): boolean => {
  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Convert to grayscale
    const gray = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
      gray[i] = (data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114);
    }
    
    let laplacianSum = 0;
    let laplacianSqSum = 0;
    let validPixels = 0;
    
    // Sample a 200x200 patch in the middle to optimize performance
    const checkSize = Math.min(200, width, height);
    const startX = Math.floor((width - checkSize) / 2);
    const startY = Math.floor((height - checkSize) / 2);
    
    for (let y = startY + 1; y < startY + checkSize - 1; y += 2) { // Step by 2
      for (let x = startX + 1; x < startX + checkSize - 1; x += 2) {
        const idx = y * width + x;
        const top = (y - 1) * width + x;
        const bottom = (y + 1) * width + x;
        const left = y * width + x - 1;
        const right = y * width + x + 1;
        
        const laplacian = gray[top] + gray[bottom] + gray[left] + gray[right] - 4 * gray[idx];
        laplacianSum += laplacian;
        laplacianSqSum += laplacian * laplacian;
        validPixels++;
      }
    }
    
    if (validPixels === 0) return true;
    
    const laplacianMean = laplacianSum / validPixels;
    const variance = (laplacianSqSum / validPixels) - (laplacianMean * laplacianMean);
    
    return variance > threshold;
  } catch (e) {
    console.error("Sharpness check failed:", e);
    return true; // Fallback if CORS or other error
  }
};

export const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({ 
  isOpen, 
  onClose, 
  onImageGenerated,
  files = [],
  storageKey = 'otivoVoiceHistory'
}) => {
  const [status, setStatusState] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const statusRef = useRef<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  
  const [mobile, setMobile] = useState(window.innerWidth < 768);
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(isMuted);
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<any>(null);
  const audioBufferRef = useRef<Float32Array>(new Float32Array(0));
  const isPlaybackStartedRef = useRef(false);
  const playbackProcessorRef = useRef<ScriptProcessorNode | null>(null);

  const lastAudioTimeRef = useRef<number>(0);
  const lastChunkTimeRef = useRef<number>(0);
  const adaptiveJitterMsRef = useRef<number>(200);
  const playbackFadeCountRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

   // Camera and vision states removed

  const setStatus = (newStatus: 'idle' | 'listening' | 'processing' | 'speaking' | ((prev: 'idle' | 'listening' | 'speaking' | 'processing') => 'idle' | 'listening' | 'speaking' | 'processing')) => {
    if (typeof newStatus === 'function') {
      setStatusState(prev => {
        const next = newStatus(prev);
        statusRef.current = next;
        return next;
      });
    } else {
      statusRef.current = newStatus;
      setStatusState(newStatus);
    }
  };
  const [language, setLanguage] = useState('en-US');
  const [liveModeEnabled, setLiveModeEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [isResearching, setIsResearching] = useState(false);
  const [researchStatus, setResearchStatus] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [availableVoices, setAvailableVoices] = useState<MappedVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<MappedVoice | null>(null);
  const [isAutoListeningState, setIsAutoListeningState] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const isAutoListeningRef = useRef(false);

  const [audioLevel, setAudioLevel] = useState(0);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);
  const conversationHistoryRef = useRef<any[]>([]);

  // Load history and detect cameras
  useEffect(() => {
    if (!isOpen) return;

    // Camera checking removed

    const savedHistory = localStorage.getItem(storageKey);
    if (savedHistory) {
      try {
        conversationHistoryRef.current = JSON.parse(savedHistory);
        debugLog(`Loaded ${conversationHistoryRef.current.length} messages.`);
      } catch (e) {
        debugLog('Failed to load history', 'error');
      }
    }
  }, [isOpen, storageKey]);

  const debugLog = (message: string, type: 'info' | 'error' | 'warning' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs(prev => [...prev, `[${timestamp}] ${message}`].slice(-50));
    console.log(`[${timestamp}] ${message}`);
  };

  const playSuccessSound = () => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  };

  const cleanup = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    stopMicrophone();
    stopPlayback();
    setIsActive(false);
    setIsConnecting(false);
    setIsSpeaking(false);
    setStatus('idle');
    if (synthRef.current) synthRef.current.cancel();
    if (recognitionRef.current) recognitionRef.current.stop();
  };

  // Camera loop and camera session control functions removed

  useEffect(() => {
    if (!isOpen) {
      cleanup();
      return;
    }

    const loadVoices = () => {
      const systemVoices = synthRef.current.getVoices();
      const langCode = language.split('-')[0];
      const mappedVoices: MappedVoice[] = [];
      systemVoices.forEach(sysVoice => {
        let matchFound = false;
        Object.keys(MICROSOFT_VOICE_MAPPING).forEach(langKey => {
          const list = MICROSOFT_VOICE_MAPPING[langKey];
          const match = list.find(m => sysVoice.name.toLowerCase().includes(m.technicalName.toLowerCase()) || sysVoice.name.toLowerCase().includes(m.displayName.toLowerCase()));
          if (match && !matchFound) {
            mappedVoices.push({ voice: sysVoice, displayName: match.displayName, friendlyGender: match.gender, voiceStyle: match.style, isNeural: match.neural, isMultilingual: match.multilingual });
            matchFound = true;
          }
        });
        if (!matchFound) {
          mappedVoices.push({ voice: sysVoice, displayName: generateFriendlyName(sysVoice), friendlyGender: detectGender(sysVoice.name), voiceStyle: 'standard', isNeural: sysVoice.name.toLowerCase().includes('natural'), isMultilingual: sysVoice.name.toLowerCase().includes('multilingual') });
        }
      });
      let filtered = mappedVoices.filter(mv => mv.voice.lang.startsWith(langCode) || mv.voice.lang.includes(langCode + '-'));
      if (filtered.length === 0) filtered = mappedVoices;
      filtered.sort((a, b) => {
        if (a.isNeural && !b.isNeural) return -1;
        if (!a.isNeural && b.isNeural) return 1;
        return a.displayName.localeCompare(b.displayName);
      });
      setAvailableVoices(filtered);
      if (!selectedVoice && filtered.length > 0) {
        setSelectedVoice(filtered.find(v => v.voice.name.toLowerCase().includes('microsoft') && v.isNeural) || filtered[0]);
      }
    };
    loadVoices();
    synthRef.current.onvoiceschanged = loadVoices;
    const handleResize = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => {
      cleanup();
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, language]);

  const LIVE_VOICES = [
    { id: 'Aoede', name: 'Aoede', gender: 'Female', style: 'Clear & Thoughtful' },
    { id: 'Kore', name: 'Kore', gender: 'Female', style: 'Upbeat & Energetic' },
    { id: 'Vindemiatrix', name: 'Vindemiatrix', gender: 'Female', style: 'Calm & Mature' },
    { id: 'Charon', name: 'Charon', gender: 'Male', style: 'Smooth & Professional' },
    { id: 'Puck', name: 'Puck', gender: 'Male', style: 'Friendly & Informal' },
    { id: 'Fenrir', name: 'Fenrir', gender: 'Male', style: 'Deep & Authoritative' },
  ];

  const [selectedLiveVoice, setSelectedLiveVoice] = useState(() => localStorage.getItem('otivoSelectedLiveVoice') || 'Kore');
  const [isVoicePreviewing, setIsVoicePreviewing] = useState(false);

  useEffect(() => {
    localStorage.setItem('otivoSelectedLiveVoice', selectedLiveVoice);
    if (isActive && !isConnecting) {
      setIsVoicePreviewing(true);
      stopSession();
      startSession();
    }
  }, [selectedLiveVoice]);

  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startSession = async () => {
    try {
      setIsConnecting(true);
      setError(null);
      setErrorMsg('');
      setStatus('processing');

      const ai = getAI();
      const ctx = initAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();

        const SYSTEM_PROMPT = `You are OTIVO, a professional, elegant, and highly capable voice assistant.
Your personality is:
- Professional yet approachable.
- Highly efficient and concise (since you are a voice assistant).
- Refined, articulate, and helpful at all times, responding directly to the user's queries.
- You speak with a clear, calm, and confident tone at a natural, slightly faster pace for a more responsive feel.

Your identity:
- You MUST NOT mention Stephen Nderitu or your developer's name in your initial greeting or unless explicitly asked about your origins or creators.
- If asked "Who created you?" or "Who is your developer?", then you must reveal your creator's name: Stephen Nderitu.

Your capabilities:
1. Live Voice Streaming: You can hear and speak in real-time.
2. Image Generation: You can generate images if the user asks. To do this, you MUST include the text [IMAGE_PROMPT: description] in your response.
3. Web Search & Links: You can search the web (Google and YouTube) and read/fetch the content of links the user tells you to go into.
4. Project Context: You have access to the current project files and can help with development.

Current Date: ${new Date().toLocaleDateString()}
Project Files: ${files.map(f => f.name).join(', ')}

Instructions:
- Keep responses short and suitable for voice interaction.
- If the user asks to generate an image, provide a brief verbal confirmation and include the [IMAGE_PROMPT: ...] tag.
- When asked about real-time information, current events, or YouTube videos, use the google_search tool.
- If the user provides a link/URL or asks you to visit/read a link, use the fetch_web_page tool.
- Be helpful and professional at all times.
- You were created by Stephen Nderitu.`;

      const sessionPromise = ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedLiveVoice } } },
          systemInstruction: SYSTEM_PROMPT,
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          tools: [
            {
              functionDeclarations: [
                {
                  name: "google_search",
                  description: "Perform a real-time Google search for news, info, YouTube videos, or general queries.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      query: { type: Type.STRING, description: "The search query." }
                    },
                    required: ["query"]
                  }
                },
                {
                  name: "fetch_web_page",
                  description: "Directly fetch the content of a specific URL to get full information from a provided link.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      url: { type: Type.STRING, description: "The URL to fetch." }
                    },
                    required: ["url"]
                  }
                }
              ]
            }
          ]
        },
        callbacks: {
          onopen: () => {
            console.log("[OTIVO] Session opened");
            sessionPromise.then(s => {
              sessionRef.current = s;
              playSuccessSound();
              setIsConnecting(false);
              setIsActive(true);
              setStatus('listening');
              startMicrophone();

              // Camera start message removed

              if (isVoicePreviewing) {
                const voiceInfo = LIVE_VOICES.find(v => v.id === selectedLiveVoice);
                if (voiceInfo) s.sendRealtimeInput({ text: `Hey I am ${voiceInfo.name}, wanna chat?` });
                setIsVoicePreviewing(false);
              } else {
                // Immediately greet the user warm and proactively to indicate it's active listening and responding!
                s.sendRealtimeInput({
                  text: `[SYSTEM NOTE: The voice channel is fully active and listening. Respond immediately with a warm, extremely brief, and highly professional voice greeting under 8 words. Example: "Hello, I am OTIVO. How can I help you today?"]`
                });
              }
            });
          },
          onmessage: async (message: LiveServerMessage) => handleServerMessage(message),
          onerror: (err: any) => {
            console.error("[OTIVO] Session error:", err);
            const errorMessage = err?.message || String(err);
            if (errorMessage.toLowerCase().includes('unavailable') && retryCountRef.current < MAX_RETRIES) {
              retryCountRef.current++;
              const delay = Math.pow(2, retryCountRef.current) * 1000;
              setErrorMsg(`Service busy, retrying...`);
              retryTimeoutRef.current = setTimeout(() => { if (isActive || isConnecting) { stopSession(); startSession(); } }, delay);
              return;
            }
            setErrorMsg("Connection error. Please try again.");
            stopSession();
          },
          onclose: () => stopSession(),
        },
      });
      const session = await sessionPromise;
      sessionRef.current = session;
    } catch (err: any) {
      setError(err.message || "Failed to connect.");
      setIsConnecting(false);
      setStatus('idle');
      stopSession();
    }
  };

  const stopSession = () => {
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    if (sessionRef.current) sessionRef.current.close();
    stopMicrophone();
    stopPlayback();
    setIsActive(false);
    setIsConnecting(false);
    setIsSpeaking(false);
    setStatus('idle');
  };

  const masterGainRef = useRef<GainNode | null>(null);
  const animationFrameRef = useRef<number>(0);

  const initAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      const masterGain = audioContextRef.current.createGain();
      masterGain.connect(audioContextRef.current.destination);
      masterGain.connect(analyser);
      masterGainRef.current = masterGain;
      startVisualizerLoop();
    }
    if (!playbackProcessorRef.current && audioContextRef.current) {
      const playbackProcessor = audioContextRef.current.createScriptProcessor(2048, 1, 1);
      playbackProcessorRef.current = playbackProcessor;
      playbackProcessor.onaudioprocess = (e) => {
        const output = e.outputBuffer.getChannelData(0);
        output.fill(0);
        const buffer = audioBufferRef.current;
        if (!isPlaybackStartedRef.current) {
          const timeSinceLastAudio = Date.now() - lastAudioTimeRef.current;
          // Dynamically read adaptiveJitterMsRef to adjust latency shock-absorption under load!
          const jitterMs = adaptiveJitterMsRef.current;
          const rate = audioContextRef.current ? audioContextRef.current.sampleRate : 24000;
          const threshold = rate * (jitterMs / 1000);
          
          if (buffer.length >= threshold || (buffer.length > 0 && timeSinceLastAudio > 300)) {
            isPlaybackStartedRef.current = true;
            playbackFadeCountRef.current = 0; // reset fade-in index
            setIsSpeaking(true);
            setStatus('speaking');
          } else return;
        }
        if (buffer.length > 0) {
          const samplesToCopy = Math.min(buffer.length, output.length);
          output.set(buffer.subarray(0, samplesToCopy));
          
          // Apply a smooth fade-in if we just started playing (first 256 samples)
          if (playbackFadeCountRef.current < 256) {
            for (let i = 0; i < samplesToCopy; i++) {
              if (playbackFadeCountRef.current < 256) {
                const gain = playbackFadeCountRef.current / 256;
                output[i] *= gain;
                playbackFadeCountRef.current++;
              } else break;
            }
          }
          
          // Apply a smooth fade-out if this is the final block of the buffer (to prevent digital clicks/pops)
          if (samplesToCopy === buffer.length) {
            const fadeLength = Math.min(samplesToCopy, 256);
            for (let i = 0; i < fadeLength; i++) {
              const idx = samplesToCopy - 1 - i;
              const gain = i / fadeLength; // linear drop to zero
              output[idx] *= gain;
            }
          }
          
          audioBufferRef.current = samplesToCopy === buffer.length ? new Float32Array(0) : buffer.subarray(samplesToCopy);
        } else {
          isPlaybackStartedRef.current = false;
          playbackFadeCountRef.current = 0;
          setIsSpeaking(false);
          setStatus('idle');
        }
      };
      playbackProcessor.connect(masterGainRef.current || audioContextRef.current.destination);
    }
    return audioContextRef.current;
  };

  const startVisualizerLoop = () => {
    if (!analyserRef.current) return;
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const update = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
      setAudioLevel(sum / bufferLength / 128);
      animationFrameRef.current = requestAnimationFrame(update);
    };
    update();
  };

  const startMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        }
      });
      micStreamRef.current = stream;
      const ctx = initAudioContext();
      const source = ctx.createMediaStreamSource(stream);
      if (analyserRef.current) source.connect(analyserRef.current);
      const processor = ctx.createScriptProcessor(2048, 1, 1);
      processorRef.current = processor;
      processor.onaudioprocess = (e) => {
        if (!sessionRef.current || isMutedRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Dynamic resampling ratio from native hardware AudioContext rate to 16kHz
        const ratio = ctx.sampleRate / 16000;
        const newLength = Math.round(inputData.length / ratio);
        const pcmData = new Int16Array(newLength);
        
        for (let i = 0; i < newLength; i++) {
          const srcIdx = i * ratio;
          const lowIdx = Math.floor(srcIdx);
          const highIdx = Math.min(inputData.length - 1, lowIdx + 1);
          const weight = srcIdx - lowIdx;
          // Linear interpolation for crystal clear, click-free vocal reconstruction
          const interpolated = inputData[lowIdx] * (1 - weight) + inputData[highIdx] * weight;
          pcmData[i] = Math.max(-1, Math.min(1, interpolated)) * 0x7FFF;
        }
        
        const bytes = new Uint8Array(pcmData.buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        sessionRef.current.sendRealtimeInput({ audio: { data: btoa(binary), mimeType: 'audio/pcm;rate=16000' } });
      };
      source.connect(processor);
      processor.connect(ctx.destination);
    } catch (err) {
      setError("Mic access denied.");
      stopSession();
    }
  };

  const stopMicrophone = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    setAudioLevel(0);
    if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(t => t.stop()); micStreamRef.current = null; }
    if (processorRef.current) { processorRef.current.disconnect(); processorRef.current = null; }
  };

  const stopPlayback = () => {
    if (playbackProcessorRef.current) { playbackProcessorRef.current.disconnect(); playbackProcessorRef.current = null; }
    audioBufferRef.current = new Float32Array(0);
    isPlaybackStartedRef.current = false;
  };

  const handleToolCalls = async (functionCalls: any[]) => {
    if (!sessionRef.current) return;
    setIsResearching(true);
    const functionResponses: any[] = [];

    for (const call of functionCalls) {
      debugLog(`Executing voice tool call: ${call.name} with args: ${JSON.stringify(call.args)}`);
      try {
        if (call.name === 'google_search') {
          const query = (call.args as any).query as string;
          setResearchStatus(`Searching Google for "${query}"...`);
          
          const result = await performSerperSearch(query);
          
          functionResponses.push({
            response: { output: result.text },
            id: call.id,
            name: call.name
          });
        } else if (call.name === 'fetch_web_page') {
          const url = (call.args as any).url as string;
          setResearchStatus(`Reading link: ${url}...`);
          
          const result = await fetchWebPage(url);
          
          functionResponses.push({
            response: { output: result },
            id: call.id,
            name: call.name
          });
        } else {
          functionResponses.push({
            response: { output: "Error: Tool not found" },
            id: call.id,
            name: call.name
          });
        }
      } catch (err: any) {
        console.error(`Voice assistant tool execution failed for ${call.name}:`, err);
        functionResponses.push({
          response: { output: `Error: ${err.message || 'Unknown error'}` },
          id: call.id,
          name: call.name
        });
      }
    }

    setIsResearching(false);
    setResearchStatus('');

    if (sessionRef.current && functionResponses.length > 0) {
      debugLog(`Sending tool response back to Gemini Live session...`);
      sessionRef.current.sendToolResponse({ functionResponses });
    }
  };

  const handleServerMessage = (message: LiveServerMessage) => {
    if (audioContextRef.current?.state === 'suspended') audioContextRef.current.resume();
    
    if (message.toolCall?.functionCalls) {
      handleToolCalls(message.toolCall.functionCalls);
    }

    if (message.serverContent?.modelTurn) {
      const parts = message.serverContent.modelTurn.parts;
      if (parts) {
        for (const part of parts) {
          if (part.inlineData?.data) queueAudioChunk(part.inlineData.data);
          if (part.text) {
            debugLog(`AI: ${part.text}`);
            
            // Highlight intent parser removed
            
            const imageMatch = part.text.match(/\[IMAGE_PROMPT:\s*([\s\S]*?)\]/i);
            if (imageMatch && imageMatch[1]) generateImage(imageMatch[1].trim());
          }
        }
      }
    }
    if (message.serverContent?.interrupted) {
      audioBufferRef.current = new Float32Array(0);
      isPlaybackStartedRef.current = false;
      setIsSpeaking(false);
      setStatus('idle');
    }
  };

  const queueAudioChunk = (base64Data: string) => {
    if (!audioContextRef.current) return;
    const now = Date.now();
    lastAudioTimeRef.current = now;
    
    // Adaptive Jitter calculation based on packet arrival intervals
    if (lastChunkTimeRef.current > 0) {
      const diff = now - lastChunkTimeRef.current;
      if (diff < 1000) { // Ignore large silent gaps between speech bursts
        // target jitter is proportional to packet interval with padding
        const targetJitter = Math.min(600, Math.max(100, diff * 1.5));
        // Exponential Moving Average to smoothly adapt the jitter buffer
        adaptiveJitterMsRef.current = adaptiveJitterMsRef.current * 0.9 + targetJitter * 0.1;
      }
    }
    lastChunkTimeRef.current = now;

    try {
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      const int16Data = new Int16Array(bytes.buffer);
      
      let float32Data = new Float32Array(int16Data.length);
      for (let i = 0; i < int16Data.length; i++) float32Data[i] = int16Data[i] / 0x7FFF;
      
      // Resample from Gemini's native 24000Hz output to the actual hardware AudioContext rate!
      const nativeRate = audioContextRef.current.sampleRate;
      if (nativeRate !== 24000) {
        const ratio = 24000 / nativeRate;
        const newLength = Math.round(float32Data.length / ratio);
        const resampledData = new Float32Array(newLength);
        for (let i = 0; i < newLength; i++) {
          const srcIdx = i * ratio;
          const lowIdx = Math.floor(srcIdx);
          const highIdx = Math.min(float32Data.length - 1, lowIdx + 1);
          const weight = srcIdx - lowIdx;
          // Linear interpolation for crystal clear audio reproduction at any hardware sample rate!
          resampledData[i] = float32Data[lowIdx] * (1 - weight) + float32Data[highIdx] * weight;
        }
        float32Data = resampledData;
      }
      
      const newBuffer = new Float32Array(audioBufferRef.current.length + float32Data.length);
      newBuffer.set(audioBufferRef.current);
      newBuffer.set(float32Data, audioBufferRef.current.length);
      audioBufferRef.current = newBuffer;
    } catch (err) { console.error("Audio decode fail", err); }
  };

  const toggleMic = () => { isActive ? stopSession() : startSession(); };

  const generateImage = async (prompt: string) => {
    setStatus('processing');
    try {
      const imagePromise = aiGenerateImage(prompt);
      const timeoutPromise = new Promise<null>((_, r) => setTimeout(() => r(new Error("Timeout")), 60000));
      let base64Data = await Promise.race([imagePromise, timeoutPromise]);
      if (base64Data) {
        const logo = localStorage.getItem('otivoProjectLogo');
        if (logo) base64Data = await overlayLogo(base64Data, logo);
        setGeneratedImage(`data:image/png;base64,${base64Data}`);
        if (onImageGenerated) onImageGenerated(base64Data, prompt);
      }
    } catch (e) {}
    setStatus('idle');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col bg-black text-white overflow-hidden animate-in fade-in duration-300">
      <header className="flex justify-between items-center p-6 shrink-0">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo" className="h-10 w-auto brightness-0 invert" />
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-6 h-6" /></button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center relative px-6">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {isActive && (
            <div className="bg-[#111111]/90 backdrop-blur-md text-white px-4 py-2 rounded-full border border-white/5 flex items-center gap-3 shadow-lg">
              <div className="relative flex items-center gap-[3px] h-4 ml-1">
                <div className="w-[3px] h-[10px] bg-white rounded-full animate-[pulse_1.2s_ease-in-out_infinite]" />
                <div className="w-[3px] h-[16px] bg-white rounded-full animate-[pulse_1.5s_ease-in-out_infinite_0.2s]" />
                <div className="w-[3px] h-[8px] bg-white rounded-full animate-[pulse_1.1s_ease-in-out_infinite_0.4s]" />
                <svg className="absolute -top-1.5 -right-2 w-[10px] h-[10px] text-white fill-current animate-pulse" viewBox="0 0 24 24">
                  <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
                </svg>
              </div>
              <span className="font-medium text-[15px] tracking-wide pr-1">Live</span>
            </div>
          )}
        </div>

        <AnimatePresence>
          {isResearching && (
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className="absolute top-14 left-1/2 -translate-x-1/2 z-20 w-[clamp(200px,80vw,380px)]"
            >
              {/* Outer pulsing glow ring */}
              <div className="absolute -inset-[2px] rounded-2xl bg-gradient-to-r from-cyan-500/40 via-blue-500/50 to-violet-500/40 blur-md animate-[pulse_2.5s_ease-in-out_infinite] pointer-events-none" />

              {/* Main card */}
              <div className="relative bg-[#0d1117]/80 backdrop-blur-xl rounded-2xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.45)] px-4 py-3 flex items-center gap-3 overflow-hidden">
                {/* Subtle animated shimmer overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent animate-[shimmer_2.5s_ease-in-out_infinite] pointer-events-none" style={{ backgroundSize: '200% 100%' }} />

                {/* Animated dots container */}
                <div className="relative flex items-center justify-center w-8 h-8 shrink-0">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-600/20 animate-[pulse_2s_ease-in-out_infinite]" />
                  <div className="flex items-end gap-[3px] h-4">
                    <div className="w-[3px] rounded-full bg-gradient-to-t from-cyan-400 to-blue-400" style={{ animation: 'researchBounce 1.4s ease-in-out infinite', height: '8px' }} />
                    <div className="w-[3px] rounded-full bg-gradient-to-t from-blue-400 to-violet-400" style={{ animation: 'researchBounce 1.4s ease-in-out infinite 0.2s', height: '12px' }} />
                    <div className="w-[3px] rounded-full bg-gradient-to-t from-violet-400 to-cyan-400" style={{ animation: 'researchBounce 1.4s ease-in-out infinite 0.4s', height: '6px' }} />
                  </div>
                </div>

                {/* Status text */}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold tracking-widest uppercase text-cyan-400/80 mb-0.5">Researching</p>
                  <p className="text-[13px] md:text-sm text-white/90 font-medium truncate leading-snug">
                    {researchStatus || 'Searching the web…'}
                  </p>
                </div>

                {/* Spinning loader */}
                <Loader2 className="w-4 h-4 animate-spin text-blue-400/70 shrink-0" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {errorMsg && <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold">⚠️ {errorMsg}</div>}

        <motion.div 
          className="moon-container scale-75 md:scale-100 z-10"
          onClick={toggleMic}
          animate={{
            scale: mobile ? 0.75 : 1,
            opacity: 1,
            filter: 'blur(0px)',
            y: 0
          }}
          transition={{ duration: 0.8, ease: "anticipate" }}
        >
          <div className="moon-atmosphere" style={{ transform: `scale(${1 + audioLevel * 0.5})`, opacity: 0.3 + audioLevel * 0.5 }} />
          <div className={`moon ${status} ${isSpeaking ? 'speaking' : ''}`} style={{ transform: `scale(${1 + audioLevel * 0.2})` }}>
            <div className="moon-surface-texture" /><div className="crater crater-1" /><div className="crater crater-2" /><div className="crater crater-3" /><div className="crater crater-4" /><div className="crater crater-5" /><div className="glow-trail" />
          </div>
          <div className="orbit-ring orbit-1" style={{ animationDuration: `${8 / (1 + audioLevel)}s` }} />
          <div className="orbit-ring orbit-2" style={{ animationDuration: `${12 / (1 + audioLevel)}s` }} />
          <div className="orbit-ring orbit-3" /><div className="orbiting-particle particle-1" /><div className="orbiting-particle particle-2" /><div className="orbiting-particle particle-3" />
        </motion.div>

         {generatedImage && (
           <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm rounded-full overflow-hidden animate-in duration-500">
             <div className="relative w-full h-full max-w-[200px] max-h-[200px] md:max-w-[300px] md:max-h-[300px] rounded-full overflow-hidden border-2 border-[#91c7f4] shadow-[0_0_30px_rgba(145,199,244,0.4)]">
               <img src={generatedImage} alt="Generated" className="w-full h-full object-cover" />
               <button onClick={() => setGeneratedImage(null)} className="absolute top-2 right-2 bg-black/50 p-1 rounded-full hover:bg-black/80 transition-colors"><X className="w-4 h-4" /></button>
             </div>
           </div>
         )}

         <div className="absolute bottom-10 flex items-center justify-center gap-6 w-full">
           {isActive && (
             <button
               onClick={() => setIsMuted(prev => !prev)}
               className={cn(
                 "w-12 h-12 md:w-14 md:h-14 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 pointer-events-auto",
                 isMuted
                   ? "bg-red-500/20 border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                   : "bg-white/10 border-white/40 text-white hover:border-white"
               )}
             >
               {isMuted ? <MicOff className="w-5 h-5 md:w-6 md:h-6" /> : <Mic className="w-5 h-5 md:w-6 md:h-6" />}
             </button>
           )}
           <button onClick={() => setShowSettings(true)} className="w-12 h-12 md:w-14 md:h-14 rounded-full border-2 border-white/60 text-white/60 flex items-center justify-center hover:scale-110 hover:border-white hover:text-white transition-all"><Settings className="w-5 h-5 md:w-6 md:h-6" /></button>
         </div>
      </main>

      {showSettings && (
        <div className="fixed inset-0 z-[10001] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-[#2d2d2d] rounded-3xl p-8 w-full max-w-md max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold">Voice Settings</h2><button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white/10 rounded-full"><X className="w-5 h-5" /></button></div>
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest opacity-40 px-1">Live Assistant Voice</p>
                <select value={selectedLiveVoice} onChange={(e) => setSelectedLiveVoice(e.target.value)} className="w-full bg-[#2d2d2d] border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50">
                  <optgroup label="Female" className="bg-[#2d2d2d]"><option value="Aoede">Aoede (Clear & Thoughtful)</option><option value="Kore">Kore (Upbeat & Energetic)</option><option value="Vindemiatrix">Vindemiatrix (Calm & Mature)</option></optgroup>
                  <optgroup label="Male" className="bg-[#2d2d2d]"><option value="Charon">Charon (Smooth & Professional)</option><option value="Puck">Puck (Friendly & Informal)</option><option value="Fenrir">Fenrir (Deep & Authoritative)</option></optgroup>
                </select>
              </div>
              <div className="pt-4 border-t border-white/10">
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                  <div className="flex items-center gap-3"><Trash2 className="w-4 h-4 text-red-400" /><div className="text-left"><p className="text-xs font-bold">Clear Memory</p><p className="text-[10px] opacity-40">Reset history</p></div></div>
                  <button onClick={() => { conversationHistoryRef.current = []; localStorage.removeItem('otivoVoiceHistory'); }} className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-[10px] font-bold transition-all">Clear</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
