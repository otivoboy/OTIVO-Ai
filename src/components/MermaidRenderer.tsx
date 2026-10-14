import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

interface MermaidRendererProps {
  chart: string;
}

// Configure mermaid
mermaid.initialize({
  startOnLoad: true,
  theme: 'dark',
  themeVariables: {
    primaryColor: '#3b82f6',
    primaryTextColor: '#fff',
    primaryBorderColor: '#3b82f6',
    lineColor: '#ffffff20',
    secondaryColor: '#10b981',
    tertiaryColor: '#f59e0b',
    mainBkg: '#0d0d0f',
    nodeBorder: '#ffffff20',
    clusterBkg: '#ffffff05',
    titleColor: '#fff',
    edgeLabelBackground: '#0d0d0f',
  },
  securityLevel: 'loose',
  fontFamily: 'Inter, system-ui, sans-serif',
});

export const MermaidRenderer: React.FC<MermaidRendererProps> = ({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const renderChart = async () => {
      if (containerRef.current) {
        // Clear previous content
        containerRef.current.innerHTML = '';
        
        const id = `mermaid-${Math.random().toString(36).substring(7)}`;
        try {
          const { svg } = await mermaid.render(id, chart);
          if (containerRef.current) {
            containerRef.current.innerHTML = svg;
          }
        } catch (error) {
          console.error('Mermaid rendering failed:', error);
          if (containerRef.current) {
            containerRef.current.innerHTML = '<pre class="text-red-400 p-4">Failed to render diagram. Please check syntax.</pre>';
          }
        }
      }
    };

    renderChart();
  }, [chart]);

  return (
    <div className="my-8 flex justify-center bg-white/[0.02] border border-white/5 rounded-[40px] p-10 overflow-x-auto custom-scrollbar shadow-inner">
      <div ref={containerRef} className="mermaid-container" />
    </div>
  );
};
