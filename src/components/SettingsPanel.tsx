import { Settings, Moon, Cpu, Sun, Zap, Database, Sliders, Globe, Download, FileCode2 } from 'lucide-react';

export default function SettingsPanel({ 
  settings, 
  onToggle,
  onChange,
  onTemperatureChange,
  apiConfig
}: { 
  settings: any, 
  onToggle: (key: string) => void,
  onChange?: (key: string, value: any) => void,
  onTemperatureChange?: (val: number) => void,
  apiConfig?: { url: string, setUrl: (url: string) => void }
}) {
  return (
    <div className="bg-slate-900 p-6 rounded-2xl border border-white/5 space-y-6">
      <div className="flex items-center justify-between text-white">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          <h3 className="text-sm font-bold uppercase tracking-widest">Brain Configuration</h3>
        </div>
      </div>
      
      <div className="space-y-4">
        {apiConfig && (
          <div className="space-y-4">
            <div className="space-y-2 p-3 bg-slate-950 rounded-xl border border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase font-bold tracking-tighter">
                  <Cpu className="w-3 h-3 text-cyan-400" />
                  AI Studio (Local Node.js Backup)
                </div>
                <button 
                  onClick={() => onToggle('useAiStudio')}
                  className={`w-8 h-4 rounded-full transition-colors ${settings.useAiStudio ? 'bg-cyan-600' : 'bg-slate-800'}`}
                />
              </div>
              <p className="text-[9px] text-slate-500 pt-1">
                Turn on to disconnect from Colab Ngrok and use the local Node.js framework in AI Studio.
              </p>
              
              {settings.useAiStudio && (
                <div className="mt-3 space-y-2 pt-3 border-t border-white/5">
                  <div className="text-[9px] uppercase font-bold text-slate-500">Select Notebook Simulation:</div>
                  
                  <label className="flex items-center justify-between cursor-pointer p-2 rounded hover:bg-slate-800/50 transition">
                    <span className="text-[10px] text-slate-300">1. MURE သီးသန့် လုပ်ဆောင်ချက်</span>
                    <input type="radio" name="aiStudioModel" value="mure_only" checked={settings.aiStudioModel === 'mure_only'} onChange={() => onChange?.('aiStudioModel', 'mure_only')} className="accent-cyan-500" />
                  </label>
                  
                  <label className="flex items-center justify-between cursor-pointer p-2 rounded hover:bg-slate-800/50 transition">
                    <span className="text-[10px] text-slate-300">2. MURE + Sentence Based LLM (Mock)</span>
                    <input type="radio" name="aiStudioModel" value="mure_sentence" checked={settings.aiStudioModel === 'mure_sentence'} onChange={() => onChange?.('aiStudioModel', 'mure_sentence')} className="accent-cyan-500" />
                  </label>
                  
                  <label className="flex items-center justify-between cursor-pointer p-2 rounded hover:bg-slate-800/50 transition">
                    <span className="text-[10px] text-slate-300">3. MURE + Qwen 7B PRD LLM (Mock)</span>
                    <input type="radio" name="aiStudioModel" value="mure_prd" checked={settings.aiStudioModel === 'mure_prd'} onChange={() => onChange?.('aiStudioModel', 'mure_prd')} className="accent-cyan-500" />
                  </label>
                </div>
              )}
            </div>

            {!settings.useAiStudio && (
              <div className="space-y-2 p-3 bg-slate-950 rounded-xl border border-white/5">
                <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase font-bold tracking-tighter">
                  <Globe className="w-3 h-3 text-emerald-400" />
                  Python Backend API URL (ngrok)
                </div>
                <input 
                  value={apiConfig.url}
                  onChange={e => apiConfig.setUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-mono text-cyan-400 focus:outline-none focus:border-cyan-500/50"
                />
                <p className="text-[8px] text-slate-500">Connecting to Colab...</p>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2 p-3 bg-slate-950 rounded-xl border border-white/5">
          <div className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter mb-3">
             🌌 MURE Master Auto-Pipeline
          </div>
          <div className="grid grid-cols-2 gap-2">
            <a href="/api/dataset/download" download className="flex items-center justify-center gap-2 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border border-indigo-500/20 px-3 py-2 rounded-lg text-[10px] font-bold uppercase transition flex-1 text-center">
              <Download className="w-3 h-3" />
              15M Dataset JSONL
            </a>
            <a href="/api/dataset/colab" download className="flex items-center justify-center gap-2 bg-pink-600/20 hover:bg-pink-600/40 text-pink-400 border border-pink-500/20 px-3 py-2 rounded-lg text-[10px] font-bold uppercase transition flex-1 text-center">
              <FileCode2 className="w-3 h-3" />
              Master Colab (v7.3)
            </a>
          </div>
          <div className="text-[8px] text-slate-500 mt-2">
            Download the Official MURE-AGI Master Colab to auto-train, synchronize logic, and serve the API via 1-Click Ngrok Tunnel natively!
          </div>
        </div>

        {/* Toggle Settings */}
        <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-white/5">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Database className="w-4 h-4" />
            RAG Integration
          </div>
          <button 
            onClick={() => onToggle('rag')}
            className={`w-10 h-5 rounded-full transition-colors ${settings.rag ? 'bg-cyan-600' : 'bg-slate-800'}`}
          />
        </div>

        {/* Sliders */}
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] text-slate-500 uppercase font-bold">
            <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Temperature</span>
            <span>{settings.temperature}</span>
          </div>
          <input 
            type="range" 
            min="0" max="1" step="0.1"
            value={settings.temperature}
            onChange={(e) => onTemperatureChange?.(parseFloat(e.target.value))}
            className="w-full accent-cyan-500"
          />
        </div>
      </div>
    </div>
  );
}
