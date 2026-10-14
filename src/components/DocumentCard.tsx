import React from 'react';
import { motion } from 'motion/react';
import { FileText, Download, Eye } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { DocumentInfo } from '../types';

interface DocumentCardProps {
  doc: DocumentInfo;
  onOpen: (doc: DocumentInfo) => void;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({ doc, onOpen }) => {
  const downloadDocument = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (doc.type === 'pdf') {
      const pdf = new jsPDF();
      const lines = pdf.splitTextToSize(doc.content, 180);
      pdf.text(lines, 10, 10);
      pdf.save(`${doc.title}.pdf`);
    } else {
      const blob = new Blob([doc.content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.title}.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => onOpen(doc)}
      className="group mt-4 flex items-center gap-4 p-4 bg-white/[0.03] border border-white/10 rounded-2xl cursor-pointer hover:bg-white/[0.05] hover:border-blue-500/30 transition-all shadow-lg"
    >
      <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 transition-transform group-hover:scale-105 group-hover:bg-blue-500/20">
        <FileText className="w-6 h-6 text-blue-400" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-white truncate">{doc.title}</h4>
        <p className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5 font-bold">
          {doc.type === 'pdf' ? 'Professional PDF' : 'Markdown Draft'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button 
          onClick={downloadDocument}
          className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-blue-500 hover:text-white rounded-lg text-[10px] font-bold text-white/60 transition-all border border-white/10 hover:border-blue-500 group/btn"
          title="Download"
        >
          <Download className="w-3 h-3 group-hover/btn:translate-y-0.5 transition-transform" />
          <span>Save</span>
        </button>
        <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
          <Eye className="w-4 h-4" />
        </div>
      </div>
    </motion.div>
  );
};
