const fs = require('fs');
let content = fs.readFileSync('src/components/SettingsPanel.tsx', 'utf8');

if (!content.includes('Cpu,')) {
    content = content.replace('Settings, Moon,', 'Settings, Moon, Cpu,');
}

content = content.replace(
  '{apiConfig && (',
  `{apiConfig && (
          <div className="space-y-2 p-3 bg-slate-950 rounded-xl border border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase font-bold tracking-tighter">
                <Cpu className="w-3 h-3 text-cyan-400" />
                Use Local Mock 3B LLM (No Colab)
              </div>
              <button 
                onClick={() => onToggle('mockLlm')}
                className={\`w-8 h-4 rounded-full transition-colors \${settings.mockLlm ? 'bg-cyan-600' : 'bg-slate-800'}\`}
              />
            </div>
            <p className="text-[9px] text-slate-500 pt-1">Test MURE + Sentence LLM UI layout locally without running the Colab backend.</p>
          </div>
        )}
        {apiConfig && (`
);

fs.writeFileSync('src/components/SettingsPanel.tsx', content);
console.log('Settings updated.');
