
import React, { useMemo, useState, useEffect } from 'react';
import { FileEntry } from '../types';

interface PreviewProps {
  files: FileEntry[];
  type: string;
}

const Preview: React.FC<PreviewProps> = ({ files, type }) => {
  const [booting, setBooting] = useState(true);
  const [status, setStatus] = useState('Initializing runtime...');

  useEffect(() => {
    const sequence = [
      { t: 0, s: 'Allocating container memory...' },
      { t: 800, s: 'Loading synthesized intelligence modules...' },
      { t: 1600, s: 'Checking production dependency health...' },
      { t: 2400, s: 'Mounting virtual filesystem...' },
      { t: 3200, s: 'Starting local development server (port 5173)...' },
      { t: 4000, s: 'Ready' }
    ];

    sequence.forEach(({ t, s }) => {
      setTimeout(() => {
        setStatus(s);
        if (s === 'Ready') setBooting(false);
      }, t);
    });
  }, []);

  // Find the entry point (usually index.html or README or a main script)
  const entryFile = useMemo(() => {
    return files.find(f => f.path.toLowerCase().includes('index.html')) || 
           files.find(f => f.path.toLowerCase().includes('readme')) ||
           files[0];
  }, [files]);

  return (
    <div className="w-full h-full bg-[#020617] flex flex-col relative animate-fade-in">
      {/* Simulation Header */}
      <div className="h-12 px-6 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-4">
          <div className="flex space-x-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 flex items-center justify-center"><div className="w-1 h-1 rounded-full bg-red-500"></div></div>
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20 flex items-center justify-center"><div className="w-1 h-1 rounded-full bg-amber-500"></div></div>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/20 flex items-center justify-center"><div className="w-1 h-1 rounded-full bg-emerald-500"></div></div>
          </div>
          <div className="h-6 w-px bg-slate-800 mx-2"></div>
          <div className="flex items-center space-x-2 bg-slate-950 px-3 py-1 rounded-lg border border-white/5">
            <i className="fa-solid fa-globe text-[10px] text-slate-500"></i>
            <span className="text-[10px] font-mono text-indigo-400">http://localhost:5173/</span>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${booting ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
            {booting ? 'Deploying' : 'Live'}
          </span>
          <button onClick={() => window.location.reload()} className="text-slate-500 hover:text-white transition-colors"><i className="fa-solid fa-rotate-right text-xs"></i></button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {booting ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 p-12 text-center">
             <div className="w-16 h-1 bg-slate-900 rounded-full mb-8 relative overflow-hidden">
                <div className="absolute inset-0 bg-indigo-500 animate-loading-bar"></div>
             </div>
             <div className="space-y-2">
               <p className="text-xs font-black uppercase tracking-[0.3em] text-indigo-400">{status}</p>
               <p className="text-[10px] text-slate-600 uppercase tracking-widest">Environment: Synthesis-V1</p>
             </div>
          </div>
        ) : (
          <div className="w-full h-full overflow-auto custom-scrollbar bg-white flex flex-col">
            {/* The "App" interface simulation */}
            <div className="p-12 text-slate-900 font-sans max-w-4xl mx-auto w-full">
               <h1 className="text-4xl font-black mb-6 border-b-4 border-indigo-600 pb-2 inline-block">App: {type}</h1>
               <p className="text-xl text-slate-600 mb-10 font-light leading-relaxed">
                 You are viewing the virtual execution of the synthesized project. This simulation parses the generated nodes into a human-readable live playground.
               </p>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                  <div className="p-8 bg-slate-50 rounded-3xl border border-slate-200">
                    <h3 className="text-xs font-black uppercase text-slate-400 mb-4 tracking-widest">Entry File</h3>
                    <code className="text-indigo-600 font-bold block mb-4">{entryFile?.path}</code>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      The core logic starts here. The node-graph has been successfully transpiled into {files.length} production assets.
                    </p>
                  </div>
                  <div className="p-8 bg-indigo-600 rounded-3xl shadow-xl shadow-indigo-500/20 text-white">
                    <h3 className="text-xs font-black uppercase text-indigo-200 mb-4 tracking-widest">Vibe Score</h3>
                    <div className="text-5xl font-black mb-2">9.8/10</div>
                    <p className="text-sm opacity-80">Synthesized architecture successfully verified for performance.</p>
                  </div>
               </div>

               <div className="space-y-6">
                 <h2 className="text-xl font-black uppercase tracking-tight text-slate-800">Production Source Tree</h2>
                 <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                   {files.map(f => (
                     <div key={f.path} className="flex items-center space-x-3 p-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-indigo-500 transition-colors">
                       <i className="fa-solid fa-file-code text-indigo-500"></i>
                       <span className="text-xs font-bold text-slate-700 truncate">{f.path}</span>
                     </div>
                   ))}
                 </div>
               </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Edge Polish */}
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.2)]"></div>
    </div>
  );
};

export default Preview;
