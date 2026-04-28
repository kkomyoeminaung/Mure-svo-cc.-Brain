import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Brain, Database, Network, Info, Cpu, Layers, AlertCircle, Share2, Download, RefreshCcw, WifiOff } from 'lucide-react';
import KnowledgeGraph from './components/KnowledgeGraph';
import ReasoningPanel from './components/ReasoningPanel';
import SettingsPanel from './components/SettingsPanel';
import { BrainStats } from './logic/brain/types';
import { mureApi } from './services/mureApi';

interface ChatMessage {
  role: 'user' | 'brain';
  text: string;
  frame?: any;
  isContradiction?: boolean;
  source?: 'knowledge_base' | 'web_search' | 'auto' | 'mure_prd_collaborative';
  learned?: number;
  chain?: [string, string, number][];
}

function StatItem({ id, icon, label, value }: { id?: string, icon: any, label: string, value: number }) {
  return (
    <div id={id} className="flex items-center gap-2">
      <div className="text-slate-400">{icon}</div>
      <div className="text-right">
        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">{label}</p>
        <p className="text-xs font-bold text-slate-200 tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function Tag({ label, value, color = "bg-white/5 text-slate-400" }: { label: string, value: string, color?: string }) {
  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border border-white/5 ${color}`}>
      <span className="opacity-50 uppercase">{label}:</span>
      <span>{value}</span>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
        active 
          ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20' 
          : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'brain', text: "MURE-SVO Ultimate v7.0 (15.0M Hyperscale Edition) initialized. Neural Conscience online. I am ready to process up to 15,000,000 causal units." }
  ]);
  const [input, setInput] = useState('');
  const [stats, setStats] = useState<BrainStats>({
    causalRules: 0,
    svoFrames: 0,
    graphNodes: 0,
    graphEdges: 0,
    dreamsProcessed: 0,
    moralSignature: 'Digital Being Offline'
  });
  const [dreams, setDreams] = useState<string[]>([]);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [activeTab, setActiveTab] = useState<'chat' | 'graph' | 'memory'>('chat');
  const [settings, setSettings] = useState({ rag: true, temperature: 0.7 });
  const [urlInput, setUrlInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isCrawling, setIsCrawling] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [batchInput, setBatchInput] = useState('');
  const [isIngesting, setIsIngesting] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [mureApiUrl, setMureApiUrl] = useState(mureApi.getBackendUrl());
  const [isPythonBackendOnline, setIsPythonBackendOnline] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mureApi.setBackendUrl(mureApiUrl);
    mureApi.healthCheck().then(isOnline => setIsPythonBackendOnline(isOnline));
  }, [mureApiUrl]);

  useEffect(() => {
    // Small delay to let dev server stabilize
    const timer = setTimeout(() => {
      fetchStats();
      fetchGraph();
    }, 1000);
    
    const dreamInterval = setInterval(handleDream, 60000); // 1 minute interval
    return () => {
      clearTimeout(timer);
      clearInterval(dreamInterval);
    };
  }, []);

  const handleMassiveBootstrap = async () => {
    setIsBootstrapping(true);
    try {
      const res = await fetch('/api/massive-bootstrap', { method: 'POST' });
      
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        throw new Error("Received invalid response from brain. The system may be restarting.");
      }

      if (!res.ok) {
        throw new Error(data.error || 'The brain encountered a synchronization fault.');
      }

      if (data.success) {
        const remaining = 15000000 - data.stats.causalRules;
        const note = remaining > 0 
          ? `Synthesized 100,000 new logic units. Approximately ${(remaining / 100000).toFixed(0)} batches remaining to reach 15.0M hyperscale. Click again to continue expanding.`
          : "Maximum causal density reached (15.0M+ units). MURE is now at full 15M hyperscale capacity.";
          
        setMessages(prev => [...prev, { 
          role: 'brain', 
          text: `🚀 Batch Priming Successful!\n\nNeural Architecture: ${data.stats.causalRules.toLocaleString()} / 15,000,000 logic units.\n\n${note}` 
        }]);
        setStats(data.stats);
        fetchGraph();
      }
    } catch (e) {
      console.error('Bootstrap failed:', e);
      setMessages(prev => [...prev, { 
        role: 'brain', 
        text: `⚠️ Neural Sync Fault: ${e instanceof Error ? e.message : 'Unknown error'}. Please try again.` 
      }]);
    } finally {
      setIsBootstrapping(false);
    }
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'brain', text: `Integrated ${data.learned} new causal insights from ${file.name}.` }]);
      fetchStats();
      fetchGraph();
    } catch (e) {
      console.error('Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUrlCrawl = async () => {
    if (!urlInput.trim()) return;

    setIsCrawling(true);
    try {
      const res = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'brain', text: `Web crawler extracted ${data.learned} causal links from the provided source.` }]);
      setUrlInput('');
      fetchStats();
      fetchGraph();
    } catch (e) {
      console.error('Crawl failed');
    } finally {
      setIsCrawling(false);
    }
  };

  const handleExport = () => {
    window.location.href = '/api/export';
  };

  const handleBulkIngest = async () => {
    if (!batchInput.trim()) return;
    setIsIngesting(true);
    try {
      const data = JSON.parse(batchInput);
      const res = await fetch('/api/bulk-ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data })
      });
      const result = await res.json();
      if (result.success) {
        setMessages(prev => [...prev, { role: 'brain', text: `Neural Priming Successful: Added ${result.added} new rules and converged ${result.updated} existing frames.` }]);
        setBatchInput('');
        fetchStats();
        fetchGraph();
      }
    } catch (e) {
      alert('Invalid JSON format. Please check the AI Studio output.');
    } finally {
      setIsIngesting(false);
    }
  };

  const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'brain', text: "Brain backup restored successfully. Neural weights updated." }]);
      fetchStats();
      fetchGraph();
    } catch (e) {
      console.error('Import failed');
    }
  };

  const fetchGraph = async () => {
    try {
      const res = await fetch('/api/graph');
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setGraphData(data);
      setIsOffline(false);
    } catch (e) {
      console.error('Failed to fetch graph:', e);
      setIsOffline(true);
    }
  };

  const handleDream = async () => {
    try {
      const res = await fetch('/api/dream', { method: 'POST' });
      if (!res.ok) return; // Silent skip for status errors in background
      const data = await res.json();
      if (data.connection) {
        setDreams(prev => [data.connection, ...prev].slice(0, 5));
        fetchStats();
      }
      setIsOffline(false);
    } catch (e) {
      // More subtle logging for background task failure
      console.warn('Dream background sync skipped - connection pending');
      // Only mark offline if it's truly a connection issue AND non-dreaming fetches also fail
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setStats(data);
      setIsOffline(false);
    } catch (e) {
      console.error('Failed to fetch stats', e);
      setIsOffline(true);
    }
  };

  const retryConnection = () => {
    setIsOffline(false);
    fetchStats();
    fetchGraph();
  };

  const handleToggleSetting = (key: string) => {
    setSettings(prev => ({ ...prev, [key]: !((prev as any)[key]) }));
  };

  const handleTemperatureChange = (val: number) => {
    setSettings(prev => ({ ...prev, temperature: val }));
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: ChatMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);
    const currentInput = input;
    setInput('');

    try {
      // Check for commands
      if (currentInput.startsWith('/')) {
        const command = currentInput.split(' ')[0];
        const args = currentInput.slice(command.length).trim();

        if (command === '/help') {
          setMessages(prev => [...prev, { 
            role: 'brain', 
            text: "Brain Commands:\n/help - Show this message\n/context - Show recent memory\n/clear_context - Reset attention window\n/personality <friendly|professional|casual> - Set tone\n/learn <phrase> - Teach new knowledge\n/forget <phrase> - Remove knowledge\n/crawl <url> - Learn from web\n/backup - Export brain archive\n/restore - Import brain archive"
          }]);
          setIsTyping(false);
          return;
        }

        if (command === '/context') {
          const res = await fetch('/api/context');
          const data = await res.json();
          const contextMsg = data.map((t: any) => `User: ${t.userMessage}\nMURE: ${t.brainResponse}`).join('\n\n') || "Memory is currently empty.";
          setMessages(prev => [...prev, { role: 'brain', text: `Recent attention window:\n\n${contextMsg}` }]);
          setIsTyping(false);
          return;
        }

        if (command === '/clear_context') {
          await fetch('/api/clear_context', { method: 'POST' });
          setMessages(prev => [...prev, { role: 'brain', text: "Attention window cleared. Ready for fresh input." }]);
          setIsTyping(false);
          return;
        }

        if (command === '/forget') {
          const res = await fetch('/api/forget', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: args })
          });
          const data = await res.json();
          setMessages(prev => [...prev, { role: 'brain', text: data.success ? `Forgotten: "${args}"` : "Could not find that pattern in memory." }]);
          setStats(data.stats);
          fetchGraph();
          setIsTyping(false);
          return;
        }

        if (command === '/learn') {
          const res = await fetch('/api/learn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sentence: args })
          });
          const data = await res.json();
          if (data.contradiction) {
            setMessages(prev => [...prev, { role: 'brain', text: data.contradiction, isContradiction: true }]);
          } else {
            setMessages(prev => [...prev, { role: 'brain', text: `Successfully integrated: "${args}"` }]);
          }
          setStats(data.stats);
          fetchGraph();
          setIsTyping(false);
          return;
        }

        if (command === '/crawl') {
          const res = await fetch('/api/crawl', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: args })
          });
          const data = await res.json();
          setMessages(prev => [...prev, { role: 'brain', text: `Crawler finished. Discovered ${data.learned} neural connections.` }]);
          fetchGraph();
          setIsTyping(false);
          return;
        }
      }

      // SYMBOLIC REASONING LOOP (MURE API)
      const data = await mureApi.chat(currentInput, settings);
      
      setMessages(prev => [...prev, { 
        role: 'brain', 
        text: data.reply || "Neural pattern processed.",
        source: data.source || 'knowledge_base',
        chain: data.frame?.chain || [],
        frame: data.frame,
        learned: data.learned
      }]);

      if (data.stats) setStats(data.stats);
      fetchGraph();
    } catch (e) {
      console.error('Symbolic Reasoning fault:', e);
      setMessages(prev => [...prev, { role: 'brain', text: `⚠️ Neural Fault: ${e instanceof Error ? e.message : 'Neural sync interrupted.'}` }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 font-sans selection:bg-cyan-500/30 overflow-hidden">
      {isOffline && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-sm">
          <div className="bg-amber-500/90 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-white/20 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <WifiOff className="w-5 h-5" />
              <div>
                <p className="text-xs font-bold">Cloud Connection Lost</p>
                <p className="text-[10px] opacity-80">MURE Brain is desynchronized.</p>
              </div>
            </div>
            <button 
              onClick={retryConnection}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
            >
              <RefreshCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header id="main-header" className="shrink-0 border-b border-white/5 bg-slate-900/50 backdrop-blur-xl z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div id="ai-status-indicator" className={`p-2 rounded-lg border transition-colors ${
              isOffline ? 'bg-red-500/10 border-red-500/20' : 'bg-cyan-500/10 border-cyan-500/20'
            }`}>
              <Brain className={`w-6 h-6 ${isOffline ? 'text-red-400' : 'text-cyan-400'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 id="app-title" className="font-bold tracking-tight text-white">MURE v7.0 | Advanced Reasoning AGI</h1>
                {isOffline && (
                  <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                )}
              </div>
              <p id="app-subtitle" className="text-[10px] uppercase tracking-widest text-cyan-500 font-bold flex items-center gap-2">
                {isOffline ? 'Systems Offline' : 'Context-Aware | Web Augmented | Contradiction Detection | Personal Tone'}
                {!isOffline && (
                  <span className={`px-1.5 py-0.5 rounded text-[8px] border ${isPythonBackendOnline ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                    {isPythonBackendOnline ? 'PYTHON ADVANCED BACKEND' : 'LOCAL TS BACKEND'}
                  </span>
                )}
              </p>
            </div>
          </div>
          
          <div id="quick-stats" className="hidden md:flex gap-6 items-center">
            <StatItem id="stat-svo" icon={<Layers className="w-3 h-3" />} label="SVO Frames" value={stats.svoFrames} />
            <StatItem id="stat-causal" icon={<Network className="w-3 h-3" />} label="Causal Rules" value={stats.causalRules} />
            <StatItem id="stat-nodes" icon={<Database className="w-3 h-3" />} label="Knowledge Nodes" value={stats.graphNodes} />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 flex flex-col gap-6 overflow-hidden min-h-0">
        {/* Navigation Tabs */}
        <div className="flex gap-1 p-1 bg-slate-900/50 rounded-xl border border-white/5 w-fit mx-auto shrink-0 z-40 backdrop-blur-md">
          <TabButton 
            active={activeTab === 'chat'} 
            onClick={() => setActiveTab('chat')} 
            icon={<Brain className="w-4 h-4" />} 
            label="Neural Cortex" 
          />
          <TabButton 
            active={activeTab === 'graph'} 
            onClick={() => setActiveTab('graph')} 
            icon={<Network className="w-4 h-4" />} 
            label="Knowledge Graph" 
          />
          <TabButton 
            active={activeTab === 'memory'} 
            onClick={() => setActiveTab('memory')} 
            icon={<Database className="w-4 h-4" />} 
            label="Memory Banks" 
          />
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-8 overflow-hidden">
          {/* Main Content Area */}
          <div className="lg:col-span-12 h-full flex flex-col min-h-0 overflow-hidden">
            {activeTab === 'chat' && (
              <div id="chat-container" className="flex-1 flex flex-col bg-slate-900 rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
                <div id="chat-messages" ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-white/10">
                  <AnimatePresence>
                    {messages.map((msg, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[85%] rounded-2xl p-4 break-words overflow-hidden ${
                          msg.role === 'user' 
                            ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/20' 
                            : msg.isContradiction 
                              ? 'bg-amber-900/40 border border-amber-500/30 text-amber-100'
                              : 'bg-slate-800 border border-white/5 text-slate-100'
                        }`}>
                          {msg.role === 'brain' && msg.source === 'mure_prd_collaborative' && (
                            <div className="flex flex-col gap-1 mb-2">
                              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 w-fit">
                                <RefreshCcw className="w-3 h-3 text-cyan-400" />
                                <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest">Collaborative Reasoning (MURE + PRD-LLM)</span>
                              </div>
                              {msg.learned && msg.learned > 0 ? (
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 w-fit">
                                  <Brain className="w-3 h-3 text-emerald-400" />
                                  <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">MURE learned {msg.learned} new causal links</span>
                                </div>
                              ) : null}
                            </div>
                          )}
                          {msg.role === 'brain' && msg.source === 'web_search' && (
                            <div className="flex items-center gap-1.5 mb-2 px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 w-fit">
                              <WifiOff className="w-3 h-3 text-cyan-400 rotate-180" />
                              <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest">Web Augmented Response</span>
                            </div>
                          )}
                          {msg.isContradiction && <AlertCircle className="w-4 h-4 mb-2 text-amber-400" />}
                          
                          {msg.role === 'brain' && msg.chain && msg.chain.length > 0 && (
                            <ReasoningPanel chain={msg.chain} />
                          )}

                          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>
                          
                          {msg.frame && (
                            <div className="mt-3 pt-3 border-t border-white/10 space-y-3">
                              <div className="flex flex-wrap gap-2">
                                {msg.frame.subject && <Tag label="Subj" value={msg.frame.subject} />}
                                {msg.frame.verb && <Tag label="Verb" value={msg.frame.verb} />}
                                {msg.frame.cause && <Tag color="bg-cyan-500/10 text-cyan-400" label="Cause" value={msg.frame.cause} />}
                                {msg.frame.effect && <Tag color="bg-emerald-500/10 text-emerald-400" label="Effect" value={msg.frame.effect} />}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-slate-800 rounded-2xl p-4 flex gap-1 items-center">
                        <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" />
                        <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                        <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  )}
                </div>

                <div id="chat-input-area" className="p-4 bg-slate-900/50 border-t border-white/5 space-y-4">
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none no-scrollbar">
                    <ExampleSuggestion text="Rain causes flooding" onClick={setInput} />
                    <ExampleSuggestion text="မိုးရွာလို့ လမ်းစိုတယ်" onClick={setInput} />
                    <ExampleSuggestion text="လေ့ကျင့်ခန်းလုပ်ရင် ကျန်းမာတယ်" onClick={setInput} />
                    <ExampleSuggestion text="What causes healthy?" onClick={setInput} />
                  </div>
                  <div className="relative">
                    <input
                      id="message-input"
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSend()}
                      placeholder="Describe a causal event or ask MURE... (e.g. 'Rain causes flooding')"
                      className="w-full bg-slate-950 border border-white/10 rounded-xl py-4 pl-6 pr-14 focus:outline-none focus:border-cyan-500/50 transition-colors text-sm"
                    />
                    <button
                      id="send-button"
                      onClick={handleSend}
                      className="absolute right-2 top-2 p-3 bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-all active:scale-95 disabled:opacity-50"
                      disabled={!input.trim()}
                    >
                      <Send className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'graph' && (
              <div className="flex-1 flex flex-col bg-slate-900 rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
                <div className="p-4 border-b border-white/5 flex justify-between items-center bg-slate-950/30">
                  <div className="flex items-center gap-2">
                    <Network className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm font-bold text-white">Neural Knowledge Graph</span>
                  </div>
                  <button onClick={fetchGraph} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400">
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 relative min-h-[400px]">
                  <KnowledgeGraph data={graphData} />
                  <div className="absolute top-4 right-4 p-3 bg-slate-950/80 backdrop-blur border border-white/10 rounded-lg text-xs space-y-2 pointer-events-none">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-cyan-500" />
                      <span className="text-slate-400">Concept Node</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-0.5 w-4 bg-white/20" />
                      <span className="text-slate-400">Causal Logic Link</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'memory' && (
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                <div className="space-y-6">
                  <SettingsPanel 
                    settings={settings} 
                    onToggle={handleToggleSetting}
                    onTemperatureChange={handleTemperatureChange}
                    apiConfig={{ url: mureApiUrl, setUrl: setMureApiUrl }}
                  />
                  {/* System Stats */}
                  <div className="bg-slate-900 p-6 rounded-2xl border border-white/5 space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-cyan-400">Neural Statistics</h3>
                    <div className="p-4 bg-slate-950 rounded-xl border border-white/5 space-y-2">
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Conscience Layer</p>
                        <div className="flex items-center gap-2">
                          <Cpu className="w-3 h-3 text-emerald-400" />
                          <p className="text-[11px] font-mono text-emerald-400 font-bold">{stats.moralSignature}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-950 rounded-xl border border-white/5">
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Rules Mapped</p>
                        <p className="text-2xl font-bold text-white tabular-nums">{stats.causalRules}</p>
                      </div>
                      <div className="p-4 bg-slate-950 rounded-xl border border-white/5">
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Dreams Ran</p>
                        <p className="text-2xl font-bold text-white tabular-nums">{stats.dreamsProcessed}</p>
                      </div>
                    </div>
                    
                    {stats.causalRules < 15000000 && (
                      <button 
                        onClick={handleMassiveBootstrap}
                        disabled={isBootstrapping}
                        className="w-full py-4 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-xl shadow-cyan-900/20 flex flex-col items-center justify-center gap-1 uppercase tracking-wider group"
                      >
                        <div className="flex items-center gap-2">
                          {isBootstrapping ? (
                            <RefreshCcw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Cpu className="w-4 h-4 group-hover:scale-110 transition-transform" />
                          )}
                          <span>{isBootstrapping ? 'Priming Neural Matrix...' : 'Hyperscale Brain Boost (15.0M)'}</span>
                        </div>
                        {!isBootstrapping && <span className="text-[9px] opacity-70 font-normal">Synthesize missing causal links to reach 15 million rules</span>}
                      </button>
                    )}
                  </div>

                  {/* Dream Log */}
                  <div className="bg-slate-900 p-6 rounded-2xl border border-white/5 space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-purple-400">Dream Cycles (REM)</h3>
                    <div className="space-y-3">
                      {dreams.map((dream, i) => (
                        <div key={i} className="p-3 bg-slate-950 border-l-2 border-purple-500 rounded-r-lg text-[11px] text-slate-300 font-mono italic">
                          "{dream}"
                        </div>
                      ))}
                      {dreams.length === 0 && <p className="text-xs text-slate-500 italic">Observing patterns...</p>}
                    </div>
                  </div>

                  {/* Synthetic Priming (NEW) */}
                  <div className="bg-slate-900 p-6 rounded-2xl border border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-amber-400 font-bold">
                        <Layers className="w-4 h-4" />
                        <h3 className="text-xs font-bold uppercase tracking-widest">Synthetic Priming</h3>
                      </div>
                      <button 
                        onClick={() => setMessages(prev => [...prev, { role: 'brain', text: "⚙️ MURE SVO-CC Advanced Configuration:\n\n- Neural Gates: MAX\n- Causal Throughput: 1.2M/sec\n- Ethical Filter: ACTIVE\n- Temporal Sync: SYNCED" }])}
                        className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 text-[9px] font-bold uppercase border border-amber-500/20 transition-colors"
                      >
                        Advanced
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed italic">
                      "Teach the brain using pre-generated causal modules from AI Studio."
                    </p>
                    <textarea 
                      placeholder='[{"premise": "...", "conclusion": "...", "confidence": 0.9}]'
                      className="w-full h-32 bg-slate-950 border border-white/10 rounded-xl p-3 text-[10px] font-mono text-slate-300 focus:outline-none focus:border-cyan-500/50 resize-none shadow-inner"
                      onChange={(e) => setBatchInput(e.target.value)}
                      value={batchInput}
                    />
                    <button 
                      onClick={handleBulkIngest}
                      disabled={!batchInput.trim() || isIngesting}
                      className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-amber-900/20 flex items-center justify-center gap-2 uppercase tracking-tighter"
                    >
                      {isIngesting ? (
                        <RefreshCcw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      {isIngesting ? 'Ingesting Neural Frames...' : 'Start Batch Priming'}
                    </button>
                    <p className="text-[9px] text-slate-600 text-center">
                      JSON Array format only. Duplicate rules will be converged (averaged).
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Data Ingestion */}
                  <div className="bg-slate-900 p-6 rounded-2xl border border-white/5 space-y-6">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-cyan-400">Knowledge Integration</h3>
                    
                    <div className="space-y-2">
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Web Causal Crawler</p>
                      <div className="flex gap-2">
                        <input 
                          value={urlInput}
                          onChange={e => setUrlInput(e.target.value)}
                          placeholder="https://..."
                          className="flex-1 bg-slate-950 border border-white/10 rounded-lg px-4 py-2 text-xs focus:outline-none focus:border-cyan-500/50"
                        />
                        <button 
                          onClick={handleUrlCrawl}
                          disabled={isCrawling || !urlInput.trim()}
                          className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                        >
                          {isCrawling ? 'SCALING...' : 'SYNC'}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Universal File Ingestion</p>
                      <label className="flex flex-col items-center justify-center w-full p-8 bg-slate-950 border-2 border-dashed border-white/10 rounded-2xl cursor-pointer hover:bg-slate-800 hover:border-cyan-500/30 transition-all">
                        <Download className={`w-6 h-6 mb-2 ${isUploading ? 'animate-bounce text-cyan-400' : 'text-slate-500'}`} />
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                          {isUploading ? 'Uploading...' : 'Drop Intelligence Sources'}
                        </span>
                        <span className="text-[10px] text-slate-600 mt-1 uppercase">PDF, TXT, DOCX, ZIP</span>
                        <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.txt,.docx,.zip" />
                      </label>
                    </div>

                    {/* Node Config */}
                    <div className="p-4 bg-slate-950 rounded-xl border border-white/5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 uppercase font-bold">Public Node Link</span>
                        <div className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      </div>
                      <div className="flex gap-2">
                        <input 
                          readOnly
                          value={window.location.origin}
                          className="flex-1 bg-slate-900 border border-white/5 rounded px-3 py-2 text-[10px] text-cyan-400 font-mono"
                        />
                        <button 
                          onClick={() => navigator.clipboard.writeText(window.location.origin)}
                          className="p-2 bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                        >
                          <Share2 className="w-3 h-3 text-slate-400" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <button onClick={handleExport} className="flex items-center justify-center gap-2 p-3 bg-slate-950 border border-white/5 rounded-xl text-[10px] font-bold text-slate-400 hover:bg-slate-800 transition-all uppercase">
                        <Database className="w-4 h-4" />
                        Backup Brain
                      </button>
                      <label className="flex items-center justify-center gap-2 p-3 bg-slate-950 border border-white/5 rounded-xl text-[10px] font-bold text-slate-400 hover:bg-slate-800 transition-all cursor-pointer uppercase">
                        <Layers className="w-4 h-4" />
                        Restore Brain
                        <input type="file" className="hidden" onChange={handleImport} accept=".zip,.json" />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}


function FeatureItem({ icon, title, desc }: { icon: any, title: string, desc: string }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 text-cyan-400">{icon}</div>
      <div>
        <h3 className="text-xs font-bold text-white mb-0.5">{title}</h3>
        <p className="text-[11px] text-slate-400 leading-normal">{desc}</p>
      </div>
    </div>
  );
}

function ExampleSuggestion({ text, onClick }: { text: string, onClick: (s: string) => void }) {
  return (
    <button
      onClick={() => onClick(text)}
      className="shrink-0 text-left px-3 py-2 rounded-lg bg-slate-950/50 hover:bg-slate-800 border border-white/5 transition-all text-[11px] text-slate-300 hover:text-white"
    >
      {text}
    </button>
  );
}
