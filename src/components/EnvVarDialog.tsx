import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Key, ArrowRight, X, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface EnvVarDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  varName: string;
}

export const EnvVarDialog: React.FC<EnvVarDialogProps> = ({ isOpen, onClose, onConfirm, varName }) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) {
      setError('Please enter a value');
      return;
    }
    onConfirm(value.trim());
    setValue('');
    setError('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-full max-w-md bg-[#151619] border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-blue-400" />
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 hover:bg-white/5 rounded-full text-white/20 hover:text-white transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Enter your environment variable to continue
                </h2>
                <p className="text-sm text-white/40 leading-relaxed">
                  To continue, please provide the required environment variable. This will be stored locally in your browser.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-white/40 ml-1">
                    {varName}
                  </label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-blue-400 transition-colors">
                      <Key className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      value={value}
                      onChange={(e) => {
                        setValue(e.target.value);
                        if (error) setError('');
                      }}
                      placeholder="Enter value..."
                      className={cn(
                        "w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-blue-500/50 transition-all",
                        error && "border-red-500/50 focus:border-red-500/50"
                      )}
                      autoFocus
                    />
                  </div>
                  {error && (
                    <div className="flex items-center gap-2 text-red-400 text-[10px] font-mono mt-1 ml-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>{error}</span>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full bg-white text-black hover:bg-white/90 py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 group"
                >
                  Continue
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </form>
            </div>

            <div className="px-8 py-4 bg-white/[0.02] border-t border-white/5 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-[10px] font-mono text-white/20 uppercase tracking-widest">
                Secure Local Storage
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
