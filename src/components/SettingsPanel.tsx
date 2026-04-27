import { Settings, Moon, Sun, Zap, Database, Sliders, Globe, Download, FileCode2 } from 'lucide-react';

export default function SettingsPanel({ 
  settings, 
  onToggle,
  apiConfig
}: { 
  settings: any, 
  onToggle: (key: string) => void,
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
          <div className="space-y-2 p-3 bg-slate-950 rounded-xl border border-white/5">
            <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase font-bold tracking-tighter">
              <Globe className="w-3 h-3" />
              Python Backend API URL (ngrok)
            </div>
            <input 
              value={apiConfig.url}
              onChange={e => apiConfig.setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-cyan-400 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
        )}

        <div className="space-y-2 p-3 bg-slate-950 rounded-xl border border-white/5">
          <div className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter mb-3">
             🎨 LLM AI Fine-Tuning 
          </div>
          <div className="grid grid-cols-2 gap-2">
            <a href="/api/dataset/download" download className="flex items-center justify-center gap-2 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border border-indigo-500/20 px-3 py-2 rounded-lg text-[10px] font-bold uppercase transition flex-1 text-center">
              <Download className="w-3 h-3" />
              Dataset JSONL
            </a>
            <a href="/api/dataset/colab" download className="flex items-center justify-center gap-2 bg-pink-600/20 hover:bg-pink-600/40 text-pink-400 border border-pink-500/20 px-3 py-2 rounded-lg text-[10px] font-bold uppercase transition flex-1 text-center">
              <FileCode2 className="w-3 h-3" />
              Colab Notebook
            </a>
          </div>
          <div className="text-[8px] text-slate-500 mt-2">
            Download the JSONL and Colab Notebook to Auto Fine-tune Unsloth Gemma-2 or Llama-3!
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
            onChange={(e) => {}} // Implementation for update
            className="w-full accent-cyan-500"
          />
        </div>
      </div>
    </div>
  );
}
