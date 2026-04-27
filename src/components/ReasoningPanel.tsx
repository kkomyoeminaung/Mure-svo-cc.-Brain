import { GitBranch, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ReasoningPanel({ chain }: { chain: [string, string, number][] }) {
  if (!chain || chain.length === 0) return null;

  return (
    <div className="mt-3 p-4 bg-slate-950 border border-white/10 rounded-xl space-y-3">
      <div className="flex items-center gap-2 text-cyan-400">
        <GitBranch className="w-4 h-4" />
        <span className="text-[10px] font-bold uppercase tracking-wider">Causal Logic Chain</span>
      </div>
      
      <div className="space-y-2 ml-2">
        {chain.map(([cause, effect, conf], i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-600" />
            <span className="text-slate-300">{cause}</span>
            <span className="text-slate-600">→</span>
            <span className="text-white font-bold">{effect}</span>
            <span className="ml-auto text-[9px] text-emerald-500 font-mono">{(conf * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
