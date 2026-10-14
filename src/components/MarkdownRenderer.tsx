import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion } from 'motion/react';
import { Code, Copy, Check, Download, Play, Table as TableIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { DocumentCard } from './DocumentCard';
import { MermaidRenderer } from './MermaidRenderer';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  onCopy?: (text: string, isCode: boolean) => void;
  onRun?: (code: string, language: string) => void;
  onOpenDocument?: (doc: any) => void;
  pdfMode?: boolean;
}

export const useMarkdownComponents = (
  handleCopy: (text: string, isCode: boolean) => void, 
  copiedText: string | null, 
  isTyping?: boolean,
  onRun?: (code: string, language: string) => void,
  onOpenDocument?: (doc: any) => void,
  pdfMode: boolean = false
) => {
  return React.useMemo(() => ({
    a: ({ node, ...props }: any) => <a target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline inline-flex items-center gap-1" {...props} />,
    pre: ({ node, children, ...props }: any) => <>{children}</>,
    code({ node, className, children, ...props }: any) {
      const match = /language-([\w-]+)/.exec(className || '');
      const language = match ? match[1] : 'typescript';
      const codeString = String(children).replace(/\n$/, '');
      
      // Handle Document Artifacts
      if (match && language.startsWith('document-')) {
        const parts = language.split('-');
        const format = (parts[1] || 'pdf') as 'md' | 'pdf';
        const title = parts.slice(2).join('-') || 'Untitled Document';
        
        const docInfo = {
          id: Math.random().toString(36).substring(7),
          title,
          content: codeString,
          type: format,
          timestamp: new Date()
        };

        return (
          <div className="my-6">
            <DocumentCard doc={docInfo as any} onOpen={(d) => onOpenDocument?.(d)} />
          </div>
        );
      }



      // Handle Mermaid Diagrams
      if (match && language === 'mermaid') {
        return <MermaidRenderer chart={codeString} />;
      }

      if (match) {
        return (
          <div className="relative group/code my-6 bg-[#0a0a0a] border border-white/10 rounded-xl flex flex-col shadow-2xl">
            {/* 1. THE STICKY HEADER */}
            <div className="sticky top-0 z-30 px-4 py-3 bg-[#161618] border-b border-white/10 flex items-center justify-between rounded-t-xl backdrop-blur-md">
              <div className="flex items-center gap-2">
                <div className="hidden md:flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
                </div>
                <span className="text-[11px] font-mono text-white/40 uppercase tracking-widest md:ml-3 font-bold whitespace-nowrap">{language}</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  onClick={() => handleCopy(codeString, true)}
                  className="p-1.5 hover:bg-white/5 rounded-md transition-all text-white/40 hover:text-white flex items-center gap-1.5 group/copy"
                  title="Copy code"
                >
                  {copiedText === codeString ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-green-400" />
                      <span className="text-[10px] font-bold text-green-400 hidden sm:inline whitespace-nowrap">COPIED</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 group-hover/copy:scale-110 transition-transform" />
                      <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline whitespace-nowrap">Copy</span>
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => {
                    const blob = new Blob([codeString], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `code-${Date.now()}.${language === 'typescript' ? 'ts' : language === 'javascript' ? 'js' : language}`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="p-1.5 hover:bg-white/5 rounded-md transition-all text-white/40 hover:text-white flex items-center gap-1.5 group/dl"
                  title="Download code"
                >
                  <Download className="w-3.5 h-3.5 group-hover/dl:translate-y-0.5 transition-transform" />
                  <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline whitespace-nowrap">Download</span>
                </button>

                {language === 'html' && onRun && (
                  <button
                    onClick={() => onRun(codeString, language)}
                    className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 rounded-md transition-all text-blue-400 hover:text-blue-300 flex items-center gap-1.5 group/run"
                    title="Run code"
                  >
                    <Play className="w-3.5 h-3.5 fill-current group-hover/run:scale-110 transition-transform" />
                    <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline whitespace-nowrap">Run</span>
                  </button>
                )}
              </div>
            </div>

            {/* 2. THE SCROLLABLE CODE */}
            <div className="relative overflow-x-auto custom-scrollbar rounded-b-xl">
              <SyntaxHighlighter
                style={vscDarkPlus}
                language={language}
                PreTag="div"
                className="!m-0 !bg-transparent !p-6"
                codeTagProps={{ className: "text-sm leading-relaxed font-mono" }}
                wrapLines={true}
                wrapLongLines={false}
              >
                {codeString}
              </SyntaxHighlighter>
              
              {isTyping && (
                <div className="absolute inset-0 bg-blue-500/5 animate-pulse pointer-events-none" />
              )}
            </div>
          </div>
        );
      }
      return <code className={cn("px-1.5 py-0.5 rounded-md font-mono text-[0.85em]", pdfMode ? "bg-black/5 text-pink-600" : "bg-white/10 text-pink-400", className)} {...props}>{children}</code>;
    },
    img: ({ node, ...props }: any) => (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="my-8 relative group cursor-zoom-in"
      >
        <img 
          className="rounded-2xl shadow-2xl border border-white/10 w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]" 
          {...props} 
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10 group-hover:ring-white/20 transition-all" />
      </motion.div>
    ),
    blockquote: ({children}: any) => (
      <blockquote className={cn("my-6 pl-6 border-l-4 italic pr-4 rounded-r-xl py-4", pdfMode ? "border-blue-600/50 text-neutral-700 bg-black/5" : "border-blue-500/50 text-white/70 bg-white/5")}>
        {children}
      </blockquote>
    ),
    strong: ({children}: any) => <strong className={cn("font-semibold", pdfMode ? "text-black" : "text-white")}>{children}</strong>,
    p: ({children}: any) => <p className={cn("text-[1rem] leading-[1.6] mb-[1.25rem] last:mb-0 text-left", pdfMode ? "text-neutral-800" : "text-[#e0e0e0]")}>{children}</p>,
    ul: ({children}: any) => <ul className={cn("list-disc pl-5 mb-[1.5rem] space-y-[1rem] text-left", pdfMode ? "text-neutral-800" : "text-[#e0e0e0]")}>{children}</ul>,
    ol: ({children}: any) => <ol className={cn("list-decimal pl-5 mb-[1.5rem] space-y-[1rem] text-left", pdfMode ? "text-neutral-800" : "text-[#e0e0e0]")}>{children}</ol>,
    li: ({children}: any) => <li className={cn("text-[1rem] leading-[1.6] mb-2", pdfMode ? "text-neutral-800" : "text-[#e0e0e0]")}>{children}</li>,
    h1: ({children}: any) => <h1 className={cn("text-2xl font-bold mb-4 uppercase tracking-tight text-left", pdfMode ? "text-black" : "text-white")}>{children}</h1>,
    h2: ({children}: any) => <h2 className={cn("text-[1.25rem] font-bold mt-[1.75rem] mb-[0.75rem] leading-[1.4] text-left", pdfMode ? "text-black" : "text-white")}>{children}</h2>,
    h3: ({children}: any) => <h3 className={cn("text-[1.25rem] font-bold mt-[1.75rem] mb-[0.75rem] leading-[1.4] text-left", pdfMode ? "text-black" : "text-white")}>{children}</h3>,
    table: ({ children }: any) => (
      <div className={cn("my-8 overflow-x-auto custom-scrollbar rounded-2xl border shadow-2xl", pdfMode ? "border-black/10 bg-black/[0.01]" : "border-white/10 bg-white/[0.02]")}>
        <table className="w-full border-collapse text-left text-sm">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }: any) => <thead className={cn("border-b", pdfMode ? "bg-black/5 border-black/10" : "bg-white/5 border-white/10")}>{children}</thead>,
    th: ({ children }: any) => <th className={cn("px-6 py-4 font-bold uppercase tracking-widest text-[10px]", pdfMode ? "text-black/60" : "text-white/40")}>{children}</th>,
    td: ({ children }: any) => <td className={cn("px-6 py-4 border-b last:border-0 leading-relaxed", pdfMode ? "text-neutral-800 border-black/5" : "text-white/80 border-white/5")}>{children}</td>,
    tr: ({ children }: any) => <tr className={cn("transition-colors", pdfMode ? "hover:bg-black/[0.01]" : "hover:bg-white/[0.02]")}>{children}</tr>,
  }), [handleCopy, copiedText, isTyping, onRun, onOpenDocument, pdfMode]);
};

export const MarkdownRenderer = React.memo<MarkdownRendererProps>(({ 
  content, 
  className,
  onCopy,
  onRun,
  onOpenDocument,
  pdfMode = false
}) => {
  const [copiedText, setCopiedText] = React.useState<string | null>(null);

  const handleCopy = React.useCallback((text: string, isCode: boolean) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    if (onCopy) onCopy(text, isCode);
    setTimeout(() => setCopiedText(null), 2000);
  }, [onCopy]);

  const components = useMarkdownComponents(handleCopy, copiedText, false, onRun, onOpenDocument, pdfMode);

  // Filter out internal protocol tags before rendering
  const filteredContent = React.useMemo(() => {
    if (!content) return '';
    if (typeof content !== 'string') return String(content);
    return content
      .replace(/\[TEXT:\s*([\s\S]*?)\]/gi, '$1')
      .replace(/\[IMAGE_PROMPT:\s*[\s\S]*?\]/gi, '')
      .replace(/\[DOCUMENT_START:\s*([^|\]]+)(?:\|([^\]]+))?\]([\s\S]*?)(?:\[DOCUMENT_END\]|$)/gi, (match, title, format, docContent) => {
        return `\n\`\`\`document-${format || 'pdf'}-${title}\n${docContent.trim()}\n\`\`\`\n`;
      })
      .trim();
  }, [content]);

  if (!filteredContent) return null;

  return (
    <div className={cn("markdown-body w-full", className)}>
      <ReactMarkdown components={components as any}>
        {filteredContent}
      </ReactMarkdown>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.content === nextProps.content &&
    prevProps.className === nextProps.className &&
    prevProps.pdfMode === nextProps.pdfMode
  );
});
