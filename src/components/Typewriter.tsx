import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { useMarkdownComponents } from './MarkdownRenderer';
import { cn } from '../lib/utils';

interface TypewriterProps {
  text?: string;
  onComplete?: () => void;
  speed?: number;
  onRun?: (code: string, language: string) => void;
}

export const Typewriter: React.FC<TypewriterProps> = ({ 
  text = '', 
  onComplete, 
  speed = 1,
  onRun
}) => {
  const [displayedText, setDisplayedText] = React.useState('');
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [copiedText, setCopiedText] = React.useState<string | null>(null);

  // Reset if text changes
  React.useEffect(() => {
    setDisplayedText('');
    setCurrentIndex(0);
  }, [text]);

  // Speed and chunking strategy to prevent hanging while maintaining high perceived speed
  React.useEffect(() => {
    if (text && currentIndex < text.length) {
      // Use a slightly larger delay (30ms instead of 1ms) to let React render,
      // but use larger chunks to keep it fast. This prevents "hanging".
      const timeout = setTimeout(() => {
        // Ultra high speed but stable chunk sizes for large code generations
        const remaining = text.length - currentIndex;
        const chunkSize = remaining > 10000 ? 1000 : remaining > 5000 ? 500 : remaining > 2000 ? 200 : remaining > 1000 ? 100 : 50;
        
        const nextIndex = Math.min(currentIndex + chunkSize, text.length);
        setDisplayedText(text.substring(0, nextIndex));
        setCurrentIndex(nextIndex);
      }, 15);

      return () => clearTimeout(timeout);
    } else if (text && currentIndex >= text.length && onComplete) {
      onComplete();
    }
  }, [currentIndex, text, onComplete]);

  const handleCopy = React.useCallback((text: string, isCode: boolean) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  }, []);

  const components = useMarkdownComponents(handleCopy, copiedText, currentIndex < text.length, onRun);

  return (
    <div className="w-full typewriter-container">
      <ReactMarkdown components={components as any}>
        {displayedText}
      </ReactMarkdown>
      {currentIndex < text.length && (
        <span className="inline-block w-2 h-5 bg-blue-500 ml-1 animate-pulse align-middle" />
      )}
    </div>
  );
};
