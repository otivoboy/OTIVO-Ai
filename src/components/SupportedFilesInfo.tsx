import React from 'react';
import { FileText, Database, Image as ImageIcon, Code, Box, AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SupportedFilesInfoProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupportedFilesInfo: React.FC<SupportedFilesInfoProps> = ({ isOpen, onClose }) => {
  const categories = [
    {
      title: "Documents",
      icon: <FileText className="w-5 h-5 text-blue-400" />,
      description: "Used for reading, summarizing, or extracting text.",
      extensions: ".pdf, .doc, .docx, .txt, .md, .rtf",
      examples: "Summarize a report 📑, Extract info, Review contracts"
    },
    {
      title: "Data Files",
      icon: <Database className="w-5 h-5 text-blue-400" />,
      description: "Used for analysis, charts, or calculations.",
      extensions: ".csv, .xls, .xlsx, .json, .xml",
      examples: "Data analysis 📈, Financial datasets, Logs"
    },
    {
      title: "Images",
      icon: <ImageIcon className="w-5 h-5 text-purple-400" />,
      description: "Used for visual understanding or editing.",
      extensions: ".png, .jpg, .jpeg, .webp, .gif",
      examples: "Analyze charts, Read text (OCR), Generate descriptions"
    },
    {
      title: "Code Files",
      icon: <Code className="w-5 h-5 text-amber-400" />,
      description: "Used for debugging or reviewing code.",
      extensions: ".py, .js, .html, .css, .ts, .cpp, .java",
      examples: "Fix bugs 🐞, Improve performance, Explain code"
    },
    {
      title: "Other Common Files",
      icon: <Box className="w-5 h-5 text-gray-400" />,
      description: "Sometimes supported depending on the platform.",
      extensions: ".zip, .ppt, .pptx, .log, .yaml, .yml",
      examples: "Presentations, Archives, Config files"
    }
  ];

  const blocked = {
    title: "Usually NOT Allowed",
    icon: <AlertCircle className="w-5 h-5 text-red-500" />,
    description: "These are blocked for security reasons 🔒.",
    extensions: ".exe, .bat, .apk, .iso"
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="absolute bottom-full left-0 mb-4 w-[320px] md:w-[400px] bg-[#1c1c1c] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50"
        >
          <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
            <div className="flex items-center gap-2">
              <Box className="w-4 h-4 text-white/60" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Supported Files</h3>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
              <X className="w-4 h-4 text-white/40" />
            </button>
          </div>

          <div className="p-4 max-h-[400px] overflow-y-auto custom-scrollbar space-y-6">
            {categories.map((cat, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center gap-2">
                  {cat.icon}
                  <h4 className="text-xs font-bold text-white uppercase tracking-widest">{cat.title}</h4>
                </div>
                <p className="text-[11px] text-white/60 leading-relaxed">{cat.description}</p>
                <div className="bg-white/5 rounded-lg p-2 space-y-1">
                  <p className="text-[10px] font-mono text-blue-400/80">{cat.extensions}</p>
                  <p className="text-[10px] text-white/40 italic">Example: {cat.examples}</p>
                </div>
              </div>
            ))}

            <div className="pt-4 border-t border-white/5 space-y-2">
              <div className="flex items-center gap-2">
                {blocked.icon}
                <h4 className="text-xs font-bold text-red-500 uppercase tracking-widest">{blocked.title}</h4>
              </div>
              <p className="text-[11px] text-white/60 leading-relaxed">{blocked.description}</p>
              <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-2">
                <p className="text-[10px] font-mono text-red-400/80">{blocked.extensions}</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
