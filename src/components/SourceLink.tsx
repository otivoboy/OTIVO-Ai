import React from 'react';
import { cn } from '../lib/utils';
import { ExternalLink, Globe } from 'lucide-react';

interface SourceLinkProps {
  url: string;
  title?: string;
  className?: string;
}

export const SourceLink: React.FC<SourceLinkProps> = ({ url, title, className }) => {
  const [hasError, setHasError] = React.useState(false);
  
  const domain = React.useMemo(() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }, [url]);

  const iconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs text-blue-400 hover:text-blue-300 hover:bg-white/10 transition-all group shrink-0",
        className
      )}
    >
      <div className="w-4 h-4 rounded bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
        {!hasError ? (
          <img
            src={iconUrl}
            alt={domain}
            className="w-full h-full object-contain"
            onError={() => setHasError(true)}
            referrerPolicy="no-referrer"
          />
        ) : (
          <Globe className="w-3 h-3 text-white/40" />
        )}
      </div>
      <span className="max-w-[150px] truncate font-medium">{title || domain}</span>
      <ExternalLink className="w-3 h-3 text-white/20 group-hover:text-blue-400 transition-colors shrink-0" />
    </a>
  );
};

export const SourceSkeleton = () => (
  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full animate-pulse">
    <div className="w-4 h-4 rounded bg-white/10" />
    <div className="w-20 h-3 rounded bg-white/10" />
  </div>
);
