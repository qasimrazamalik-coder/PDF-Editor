/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Upload, FileText, Database, Shield, Zap, Info, Clock, LogOut, User } from 'lucide-react';
import { KnowledgeHub } from './components/KnowledgeHub';
import { PDFSuite } from './components/PDFSuite';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { getDocumentHistory, auth } from './services/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User as FirebaseUser } from 'firebase/auth';

export default function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [user, setUser] = useState<FirebaseUser | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const fetchHistory = async () => {
        const data = await getDocumentHistory();
        setHistory(data);
      };
      fetchHistory();
    } else {
      setHistory([]);
    }
  }, [selectedFile, user]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login Error:", error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
    setFiles(prev => [...prev, ...droppedFiles]);
  }, []);

  const onFileSelect = (file: File) => {
    setSelectedFile(file);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-slate-300 selection:bg-amber-600 selection:text-black font-sans">
      {/* Background Grid Pattern */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.02]" 
           style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 h-14 border-b border-slate-800 bg-[#0f0f0f]/90 backdrop-blur-md z-40 px-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-amber-600 rounded flex items-center justify-center font-bold text-black text-sm">L</div>
          <span className="font-serif italic text-white tracking-wide text-lg">LexiCloud</span>
        </div>
        
        <div className="hidden md:flex items-center gap-8 font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
          <a href="#" className="hover:text-amber-500 transition-colors">Reader</a>
          <a href="#" className="hover:text-amber-500 transition-colors">Editor</a>
          <a href="#" className="hover:text-amber-500 transition-colors">Organize</a>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || ""} className="w-6 h-6 rounded-full border border-slate-700" referrerPolicy="no-referrer" />
                ) : (
                  <User size={14} className="text-slate-500" />
                )}
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{user.displayName?.split(' ')[0]}</span>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 text-slate-500 hover:text-white transition-colors"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              className="px-6 py-2 bg-slate-100 text-black text-[10px] uppercase font-bold tracking-widest hover:bg-white transition-colors rounded-sm"
            >
              Authorize
            </button>
          )}
        </div>
      </nav>

      <main className="pt-24 pb-20 px-8 max-w-[1400px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Left Column: Intro & Upload */}
          <div className="lg:col-span-4 flex flex-col gap-10">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-7xl font-serif text-white leading-tight tracking-tight mb-8">
                The Immersive <br/>
                <span className="italic text-amber-500">Spatial</span> Reader.
              </h1>
              <p className="text-slate-500 text-sm leading-relaxed max-w-sm">
                Advanced PDF engineering meets generative intelligence. Organize, analyze, and synthesize your library within the LexiCloud lattice.
              </p>
            </motion.div>

            {/* Upload Area */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              className={cn(
                "relative group cursor-pointer border border-slate-800 rounded-sm p-16 flex flex-col items-center justify-center gap-4 transition-all duration-500",
                isDragging ? "bg-amber-600/5 border-amber-500/50 scale-[0.98]" : "bg-white/[0.01] hover:border-slate-600"
              )}
            >
              <input 
                type="file" 
                accept=".pdf"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setFiles(prev => [...prev, f]);
                }}
              />
              <div className="w-12 h-12 rounded-full border border-slate-700 flex items-center justify-center group-hover:border-amber-500 transition-colors">
                <Upload className="text-amber-500" size={20} />
              </div>
              <div className="text-center">
                <p className="font-bold text-[10px] uppercase tracking-[0.3em] text-slate-500 mb-1">Initialize Source</p>
                <p className="text-xs text-slate-400 italic font-serif">Drop PDF into protocol</p>
              </div>
            </motion.div>

            {/* History Tracker */}
            <div className="flex flex-col gap-4 mt-4">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">
                <Clock size={12} className="text-amber-500/50" />
                Session History
              </div>
              <div className="max-h-48 overflow-y-auto scrollbar-none flex flex-col gap-2">
                {history.length === 0 ? (
                  <p className="text-[10px] text-slate-700 italic">No node activity recorded.</p>
                ) : (
                  history.slice(0, 5).map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-lg group hover:border-amber-500/20 transition-colors">
                      <span className="text-[10px] text-slate-400 font-medium truncate max-w-[120px]">{item.name}</span>
                      <span className="text-[9px] text-slate-600 font-mono">{(item.size / 1024).toFixed(0)} KB</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Stats / Labels */}
            <div className="grid grid-cols-2 gap-px bg-slate-800/50 border border-slate-800 overflow-hidden rounded-sm">
              {[
                { label: 'Active Nodes', val: files.length, icon: Database },
                { label: 'Encryption', val: 'AES-256', icon: Shield },
              ].map((stat, i) => (
                <div key={i} className="p-6 bg-[#0a0a0a]">
                  <div className="flex items-center gap-2 mb-3">
                    <stat.icon size={12} className="text-amber-500/50" />
                    <span className="font-bold text-[9px] uppercase tracking-widest text-slate-500">{stat.label}</span>
                  </div>
                  <div className="font-mono text-xl text-slate-200">{stat.val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: 3D Visualization Hub */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.4 }}
            className="lg:col-span-8 flex flex-col gap-8"
          >
            <div className="h-[520px] rounded-sm border border-slate-800 overflow-hidden relative">
              <KnowledgeHub files={files} onFileSelect={onFileSelect} />
            </div>
            
            {/* Real-time Ticker */}
            <div className="h-10 border border-slate-800 bg-[#0f0f0f] rounded-sm flex items-center px-6 overflow-hidden">
              <Zap size={12} className="text-amber-500 mr-4 animate-pulse" />
              <div className="flex-1 font-mono text-[9px] uppercase tracking-widest text-slate-600">
                <div className="flex gap-12 animate-marquee whitespace-nowrap">
                  <span>Protocol Active: System 0xAF</span>
                  <span>AES-256 Hardware Acceleration Enabled</span>
                  <span>Neural Core Synthesis Stable</span>
                  <span>Spatial Mesh Calibration Complete</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Floating File List (Bottom) */}
        {files.length > 0 && (
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            className="fixed bottom-12 left-1/2 -translate-x-1/2 z-30"
          >
            <div className="flex items-center gap-px bg-slate-800 border border-slate-800 rounded-full overflow-hidden shadow-2xl">
              {files.slice(-5).map((f, i) => (
                <button 
                  key={i}
                  onClick={() => setSelectedFile(f)}
                  className="flex items-center gap-3 px-6 py-3 bg-[#0f0f0f] hover:bg-[#1a1a1a] transition-colors group first:rounded-l-full last:rounded-r-full"
                >
                  <FileText size={14} className="text-amber-500 opacity-50 group-hover:opacity-100" />
                  <span className="font-sans font-medium text-[10px] uppercase tracking-widest text-slate-400 group-hover:text-amber-500 transition-colors">
                    {f.name.slice(0, 12)}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </main>

      {/* PDF Suite Overlay */}
      <AnimatePresence>
        {selectedFile && (
          <PDFSuite 
            file={selectedFile} 
            onClose={() => setSelectedFile(null)} 
          />
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
      `}} />
    </div>
  );
}

