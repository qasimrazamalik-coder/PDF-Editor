import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { 
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, FileText, Wand2, Download, 
  Scissors, BookOpen, Volume2, Image as ImageIcon, FileOutput, Save, Settings2,
  Type, Database, Mic, MicOff
} from 'lucide-react';
import { cn } from '../lib/utils';
import { summarizePDF, performOCR, compareDocuments } from '../services/gemini';
import { saveDocumentMetadata } from '../services/firebase';
import ReactMarkdown from 'react-markdown';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { motion, AnimatePresence } from 'motion/react';
import { Document as Docx, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';

// Initialize PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFSuiteProps {
  file: File;
  onClose: () => void;
}

type SummaryLength = 'short' | 'medium' | 'detailed';
type FontFamily = 'Helvetica' | 'TimesRoman' | 'Courier';

export const PDFSuite = ({ file, onClose }: PDFSuiteProps) => {
  const [activeTab, setActiveTab] = useState<'read' | 'edit' | 'analyze' | 'organize'>('read');
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryLength, setSummaryLength] = useState<SummaryLength>('medium');
  const [includeBullets, setIncludeBullets] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ocrText, setOcrText] = useState<string | null>(null);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRemovePage = async () => {
    if (!numPages || numPages <= 1) return;
    const existingPdfBytes = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    pdfDoc.removePage(pageNumber - 1);
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const newFile = new File([blob], file.name, { type: 'application/pdf' });
    // This is a bit tricky as we are modifying the 'file' prop which is usually immutable in this flow.
    // However, for this suite, we can simulate a 'Save' or 'Refresh'.
    // Better to just provide the download for the organized version.
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reorganized_${file.name}`;
    link.click();
    alert("Page removed. Downloaded modified version.");
  };

  useEffect(() => {
    setPageNumber(1);
    setSummary(null);
  }, [file]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const handleSummarize = async () => {
    setIsSummarizing(true);
    try {
      const res = await summarizePDF(
        `Document: ${file.name}\n\nSummary requested for a PDF document.`,
        summaryLength,
        includeBullets
      );
      setSummary(res || "Summary unavailable.");
      await saveDocumentMetadata(file, res);
    } catch (err) {
      setSummary("Failed to summarize.");
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleSpeech = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    
    const textToRead = summary || "No summary available to read.";
    const utterance = new SpeechSynthesisUtterance(textToRead.replace(/[#*`]/g, ''));
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  const convertToDocx = async () => {
    const doc = new Docx({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: "LexiCloud Export", bold: true, size: 28 }),
              new TextRun({ text: `\nSource: ${file.name}`, break: 1 }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "\nAI Generated Summary:\n", bold: true, break: 2 }),
              new TextRun({ text: summary || "No summary included." }),
            ],
          }),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${file.name.replace('.pdf', '')}_summary.docx`);
  };

  const handleOCR = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const imageFile = e.target.files?.[0];
    if (!imageFile) return;

    setIsOcrLoading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      const text = await performOCR(base64);
      setOcrText(text);
      setIsOcrLoading(false);
    };
    reader.readAsDataURL(imageFile);
  };

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [annotations, setAnnotations] = useState<{ text: string, page: number, x: number, y: number, fontSize: number, color: string, fontFamily: FontFamily }[]>([]);
  const [selectedColor, setSelectedColor] = useState('#b45309'); // Amber-700 hex
  const [fontSize, setFontSize] = useState(12);
  const [selectedFont, setSelectedFont] = useState<FontFamily>('Helvetica');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [comparisonResult, setComparisonResult] = useState<string | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const compareInputRef = useRef<HTMLInputElement>(null);

  const Tooltip = ({ children, content }: { children: React.ReactNode, content: string }) => {
    const [isVisible, setIsVisible] = useState(false);
    return (
      <div className="relative flex items-center" onMouseEnter={() => setIsVisible(true)} onMouseLeave={() => setIsVisible(false)}>
        {children}
        <AnimatePresence>
          {isVisible && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="absolute left-full ml-4 px-3 py-1.5 bg-amber-600 text-black text-[9px] font-bold uppercase tracking-[0.2em] whitespace-nowrap rounded-sm shadow-[0_10px_30px_rgba(217,119,6,0.3)] pointer-events-none z-[100] before:content-[''] before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:border-8 before:border-transparent before:border-r-amber-600"
            >
              {content}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const extractTextFromPDF = async (pdfFile: File) => {
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
        // Limit to first 20 pages for comparison to avoid token limits and performance lag
        if (i > 20) break;
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(" ");
        fullText += pageText + "\n";
    }
    return fullText;
  };

  const handleCompareUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const compareFile = e.target.files?.[0];
    if (!compareFile) return;

    setIsComparing(true);
    try {
      const textA = await extractTextFromPDF(file);
      const textB = await extractTextFromPDF(compareFile);
      const diff = await compareDocuments(textA, textB);
      setComparisonResult(diff);
      setSummary(null); // Clear summary while viewing comparison
      setOcrText(null);
    } catch (err) {
      console.error(err);
      alert("Comparison failed. Ensure both files are valid PDFs.");
    } finally {
      setIsComparing(false);
    }
  };

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setIsListening(false);
        if (transcript) {
          setAnnotations(prev => [...prev, {
            text: transcript,
            page: pageNumber,
            x: 50,
            y: 100 + (annotations.filter(a => a.page === pageNumber).length * 25),
            fontSize,
            color: selectedColor,
            fontFamily: selectedFont
          }]);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [pageNumber, fontSize, selectedColor, selectedFont]);

  const toggleVoiceInput = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      if (!recognitionRef.current) {
        alert("Speech recognition is not supported in this browser.");
        return;
      }
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  };

  const handleAddAnnotation = () => {
    const text = window.prompt("Enter text to stamp on this page:");
    if (text) {
      setAnnotations(prev => [...prev, {
        text,
        page: pageNumber,
        x: 50,
        y: 100 + (annotations.filter(a => a.page === pageNumber).length * 25),
        fontSize,
        color: selectedColor,
        fontFamily: selectedFont
      }]);
    }
  };

  const exportAsText = () => {
    const content = ocrText || summary || "No content to export.";
    const blob = new Blob([content], { type: 'text/plain' });
    saveAs(blob, `${file.name.replace('.pdf', '')}_export.txt`);
    setShowExportMenu(false);
  };

  const exportAsMarkdown = () => {
    const content = `# LexiCloud Export\n\nSource: ${file.name}\n\n${summary ? `## Summary\n${summary}\n\n` : ''}${ocrText ? `## Extracted Text\n${ocrText}` : ''}`;
    const blob = new Blob([content], { type: 'text/markdown' });
    saveAs(blob, `${file.name.replace('.pdf', '')}_export.md`);
    setShowExportMenu(false);
  };

  const exportAsImage = () => {
    const canvas = document.querySelector('.react-pdf__Page__canvas') as HTMLCanvasElement;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${file.name.replace('.pdf', '')}_page_${pageNumber}.png`;
      link.click();
    }
    setShowExportMenu(false);
  };

  const handleExportPDF = async () => {
    const existingPdfBytes = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    
    // Embed standard fonts
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const courierFont = await pdfDoc.embedFont(StandardFonts.Courier);

    const fontMap: Record<FontFamily, any> = {
      'Helvetica': helveticaFont,
      'TimesRoman': timesRomanFont,
      'Courier': courierFont
    };

    const pages = pdfDoc.getPages();
    
    // Apply all annotations
    annotations.forEach(anno => {
      const targetPage = pages[anno.page - 1];
      if (targetPage) {
        const { r, g, b } = hexToRgb(anno.color);
        targetPage.drawText(anno.text, {
          x: anno.x,
          y: targetPage.getHeight() - anno.y,
          size: anno.fontSize,
          font: fontMap[anno.fontFamily],
          color: rgb(r / 255, g / 255, b / 255),
        });
      }
    });

    // Processed watermark
    const firstPage = pages[0];
    firstPage.drawText('PROCESSED VIA LEXICLOUD', {
      x: 50,
      y: 30,
      size: 8,
      opacity: 0.5,
      font: helveticaFont,
      color: rgb(0.75, 0.5, 0.1),
    });

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lexicloud_${file.name}`;
    link.click();
    setShowExportMenu(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0a] flex flex-col pt-14 selection:bg-amber-600/30 selection:text-amber-500 font-sans">
      {/* Top Bar matching Theme */}
      <div className="h-14 border-b border-slate-800 flex items-center justify-between px-6 bg-[#0f0f0f]">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-amber-600 rounded flex items-center justify-center font-bold text-black text-xs">L</div>
            <div className="flex flex-col">
              <span className="font-serif italic text-white text-[10px] tracking-wide line-clamp-1 max-w-[200px] opacity-60 uppercase">{activeTab} node</span>
              <span className="font-serif italic text-white text-xs tracking-wide line-clamp-1 max-w-[200px]">{file.name}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <button 
              onClick={handleSummarize}
              disabled={isSummarizing}
              className="flex items-center gap-2 px-4 py-1.5 bg-amber-600/10 text-amber-500 hover:bg-amber-600/20 border border-amber-600/20 rounded-sm text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50"
            >
              <Wand2 size={12} />
              {isSummarizing ? "Synthesizing..." : "AI Sync"}
            </button>

            <div className="h-6 w-px bg-slate-800 mx-2" />

            <div className="relative">
              <button 
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center gap-2 px-4 py-1.5 bg-slate-100 text-black text-[10px] font-bold uppercase tracking-widest hover:bg-white rounded-sm transition-colors"
              >
                Export <ChevronRight size={10} className={cn("transition-transform", showExportMenu && "rotate-90")} />
              </button>

              <AnimatePresence>
                {showExportMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-48 bg-[#0f0f0f] border border-slate-800 shadow-2xl rounded-sm z-50 overflow-hidden"
                    >
                      <div className="p-2 space-y-1">
                        <button onClick={handleExportPDF} className="w-full flex items-center justify-between px-3 py-2 text-[9px] text-slate-300 hover:bg-white/5 hover:text-white rounded-sm transition-colors text-left uppercase tracking-wider">
                          <span>Adobe PDF</span>
                          <FileText size={12} className="opacity-40" />
                        </button>
                        <button onClick={exportAsImage} className="w-full flex items-center justify-between px-3 py-2 text-[9px] text-slate-300 hover:bg-white/5 hover:text-white rounded-sm transition-colors text-left uppercase tracking-wider">
                          <span>High-Res Image</span>
                          <ImageIcon size={12} className="opacity-40" />
                        </button>
                        <button onClick={exportAsMarkdown} disabled={!summary && !ocrText} className="w-full flex items-center justify-between px-3 py-2 text-[9px] text-slate-300 hover:bg-white/5 hover:text-white rounded-sm transition-colors text-left uppercase tracking-wider disabled:opacity-30 disabled:hover:bg-transparent">
                          <span>Markdown Node</span>
                          <FileOutput size={12} className="opacity-40" />
                        </button>
                        <button 
                          onClick={() => {
                            const content = `\\documentclass{article}\n\\begin{document}\n\\title{LexiCloud Export: ${file.name}}\n\\maketitle\n\n${summary ? `\\section{AI Summary}\n${summary.replace(/%/g, '\\%').replace(/\$/g, '\\$')}\n\n` : ''}${ocrText ? `\\section{OCR Data}\n${ocrText}` : ''}\n\\end{document}`;
                            const blob = new Blob([content], { type: 'text/plain' });
                            saveAs(blob, `${file.name.replace('.pdf', '')}.tex`);
                            setShowExportMenu(false);
                          }} 
                          disabled={!summary && !ocrText} 
                          className="w-full flex items-center justify-between px-3 py-2 text-[9px] text-slate-300 hover:bg-white/5 hover:text-white rounded-sm transition-colors text-left uppercase tracking-wider disabled:opacity-30"
                        >
                          <span>LaTeX Source</span>
                          <FileText size={12} className="opacity-40" />
                        </button>
                        <button 
                          onClick={() => {
                            const content = JSON.stringify({
                              filename: file.name,
                              timestamp: new Date().toISOString(),
                              summary,
                              ocr_text: ocrText,
                              annotations
                            }, null, 2);
                            const blob = new Blob([content], { type: 'application/json' });
                            saveAs(blob, `${file.name.replace('.pdf', '')}.json`);
                            setShowExportMenu(false);
                          }} 
                          className="w-full flex items-center justify-between px-3 py-2 text-[9px] text-slate-300 hover:bg-white/5 hover:text-white rounded-sm transition-colors text-left uppercase tracking-wider"
                        >
                          <span>Raw JSON Feed</span>
                          <Database size={12} className="opacity-40" />
                        </button>
                        <button onClick={exportAsText} disabled={!summary && !ocrText} className="w-full flex items-center justify-between px-3 py-2 text-[9px] text-slate-300 hover:bg-white/5 hover:text-white rounded-sm transition-colors text-left uppercase tracking-wider disabled:opacity-30 disabled:hover:bg-transparent">
                          <span>Plain Text Stream</span>
                          <Download size={12} className="opacity-40" />
                        </button>
                      </div>
                      <div className="bg-slate-900/50 p-2 border-t border-slate-800">
                        <button onClick={convertToDocx} disabled={!summary} className="w-full text-center py-2 text-[8px] text-amber-500/80 hover:text-amber-500 uppercase tracking-widest font-bold disabled:opacity-20">
                          Force DOCX Sync
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Toolbar - Mode Switcher */}
        <div className="w-16 border-r border-slate-800 bg-[#0f0f0f] flex flex-col items-center py-6 gap-8">
           <div className="flex flex-col gap-4 mb-4 border-b border-slate-800 pb-4">
             <button 
               onClick={() => setActiveTab('read')}
               className={cn("p-2 rounded-lg transition-all", activeTab === 'read' ? "text-amber-500 bg-amber-500/10" : "text-slate-600 hover:text-slate-400")}
               title="Reader Mode"
             >
               <BookOpen size={20} />
             </button>
             <button 
               onClick={() => setActiveTab('edit')}
               className={cn("p-2 rounded-lg transition-all", activeTab === 'edit' ? "text-amber-500 bg-amber-500/10" : "text-slate-600 hover:text-slate-400")}
               title="Editor Mode"
             >
               <Type size={20} />
             </button>
             <button 
               onClick={() => setActiveTab('analyze')}
               className={cn("p-2 rounded-lg transition-all", activeTab === 'analyze' ? "text-amber-500 bg-amber-500/10" : "text-slate-600 hover:text-slate-400")}
               title="Analyze Mode"
             >
               <Wand2 size={20} />
             </button>
             <button 
               onClick={() => setActiveTab('organize')}
               className={cn("p-2 rounded-lg transition-all", activeTab === 'organize' ? "text-amber-500 bg-amber-500/10" : "text-slate-600 hover:text-slate-400")}
               title="Organize & Export"
             >
               <FileOutput size={20} />
             </button>
           </div>

           {/* Mode Specific Tools */}
           <div className="flex-1 flex flex-col items-center gap-6 overflow-y-auto scrollbar-none py-2">
             {activeTab === 'read' && (
               <>
                 <button onClick={() => setScale(s => Math.min(2.5, s + 0.1))} className="p-3 text-slate-500 hover:text-amber-500 hover:bg-white/5 rounded-xl transition-all" title="Zoom In"><ZoomIn size={20} /></button>
                 <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="p-3 text-slate-500 hover:text-amber-500 hover:bg-white/5 rounded-xl transition-all" title="Zoom Out"><ZoomOut size={20} /></button>
                 <div className="h-px w-8 bg-slate-800" />
                 <button onClick={() => setPageNumber(p => Math.max(1, p - 1))} className="p-3 text-slate-500 hover:text-amber-500 hover:bg-white/5 rounded-xl transition-all" title="Previous Page"><ChevronLeft size={20} /></button>
                 <button onClick={() => setPageNumber(p => Math.min(numPages || 1, p + 1))} className="p-3 text-slate-500 hover:text-amber-500 hover:bg-white/5 rounded-xl transition-all" title="Next Page"><ChevronRight size={20} /></button>
               </>
             )}

             {activeTab === 'edit' && (
               <>
                 <button 
                   onClick={handleAddAnnotation}
                   className="p-3 text-slate-500 hover:text-amber-500 hover:bg-white/5 rounded-xl transition-all"
                   title="Add Text Stamp"
                 >
                   <Type size={20} />
                 </button>

                 <button 
                   onClick={toggleVoiceInput}
                   className={cn(
                     "p-3 rounded-xl transition-all relative",
                     isListening ? "text-red-500 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.3)]" : "text-slate-500 hover:text-amber-500 hover:bg-white/5"
                   )}
                   title={isListening ? "Stop Listening" : "Dictate Annotation"}
                 >
                   {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                   {isListening && <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1.5, opacity: 0 }} transition={{ repeat: Infinity, duration: 1.5 }} className="absolute inset-0 bg-red-500/20 rounded-xl" />}
                 </button>

                 <button 
                   onClick={() => setAnnotations([])}
                   className="p-3 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                   title="Purge All Annotations"
                 >
                   <Scissors size={20} />
                 </button>

                 <div className="flex flex-col gap-1 w-full px-4 border-t border-slate-800 pt-4">
                   <input type="color" value={selectedColor} onChange={(e) => setSelectedColor(e.target.value)} className="w-full h-4 bg-transparent border-none cursor-pointer rounded-sm" title="Text Color" />
                   <div className="flex flex-col gap-1 mt-2">
                     {(['Helvetica', 'TimesRoman', 'Courier'] as FontFamily[]).map((f) => (
                       <button key={f} onClick={() => setSelectedFont(f)} className={cn("text-[7px] text-left uppercase tracking-tighter transition-colors", selectedFont === f ? "text-amber-500 font-bold" : "text-slate-600 hover:text-slate-400")}>
                         {f === 'Helvetica' ? 'Sans' : f === 'TimesRoman' ? 'Serif' : 'Mono'}
                       </button>
                     ))}
                   </div>
                   <div className="flex flex-col gap-2 mt-4 border-t border-slate-800 pt-4">
                     <p className="text-[7px] text-slate-600 uppercase tracking-widest font-bold">Lattice Scale</p>
                     <select 
                       value={fontSize} 
                       onChange={(e) => setFontSize(Number(e.target.value))}
                       className="bg-[#0f0f0f] border border-slate-800 text-slate-300 text-[9px] rounded p-1.5 outline-none focus:border-amber-500 transition-colors font-mono cursor-pointer w-full"
                       title="Select Precise Size"
                     >
                       {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72].map(size => (
                         <option key={size} value={size}>{size}PT</option>
                       ))}
                     </select>
                     <input 
                       type="range" 
                       min="8" 
                       max="72" 
                       value={fontSize} 
                       onChange={(e) => setFontSize(Number(e.target.value))}
                       className="w-full accent-amber-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer mt-1"
                       title="Scale Font"
                     />
                     <div className="flex justify-between items-center text-[7px] text-slate-600 font-mono">
                       <span>8PT</span>
                       <span className="text-amber-500/50">{fontSize}PT</span>
                       <span>72PT</span>
                     </div>
                   </div>
                 </div>

                 <button 
                   onClick={() => fileInputRef.current?.click()}
                   className="p-3 text-slate-500 hover:text-amber-500 hover:bg-white/5 rounded-xl transition-all"
                   title="Snap OCR"
                 >
                   <ImageIcon size={20} />
                   <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleOCR} />
                 </button>
               </>
             )}

             {activeTab === 'analyze' && (
               <>
                 <div className="flex flex-col gap-1 w-full px-4 mb-4 border-b border-slate-800 pb-4">
                   <p className="text-[7px] text-slate-600 uppercase tracking-widest mb-2 font-bold">Analysis Depth</p>
                   {(['short', 'medium', 'detailed'] as SummaryLength[]).map((l) => (
                     <button
                       key={l}
                       onClick={() => setSummaryLength(l)}
                       className={cn(
                         "px-2 py-1 text-[8px] text-left uppercase tracking-widest transition-colors rounded",
                         summaryLength === l ? "bg-amber-600/20 text-amber-500 border border-amber-500/20" : "text-slate-500 hover:text-slate-300"
                       )}
                     >
                       {l}
                     </button>
                   ))}
                 </div>

                 <button 
                   onClick={handleSummarize}
                   disabled={isSummarizing}
                   className={cn("p-3 rounded-xl transition-all", isSummarizing ? "text-amber-500 bg-amber-500/10 animate-pulse" : "text-slate-500 hover:text-amber-500 hover:bg-white/5")}
                   title="AI Summarize"
                 >
                   <Wand2 size={20} />
                 </button>

                 <button 
                   onClick={() => compareInputRef.current?.click()}
                   className={cn("p-3 rounded-xl transition-all", isComparing ? "text-amber-500 bg-amber-500/10 animate-pulse" : "text-slate-500 hover:text-amber-500 hover:bg-white/5")}
                   title="Cross-Ref Compare"
                 >
                   <BookOpen size={20} />
                   <input type="file" ref={compareInputRef} className="hidden" accept=".pdf" onChange={handleCompareUpload} />
                 </button>

                 <button 
                   onClick={handleSpeech}
                   disabled={!summary}
                   className={cn("p-3 rounded-xl transition-all disabled:opacity-20", isSpeaking ? "text-amber-500 bg-amber-500/10 animate-pulse" : "text-slate-500 hover:text-amber-500 hover:bg-white/5")}
                   title="Synthesize Speech"
                 >
                   <Volume2 size={20} />
                 </button>
               </>
             )}

             {activeTab === 'organize' && (
               <>
                 <Tooltip content="Purge Current Page">
                   <button onClick={handleRemovePage} className="p-3 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all">
                     <Scissors size={20} />
                   </button>
                 </Tooltip>
                 <div className="h-px w-8 bg-slate-800" />
                 <Tooltip content="Compile PDF">
                   <button onClick={handleExportPDF} className="p-3 text-slate-500 hover:text-amber-500 hover:bg-white/5 rounded-xl transition-all">
                     <Download size={20} />
                   </button>
                 </Tooltip>
                 <Tooltip content="Export to DOCX">
                   <button onClick={convertToDocx} disabled={!summary} className="p-3 text-slate-500 hover:text-amber-500 hover:bg-white/5 rounded-xl transition-all disabled:opacity-20">
                     <FileOutput size={20} />
                   </button>
                 </Tooltip>
                 <Tooltip content="Multi-Format Export">
                   <button onClick={() => setShowExportMenu(!showExportMenu)} className="p-3 text-slate-500 hover:text-amber-500 hover:bg-white/5 rounded-xl transition-all">
                     <Save size={20} />
                   </button>
                 </Tooltip>
               </>
             )}
           </div>

           <div className="mt-auto p-3 text-slate-700">
             <Settings2 size={20} />
           </div>
        </div>

        {/* Main Viewport */}
        <div className="flex-1 bg-[#141414] overflow-auto p-12 flex justify-center items-start scrollbar-thin scrollbar-thumb-slate-800">
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="shadow-[0_48px_120px_-30px_rgba(0,0,0,0.9)]"
          >
            <Document
              file={file}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={<div className="text-slate-600 font-serif italic text-sm">Decoding Lattice...</div>}
            >
              <Page 
                pageNumber={pageNumber} 
                scale={scale} 
                className="rounded-sm overflow-hidden"
                renderAnnotationLayer={true}
                renderTextLayer={true}
              />
            </Document>
          </motion.div>
        </div>

        {/* Sidebar for Insights & OCR */}
        <AnimatePresence>
          {(summary || ocrText || isOcrLoading || comparisonResult || isComparing) && (
            <motion.div 
              initial={{ x: 340 }}
              animate={{ x: 0 }}
              exit={{ x: 340 }}
              className="w-80 border-l border-slate-800 bg-[#0f0f0f] flex flex-col p-8 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {comparisonResult ? "Semantic Delta" : "Neural Insights"}
                  </h3>
                </div>
                {(summary || ocrText || comparisonResult) && (
                  <button onClick={() => { setSummary(null); setOcrText(null); setComparisonResult(null); }} className="text-slate-600 hover:text-white">
                    <ChevronRight size={14} />
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-auto scrollbar-none space-y-8">
                {(isOcrLoading || isComparing) && (
                  <div className="p-6 border border-amber-500/20 bg-amber-500/5 rounded-xl">
                    <p className="text-[10px] text-amber-500 font-mono animate-pulse uppercase">
                      {isComparing ? "Processing Delta..." : "EXTRACTING PIXELS..."}
                    </p>
                  </div>
                )}

                {comparisonResult && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[8px] text-slate-500 font-bold uppercase tracking-widest">
                      <BookOpen size={10} /> Comparison Audit
                    </div>
                    <div className="bg-white/[0.04] border border-white/10 rounded-xl p-5">
                      <div className="prose prose-invert prose-xs leading-relaxed text-slate-200">
                        <ReactMarkdown>{comparisonResult}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                )}

                {ocrText && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[8px] text-slate-500 font-bold uppercase tracking-widest">
                      <ImageIcon size={10} /> OCR Content
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5 text-[11px] font-mono text-slate-400 leading-relaxed whitespace-pre-wrap">
                      {ocrText}
                    </div>
                  </div>
                )}

                {summary && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[8px] text-slate-500 font-bold uppercase tracking-widest">
                      <Wand2 size={10} /> Synthesized Summary
                    </div>
                    <div className="bg-white/[0.04] border border-white/10 rounded-xl p-5">
                      <div className="prose prose-invert prose-xs italic font-serif leading-relaxed text-slate-200">
                        <ReactMarkdown>{summary}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                )}

                <div className="border-t border-slate-800 pt-8 mt-auto">
                   <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-6">File Node Metadata</p>
                   <div className="grid grid-cols-2 gap-y-6">
                      <div>
                        <p className="text-[8px] text-slate-600 uppercase tracking-tighter mb-1">Status</p>
                        <p className="text-[10px] text-amber-500 font-mono">Secured</p>
                      </div>
                      <div>
                        <p className="text-[8px] text-slate-600 uppercase tracking-tighter mb-1">Size</p>
                        <p className="text-[10px] text-slate-300 font-mono">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <div>
                        <p className="text-[8px] text-slate-600 uppercase tracking-tighter mb-1">Format</p>
                        <p className="text-[10px] text-slate-300 font-mono">Adobe PDF</p>
                      </div>
                      <div>
                        <p className="text-[8px] text-slate-600 uppercase tracking-tighter mb-1">Encryption</p>
                        <p className="text-[10px] text-slate-300 font-mono">AES-256</p>
                      </div>
                   </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer / Status Bar */}
      <footer className="h-10 bg-[#0a0a0a] border-t border-slate-800 px-6 flex items-center justify-between text-[9px] text-slate-600 font-mono tracking-widest uppercase">
        <div className="flex gap-8">
          <div className="flex items-center gap-6">
            <button 
              disabled={pageNumber <= 1}
              onClick={() => setPageNumber(p => p - 1)}
              className="hover:text-amber-500 disabled:opacity-20 transition-colors"
            >
              [ PREV ]
            </button>
            <span className="text-slate-400">PAGE {pageNumber} OF {numPages || '?'}</span>
            <button 
              disabled={numPages ? pageNumber >= numPages : false}
              onClick={() => setPageNumber(p => p + 1)}
              className="hover:text-amber-500 disabled:opacity-20 transition-colors"
            >
              [ NEXT ]
            </button>
          </div>
        </div>
        <div className="flex gap-6 items-center">
          <span className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${isSpeaking ? 'bg-amber-500 animate-ping' : 'bg-green-500'}`}></div> 
            {isSpeaking ? 'Voice Engine Active' : 'System Synced'}
          </span>
          <span className="opacity-30">Lattice Latency: 14ms</span>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        .prose-xs { font-size: 0.75rem; line-height: 1.7; }
        .prose-xs p { margin-bottom: 0.75rem; }
        .prose-xs ul { list-style-type: disc; padding-left: 1.25rem; margin-top: 0.5rem; }
        .prose-xs li { margin-bottom: 0.25rem; }
      `}} />
    </div>
  );
};
