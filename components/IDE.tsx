
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { FileEntry, AIProvider, IntelligenceConfig } from '../types';
import Preview from './Preview';
import { GoogleGenAI } from "@google/genai";
// @ts-ignore
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
// @ts-ignore
import { 
  atomDark, dracula, okaidia, vscDarkPlus, coldarkDark
} from 'react-syntax-highlighter/dist/esm/styles/prism';
// @ts-ignore
import JSZip from 'jszip';

interface IDEProps {
  files: FileEntry[];
  projectName: string;
  onUpdateFiles?: (newFiles: FileEntry[]) => void;
  fontSize?: number;
  theme?: string;
}

type IDEActivity = 'explorer' | 'search' | 'git' | 'debug' | 'extensions' | 'sandbox';
type CopilotTab = 'chat' | 'context' | 'mcp' | 'engine';

interface CopilotMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

const IDE: React.FC<IDEProps> = ({ files, projectName, onUpdateFiles, fontSize = 13, theme = 'dracula' }) => {
  const [activeActivity, setActiveActivity] = useState<IDEActivity>('explorer');
  const [copilotTab, setCopilotTab] = useState<CopilotTab>('chat');
  const [openFiles, setOpenFiles] = useState<string[]>(files.length > 0 ? [files[0].path] : []);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(files.length > 0 ? files[0].path : null);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [rightPanelWidth, setRightPanelWidth] = useState(380);
  
  // START CLUSTER: UI INITIALIZATION FIX
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [assistantCollapsed, setAssistantCollapsed] = useState(true);
  // END CLUSTER
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  
  // Git State
  const [commitMessage, setCommitMessage] = useState('');
  
  // Debug State
  const [isDebugRunning, setIsDebugRunning] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  
  // Extensions State
  const [extensions, setExtensions] = useState([
    { id: 'logic-audit', name: 'Deep Logic Auditor', dev: 'VibeLabs', installed: true, desc: 'Advanced recursive reasoning for complex manifests.' },
    { id: 'theme-v3', name: 'Aesthetic Engine V3', dev: 'PrismNode', installed: false, desc: 'Hyper-realistic UI styling and gradient maps.' },
    { id: 'git-plus', name: 'Git Graph Plus', dev: 'General', installed: true, desc: 'Visualise node-commit branches in real-time.' }
  ]);

  // Copilot States
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<CopilotMessage[]>([
    { role: 'assistant', content: 'System initialized. I have full visibility into your project manifest. How can I assist with the architecture today?', timestamp: new Date() }
  ]);
  const [selectedContextFiles, setSelectedContextFiles] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [copilotConfig, setCopilotConfig] = useState<IntelligenceConfig>({
    provider: 'google',
    model: 'gemini-3-flash-preview',
    maxTokens: 2048,
    topP: 0.95
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isResizingSidebar = useRef(false);
  const isResizingRightPanel = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const syntaxThemes: Record<string, any> = { 
    dracula, monokai: okaidia, atomDark, vscDarkPlus, githubDark: vscDarkPlus, vibe: atomDark, nord: coldarkDark
  };

  const activeFile = useMemo(() => files.find(f => f.path === activeFilePath) || null, [files, activeFilePath]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Search Results Engine
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return files.filter(f => 
      f.path.toLowerCase().includes(searchQuery.toLowerCase()) || 
      f.content.toLowerCase().includes(searchQuery.toLowerCase())
    ).map(f => {
      const index = f.content.toLowerCase().indexOf(searchQuery.toLowerCase());
      const preview = index !== -1 
        ? '...' + f.content.substring(Math.max(0, index - 20), Math.min(f.content.length, index + 40)) + '...'
        : 'Filename match';
      return { path: f.path, preview };
    });
  }, [files, searchQuery]);

  const handleOpenFile = (path: string) => {
    if (!openFiles.includes(path)) {
      setOpenFiles([...openFiles, path]);
    }
    setActiveFilePath(path);
  };

  const handleCloseFile = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    const newOpenFiles = openFiles.filter(p => p !== path);
    setOpenFiles(newOpenFiles);
    if (activeFilePath === path) {
      setActiveFilePath(newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1] : null);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!activeFile || !onUpdateFiles) return;
    const newContent = e.target.value;
    const updatedFiles = files.map(f => f.path === activeFile.path ? { ...f, content: newContent } : f);
    onUpdateFiles(updatedFiles);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = e.target.files;
    if (!uploaded || !onUpdateFiles) return;
    
    const newEntries: FileEntry[] = [];
    
    for (let i = 0; i < uploaded.length; i++) {
      const file = uploaded[i];
      
      if (file.name.endsWith('.zip')) {
        try {
          const zip = await JSZip.loadAsync(file);
          // Fix: JSZip files might be typed as unknown, so we cast to any to access .dir and .async
          for (const [path, entry] of Object.entries(zip.files)) {
            const zipEntry = entry as any;
            if (!zipEntry.dir) {
              const content = await zipEntry.async('string');
              const ext = path.split('.').pop() || 'txt';
              newEntries.push({ path, content, language: getLanguageFromExt(ext) });
            }
          }
        } catch (err) {
          console.error("ZIP Error:", err);
        }
      } else {
        const text = await file.text();
        const ext = file.name.split('.').pop() || 'txt';
        newEntries.push({ path: file.name, content: text, language: getLanguageFromExt(ext) });
      }
    }
    
    onUpdateFiles([...files, ...newEntries]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (newEntries.length > 0) handleOpenFile(newEntries[0].path);
  };

  const getLanguageFromExt = (ext: string) => {
    switch (ext) {
      case 'ts': case 'tsx': return 'typescript';
      case 'js': case 'jsx': return 'javascript';
      case 'html': return 'html';
      case 'css': return 'css';
      case 'json': return 'json';
      case 'md': return 'markdown';
      default: return 'plaintext';
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isSending) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: new Date() }]);
    setIsSending(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const contextData = files
        .filter(f => selectedContextFiles.includes(f.path))
        .map(f => `FILE: ${f.path}\nCONTENT:\n${f.content}`)
        .join('\n\n---\n\n');

      const systemInstruction = `You are a world-class AI developer assistant (Copilot) built into the VibeOrchestra IDE. 
      You have access to the project files. 
      Current Project Context: ${projectName}
      
      When answering:
      - Be technical, concise, and helpful.
      - Provide code snippets if relevant.
      - Use markdown formatting.
      - If referring to a file, mention its path.
      
      ${contextData ? `Relevant Source Context:\n${contextData}` : ''}`;

      const response = await ai.models.generateContent({
        model: copilotConfig.model,
        contents: userMessage,
        config: {
          systemInstruction,
          maxOutputTokens: copilotConfig.maxTokens,
          temperature: 0.7,
        }
      });

      const aiText = response.text || "I encountered an error processing that request.";
      setMessages(prev => [...prev, { role: 'assistant', content: aiText, timestamp: new Date() }]);
    } catch (err) {
      console.error("Copilot Error:", err);
      setMessages(prev => [...prev, { role: 'assistant', content: "Critical Fault: Communication with the intelligence cluster was interrupted.", timestamp: new Date() }]);
    } finally {
      setIsSending(false);
    }
  };

  const runDebug = () => {
    setIsDebugRunning(true);
    setDebugLogs([`[${new Date().toLocaleTimeString()}] Initialising runtime environment...`]);
    setTimeout(() => setDebugLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Mounting virtual filesystem...`]), 500);
    setTimeout(() => setDebugLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Spawning Logic Kernel processes...`]), 1000);
    setTimeout(() => setDebugLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Listening on port 5173 (Development Server)`]), 1500);
  };

  const stopDebug = () => {
    setIsDebugRunning(false);
    setDebugLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Process terminated by user.`]);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingSidebar.current) setSidebarWidth(Math.max(200, Math.min(600, e.clientX - 48)));
      if (isResizingRightPanel.current) setRightPanelWidth(Math.max(300, Math.min(800, window.innerWidth - e.clientX)));
    };
    const handleMouseUp = () => {
      isResizingSidebar.current = false;
      isResizingRightPanel.current = false;
      document.body.style.cursor = 'default';
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const getIconForFile = (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts': case 'tsx': return 'fa-brands fa-js text-blue-400';
      case 'js': case 'jsx': return 'fa-brands fa-js text-yellow-400';
      case 'html': return 'fa-brands fa-html5 text-orange-500';
      case 'css': return 'fa-brands fa-css3-alt text-blue-500';
      case 'json': return 'fa-solid fa-code text-blue-300';
      case 'md': return 'fa-brands fa-markdown text-white/60';
      default: return 'fa-regular fa-file text-slate-500';
    }
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden font-sans select-none relative" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-main)' }}>
      <div className="flex-1 flex min-h-0">
        
        {/* 1. ACTIVITY BAR */}
        <div className="w-12 border-r flex flex-col items-center py-4 space-y-4 shrink-0 bg-black/20" style={{ borderColor: 'var(--border)' }}>
          {[
            { id: 'explorer', icon: 'fa-copy', label: 'Explorer' },
            { id: 'search', icon: 'fa-magnifying-glass', label: 'Search' },
            { id: 'git', icon: 'fa-code-branch', label: 'Source Control' },
            { id: 'debug', icon: 'fa-play', label: 'Run & Debug' },
            { id: 'extensions', icon: 'fa-cubes', label: 'Extensions' },
            { id: 'sandbox', icon: 'fa-rocket', label: 'Sandbox' }
          ].map(item => (
            <button 
              key={item.id}
              onClick={() => { setActiveActivity(item.id as IDEActivity); setSidebarCollapsed(false); }}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${activeActivity === item.id && !sidebarCollapsed ? 'text-white shadow-lg shadow-indigo-500/20 scale-105' : 'opacity-30 hover:opacity-100'}`}
              style={activeActivity === item.id && !sidebarCollapsed ? { backgroundColor: 'var(--accent)' } : {}}
              title={item.label}
            >
              <i className={`fa-solid ${item.icon} text-xs`} />
            </button>
          ))}
        </div>

        {/* 2. SIDEBAR */}
        {!sidebarCollapsed && (
          <div className="border-r flex flex-col relative shrink-0 bg-black/10" style={{ width: sidebarWidth, borderColor: 'var(--border)' }}>
            <div className="h-10 px-4 flex items-center justify-between shrink-0 border-b bg-black/20" style={{ borderColor: 'var(--border)' }}>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{activeActivity}</span>
              <button onClick={() => setSidebarCollapsed(true)} className="text-slate-600 hover:text-white transition-colors"><i className="fa-solid fa-chevron-left text-[10px]" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {activeActivity === 'explorer' && (
                <div className="flex flex-col h-full animate-fade-in">
                  <div className="p-2 border-b flex items-center space-x-1" style={{ borderColor: 'var(--border)' }}>
                     <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded hover:bg-white/5 text-slate-400 hover:text-white transition-all" title="Upload Source (Supports .zip)"><i className="fa-solid fa-upload text-[11px]" /></button>
                     <button className="p-2 rounded hover:bg-white/5 text-slate-400 hover:text-white transition-all" title="New File"><i className="fa-solid fa-file-circle-plus text-[11px]" /></button>
                     <input type="file" multiple ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                  </div>
                  <div className="p-4">
                    <div className="flex items-center text-[11px] font-black uppercase tracking-widest text-indigo-400 mb-2">
                      <i className="fa-solid fa-chevron-down mr-2 text-[8px]" /> {projectName || "PROJECT_MANIFEST"}
                    </div>
                    <div className="space-y-0.5">
                      {files.map(file => (
                        <div 
                          key={file.path}
                          onClick={() => handleOpenFile(file.path)}
                          className={`px-4 py-1.5 text-[12px] flex items-center group cursor-pointer rounded-md transition-all ${activeFilePath === file.path ? 'bg-indigo-600/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
                        >
                          <i className={`${getIconForFile(file.path)} w-4 text-center mr-3`} />
                          <span className="truncate flex-1 font-medium">{file.path}</span>
                          <button onClick={(e) => { e.stopPropagation(); onUpdateFiles?.(files.filter(f => f.path !== file.path)) }} className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all px-1"><i className="fa-solid fa-trash text-[9px]" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeActivity === 'search' && (
                <div className="p-4 flex flex-col h-full space-y-4 animate-fade-in">
                   <div className="relative">
                      <input 
                        type="text" 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search manifest content..."
                        className="w-full bg-black/40 border border-white/5 rounded-lg py-2 pl-3 pr-8 text-[12px] outline-none focus:border-indigo-500/50"
                      />
                      <i className="fa-solid fa-search absolute right-3 top-2.5 text-slate-600 text-[10px]" />
                   </div>
                   <div className="flex-1 overflow-y-auto space-y-2">
                      {searchResults.map((res, i) => (
                        <button key={i} onClick={() => handleOpenFile(res.path)} className="w-full text-left p-3 rounded-lg bg-black/20 border border-white/5 hover:border-indigo-500/30 transition-all">
                           <div className="flex items-center space-x-2 text-[10px] font-black uppercase text-indigo-400 mb-1">
                              <i className={getIconForFile(res.path)} />
                              <span>{res.path}</span>
                           </div>
                           <div className="text-[11px] font-mono text-slate-500 truncate">{res.preview}</div>
                        </button>
                      ))}
                   </div>
                </div>
              )}

              {activeActivity === 'git' && (
                <div className="p-4 flex flex-col h-full space-y-6 animate-fade-in">
                   <div className="space-y-4">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Changes</span>
                      <div className="space-y-1">
                        {files.slice(0, 3).map(f => (
                          <div key={f.path} className="flex items-center justify-between p-2 rounded hover:bg-white/5 text-[11px] group">
                             <div className="flex items-center space-x-2 truncate"><i className="fa-solid fa-circle-plus text-emerald-500 text-[8px]" /><span className="text-slate-300 truncate">{f.path}</span></div>
                             <span className="text-[9px] text-slate-600 font-mono">modified</span>
                          </div>
                        ))}
                      </div>
                   </div>
                   <div className="space-y-4">
                      <textarea 
                          value={commitMessage}
                          onChange={e => setCommitMessage(e.target.value)}
                          placeholder="Strategic commit message..."
                          className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-[12px] outline-none min-h-[100px] resize-none focus:border-indigo-500/50"
                      />
                      <button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] uppercase tracking-widest py-3 rounded-xl shadow-lg transition-all active:scale-95 border-b-2 border-black/20">Commit to Cluster</button>
                   </div>
                </div>
              )}

              {activeActivity === 'debug' && (
                <div className="p-4 flex flex-col h-full space-y-6 animate-fade-in">
                   <div className="flex space-x-2">
                      <button onClick={runDebug} disabled={isDebugRunning} className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-30"><i className="fa-solid fa-play mr-2" />Start</button>
                      <button onClick={stopDebug} disabled={!isDebugRunning} className="flex-1 py-2 rounded-lg bg-red-600 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-30"><i className="fa-solid fa-stop mr-2" />Stop</button>
                   </div>
                   <div className="space-y-4">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Debug Console</span>
                      <div className="bg-black/40 rounded-xl p-3 border border-white/5 h-64 overflow-y-auto font-mono text-[10px] space-y-1">
                         {debugLogs.map((log, i) => <div key={i} className="text-emerald-400/80">{log}</div>)}
                         {isDebugRunning && <div className="animate-pulse text-indigo-400">--- STANDBY: MONITORING PROCESS ---</div>}
                      </div>
                   </div>
                </div>
              )}

              {activeActivity === 'extensions' && (
                <div className="p-4 flex flex-col h-full space-y-4 animate-fade-in">
                   <div className="relative mb-2">
                      <input type="text" placeholder="Neural extension library..." className="w-full bg-black/40 border border-white/5 rounded-lg py-2 px-3 text-[11px] outline-none" />
                   </div>
                   <div className="space-y-3">
                      {extensions.map(ext => (
                        <div key={ext.id} className="p-3 rounded-xl border border-white/5 bg-black/20 group hover:border-indigo-500/30 transition-all">
                           <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-3">
                                 <div className="w-8 h-8 rounded-lg bg-indigo-600/10 flex items-center justify-center text-indigo-400"><i className="fa-solid fa-plug text-xs" /></div>
                                 <div><div className="text-[11px] font-black text-white">{ext.name}</div><div className="text-[8px] text-slate-600 font-bold uppercase">{ext.dev}</div></div>
                              </div>
                              <button 
                                onClick={() => setExtensions(prev => prev.map(e => e.id === ext.id ? { ...e, installed: !e.installed } : e))}
                                className={`px-2 py-1 rounded text-[8px] font-black uppercase ${ext.installed ? 'text-slate-500 bg-slate-800' : 'text-white bg-indigo-600'}`}
                              >
                                {ext.installed ? 'Manage' : 'Install'}
                              </button>
                           </div>
                           <p className="text-[10px] text-slate-500 leading-relaxed">{ext.desc}</p>
                        </div>
                      ))}
                   </div>
                </div>
              )}
            </div>

            <div 
              onMouseDown={() => { isResizingSidebar.current = true; document.body.style.cursor = 'col-resize'; }}
              className="absolute right-0 top-0 bottom-0 w-[2px] cursor-col-resize hover:bg-indigo-500/50 z-50 transition-colors" 
              style={{ backgroundColor: 'var(--border)' }}
            />
          </div>
        )}

        {/* 3. MAIN EDITOR */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-black/5">
          <div className="h-10 flex overflow-x-auto no-scrollbar shrink-0 border-b bg-black/20" style={{ borderColor: 'var(--border)' }}>
            {openFiles.map(path => (
              <div 
                key={path}
                onClick={() => setActiveFilePath(path)}
                className={`flex items-center px-4 h-full border-r cursor-pointer min-w-[140px] transition-all group relative ${activeFilePath === path ? 'bg-black/20' : 'opacity-40 hover:opacity-100 hover:bg-white/5'}`}
                style={{ borderColor: 'var(--border)' }}
              >
                <i className={`${getIconForFile(path)} text-[12px] mr-3`} />
                <span className={`text-[12px] truncate flex-1 font-medium ${activeFilePath === path ? 'text-white' : 'text-slate-400'}`}>{path}</span>
                <button onClick={(e) => handleCloseFile(e, path)} className="ml-2 w-4 h-4 flex items-center justify-center rounded hover:bg-red-500/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"><i className="fa-solid fa-xmark text-[9px]" /></button>
                {activeFilePath === path && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />}
              </div>
            ))}
          </div>

          <div className="flex-1 relative overflow-hidden">
             {activeActivity === 'sandbox' ? (
              <Preview files={files} type={projectName} />
            ) : activeFile ? (
              <div className="w-full h-full grid grid-cols-1 grid-rows-1">
                <textarea
                  value={activeFile.content}
                  onChange={handleCodeChange}
                  spellCheck={false}
                  className="col-start-1 row-start-1 w-full h-full p-8 text-transparent bg-transparent border-none outline-none resize-none z-10 font-mono"
                  style={{ fontSize: `${fontSize}px`, lineHeight: '1.6', caretColor: 'var(--accent)', whiteSpace: 'pre' }}
                />
                <div className="col-start-1 row-start-1 pointer-events-none overflow-auto custom-scrollbar bg-transparent">
                  <SyntaxHighlighter
                    language={activeFile.language}
                    style={syntaxThemes[theme] || dracula}
                    customStyle={{ margin: 0, padding: '2rem', fontSize: `${fontSize}px`, lineHeight: '1.6', backgroundColor: 'transparent', minHeight: '100%', width: 'max-content' }}
                    showLineNumbers={true}
                  >
                    {activeFile.content}
                  </SyntaxHighlighter>
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-800 opacity-20">
                 <i className="fa-solid fa-code text-9xl mb-6" />
                 <p className="text-xl font-black uppercase tracking-[0.5em]">System Idle</p>
              </div>
            )}
            
            {/* FLOATING COPILOT TRIGGER (START CLUSTER: RE-OPEN BUTTON) */}
            {assistantCollapsed && (
              <button 
                onClick={() => setAssistantCollapsed(false)}
                className="absolute bottom-6 right-6 w-12 h-12 rounded-full bg-indigo-600 text-white shadow-2xl shadow-indigo-500/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-[60] border border-white/10 group overflow-hidden"
                title="Open Neural Copilot"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <i className="fa-solid fa-sparkles text-lg animate-pulse" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#030712] shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              </button>
            )}
            {/* END CLUSTER */}
          </div>
        </div>

        {/* 4. NEURAL COPILOT PANEL (FIREBASE/VSCODE INSPIRED) */}
        {!assistantCollapsed && (
          <div className="border-l flex flex-col shrink-0 relative bg-black/20" style={{ width: rightPanelWidth, borderColor: 'var(--border)' }}>
            <div 
              onMouseDown={() => { isResizingRightPanel.current = true; document.body.style.cursor = 'col-resize'; }}
              className="absolute left-0 top-0 bottom-0 w-[2px] cursor-col-resize hover:bg-indigo-500/50 z-50 transition-colors" 
              style={{ backgroundColor: 'var(--border)' }}
            />
            
            <div className="h-10 flex border-b bg-black/40 shrink-0" style={{ borderColor: 'var(--border)' }}>
               {[
                 { id: 'chat', label: 'Chat', icon: 'fa-message' },
                 { id: 'context', label: 'Context', icon: 'fa-folder-tree' },
                 { id: 'mcp', label: 'MCP', icon: 'fa-network-wired' },
                 { id: 'engine', label: 'Engine', icon: 'fa-sliders' }
               ].map(tab => (
                 <button 
                  key={tab.id}
                  onClick={() => setCopilotTab(tab.id as CopilotTab)}
                  className={`flex-1 h-full flex items-center justify-center transition-all ${copilotTab === tab.id ? 'text-white border-b-2' : 'opacity-40 hover:opacity-100'}`}
                  style={{ borderBottomColor: copilotTab === tab.id ? 'var(--accent)' : 'transparent' }}
                 >
                   <i className={`fa-solid ${tab.icon} text-[11px] mr-2`} style={{ color: copilotTab === tab.id ? 'var(--accent)' : 'inherit' }} />
                   <span className="text-[10px] font-black uppercase tracking-widest hidden lg:block">{tab.label}</span>
                 </button>
               ))}
               <button onClick={() => setAssistantCollapsed(true)} className="w-10 h-full text-slate-600 hover:text-white transition-all"><i className="fa-solid fa-xmark text-xs" /></button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col bg-black/10">
               {copilotTab === 'chat' && (
                 <div className="flex flex-col h-full">
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                       {messages.map((m, i) => (
                         <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} space-y-1 animate-fade-in`}>
                            <div className="flex items-center space-x-2 mb-1 px-1">
                               <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{m.role}</span>
                               <span className="text-[8px] text-slate-700">{m.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div className={`p-4 rounded-2xl text-[12px] leading-relaxed max-w-[90%] border ${
                              m.role === 'user' 
                                ? 'bg-indigo-600 text-white border-indigo-400/30' 
                                : 'bg-slate-900/50 text-slate-200 border-white/5'
                            }`}>
                               {m.content}
                            </div>
                         </div>
                       ))}
                       {isSending && (
                         <div className="flex flex-col items-start space-y-1 animate-pulse">
                            <div className="flex items-center space-x-2 mb-1 px-1">
                               <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Assistant</span>
                            </div>
                            <div className="p-4 rounded-2xl bg-slate-900/50 border border-white/5 flex items-center space-x-2">
                               <div className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce"></div>
                               <div className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                               <div className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                            </div>
                         </div>
                       )}
                       <div ref={chatEndRef} />
                    </div>
                    
                    <div className="p-4 border-t bg-black/40 backdrop-blur-md" style={{ borderColor: 'var(--border)' }}>
                       <div className="mb-2 flex flex-wrap gap-1">
                          {selectedContextFiles.map(path => (
                             <div key={path} className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-[9px] font-black uppercase text-indigo-400 flex items-center space-x-1">
                                <span>{path.split('/').pop()}</span>
                                <button onClick={() => setSelectedContextFiles(prev => prev.filter(p => p !== path))} className="hover:text-white"><i className="fa-solid fa-times" /></button>
                             </div>
                          ))}
                       </div>
                       <div className="relative group">
                          <textarea 
                            value={chatInput}
                            onChange={e => setChatInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                            placeholder="Ask Copilot about your code..."
                            className="w-full border rounded-2xl p-4 text-[12px] outline-none min-h-[60px] max-h-[200px] resize-none pr-12 bg-black/40 focus:border-indigo-500/50 transition-all font-medium leading-relaxed"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-main)' }}
                          />
                          <button 
                            onClick={handleSendMessage}
                            disabled={isSending || !chatInput.trim()}
                            className="absolute right-3 bottom-4 w-8 h-8 rounded-full flex items-center justify-center transition-all bg-indigo-600 text-white shadow-lg active:scale-90 disabled:opacity-30" 
                            style={{ backgroundColor: 'var(--accent)' }}
                          >
                            <i className="fa-solid fa-arrow-up text-xs" />
                          </button>
                       </div>
                    </div>
                 </div>
               )}

               {copilotTab === 'context' && (
                 <div className="h-full flex flex-col p-6 space-y-6 animate-fade-in overflow-y-auto custom-scrollbar">
                    <div className="space-y-1">
                       <h3 className="text-sm font-black uppercase text-white tracking-tight">File Context</h3>
                       <p className="text-[10px] text-slate-500 font-medium">Select sources to include in the intelligence buffer.</p>
                    </div>
                    <div className="space-y-1">
                       {files.map(f => (
                         <button 
                           key={f.path}
                           onClick={() => setSelectedContextFiles(prev => prev.includes(f.path) ? prev.filter(p => p !== f.path) : [...prev, f.path])}
                           className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                             selectedContextFiles.includes(f.path) ? 'bg-indigo-600/10 border-indigo-500/40 text-white' : 'bg-black/20 border-white/5 text-slate-400 hover:border-white/10'
                           }`}
                         >
                            <div className="flex items-center space-x-3">
                               <i className={`${getIconForFile(f.path)} text-xs`} />
                               <span className="text-[11px] font-bold truncate">{f.path}</span>
                            </div>
                            {selectedContextFiles.includes(f.path) && <i className="fa-solid fa-circle-check text-indigo-400 text-[10px]" />}
                         </button>
                       ))}
                    </div>
                 </div>
               )}

               {copilotTab === 'mcp' && (
                 <div className="h-full flex flex-col p-6 space-y-6 animate-fade-in overflow-y-auto custom-scrollbar">
                    <div className="space-y-1">
                       <h3 className="text-sm font-black uppercase text-white tracking-tight">MCP Hub</h3>
                       <p className="text-[10px] text-slate-500 font-medium">Model Context Protocol Servers and active node tools.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                       {[
                         { id: 'fs', name: 'File System Bridge', status: 'Active', icon: 'fa-folder-open', color: 'text-emerald-500' },
                         { id: 'web', name: 'Search Grounding', status: 'Standby', icon: 'fa-globe', color: 'text-slate-500' },
                         { id: 'git', name: 'Git Protocol', status: 'Active', icon: 'fa-code-branch', color: 'text-emerald-500' },
                         { id: 'debug', name: 'Runtime Debugger', status: 'Offline', icon: 'fa-play', color: 'text-red-500' }
                       ].map(mcp => (
                         <div key={mcp.id} className="p-4 rounded-xl border border-white/5 bg-black/20 flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                               <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
                                  <i className={`fa-solid ${mcp.icon}`} />
                               </div>
                               <div>
                                  <div className="text-[11px] font-black uppercase text-white">{mcp.name}</div>
                                  <div className="text-[9px] font-bold text-slate-600 uppercase">protocol-v2.1</div>
                               </div>
                            </div>
                            <div className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border border-white/5 bg-black/40 ${mcp.color}`}>{mcp.status}</div>
                         </div>
                       ))}
                    </div>
                 </div>
               )}

               {copilotTab === 'engine' && (
                 <div className="h-full flex flex-col p-6 space-y-6 animate-fade-in overflow-y-auto custom-scrollbar">
                    <div className="space-y-1">
                       <h3 className="text-sm font-black uppercase text-white tracking-tight">Intelligence Config</h3>
                       <p className="text-[10px] text-slate-500 font-medium">Configure the backend model powering the assistant.</p>
                    </div>
                    <div className="space-y-4">
                       <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Model Selection</label>
                          <select 
                            value={copilotConfig.model}
                            onChange={e => setCopilotConfig(prev => ({ ...prev, model: e.target.value }))}
                            className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-[11px] text-white outline-none focus:border-indigo-500"
                          >
                             <option value="gemini-3-pro-preview">Gemini 3 Pro (Complex Reasoning)</option>
                             <option value="gemini-3-flash-preview">Gemini 3 Flash (High Velocity)</option>
                             <option value="gemini-2.5-flash-lite-latest">Gemini Lite (Efficiency Mode)</option>
                          </select>
                       </div>
                       <div className="space-y-2">
                          <div className="flex justify-between items-center text-[9px] font-black uppercase text-slate-500">
                             <span>Max Tokens</span>
                             <span className="text-indigo-400">{copilotConfig.maxTokens}</span>
                          </div>
                          <input 
                            type="range" min="1024" max="8192" step="512" 
                            value={copilotConfig.maxTokens} 
                            onChange={e => setCopilotConfig(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
                            className="w-full accent-indigo-500" 
                          />
                       </div>
                       <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
                          <h4 className="text-[10px] font-black text-indigo-400 uppercase mb-2">Capabilities</h4>
                          <ul className="space-y-1">
                             {[
                               { label: 'Deep Manifest Audit', enabled: true },
                               { label: 'Self-Correction Engine', enabled: true },
                               { label: 'Multi-turn Memory', enabled: true },
                               { label: 'Tool Grounding', enabled: false }
                             ].map(cap => (
                               <li key={cap.label} className="flex items-center justify-between text-[10px] font-medium text-slate-400">
                                  <span>{cap.label}</span>
                                  <i className={`fa-solid ${cap.enabled ? 'fa-circle-check text-emerald-500' : 'fa-circle-xmark text-slate-700'}`} />
                               </li>
                             ))}
                          </ul>
                       </div>
                    </div>
                 </div>
               )}
            </div>
          </div>
        )}
      </div>

      {/* 5. STATUS BAR */}
      <div className="h-6 border-t flex items-center justify-between px-3 shrink-0 text-[10px] bg-black/40 font-bold" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
         <div className="flex items-center h-full space-x-4">
            <div className="flex items-center h-full space-x-1.5 px-2 hover:bg-white/5 cursor-pointer text-indigo-400 uppercase font-black"><i className="fa-solid fa-code-branch" /><span>main*</span></div>
            <div className="flex items-center h-full space-x-1.5 px-2 hover:bg-white/5 cursor-pointer opacity-60"><i className="fa-solid fa-rotate" /><span>Synced</span></div>
         </div>
         <div className="flex items-center h-full space-x-4">
            <div className="hover:text-white cursor-pointer uppercase px-2 text-indigo-400 tracking-widest">{activeFile?.language || 'PLAINTEXT'}</div>
            <button className="flex items-center space-x-2 px-6 h-full text-white bg-indigo-600 transition-all font-black uppercase tracking-widest border-l border-white/10 hover:brightness-110">
              <i className="fa-solid fa-download text-[10px]" />
              <span>Build</span>
            </button>
         </div>
      </div>
    </div>
  );
};

export default IDE;
