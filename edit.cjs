const fs = require('fs');
let data = JSON.parse(fs.readFileSync('distillation_notebook.ipynb', 'utf8'));

for (let i = 0; i < data.cells.length; i++) {
    let cell = data.cells[i];
    if (cell.cell_type !== 'code') continue;
    
    let source = cell.source.join('');
    
    // Fix load_dataset trust_remote_code
    source = source.replace(/load_dataset\('wikipedia', '20220301.en', split='train', streaming=True\)/g, 
                            "load_dataset('wikipedia', '20220301.en', split='train', streaming=True, trust_remote_code=True)");
    
    // Add pad_token to tokenizer
    if (source.includes('tokenizer = AutoTokenizer.from_pretrained(model_id)')) {
        if (!source.includes('tokenizer.pad_token')) {
            source = source.replace(
                'tokenizer = AutoTokenizer.from_pretrained(model_id)',
                'tokenizer = AutoTokenizer.from_pretrained(model_id)\nif tokenizer.pad_token is None:\n    tokenizer.pad_token = tokenizer.eos_token'
            );
        }
    }
    
    // Fix RuleDataset loading
    if (source.includes("self.data = load_dataset('json', data_files=path, split='train')")) {
        source = source.replace(
            "self.data = load_dataset('json', data_files=path, split='train')",
            "self.data = load_dataset('json', data_files=path, split='train')\n            self.data = self.data.filter(lambda x: x is not None)"
        );
    }
    
    // Remove empty_cache() and use del
    if (source.includes('loss.backward()')) {
        source = source.replace(
            /loss\.backward\(\)\n\s+torch\.cuda\.empty_cache\(\)\n/g,
            "loss.backward()\n"
        );
    }
    
    // Fix __getitem__ bug if empty fallback
    if (source.includes('import torch\n            return torch.zeros')) {
        source = source.replace(
            /import torch\n\s+return torch\.zeros\(128, dtype=torch\.long\), torch\.zeros\(128, dtype=torch\.long\)/g,
            "import torch\n            return torch.zeros(128, dtype=torch.long), torch.zeros(128, dtype=torch.long)"
        );
    }

    // Split back into lines
    let lines = source.split('\n');
    cell.source = lines.map((line, idx) => (idx < lines.length - 1) ? line + '\n' : line);
}

fs.writeFileSync('distillation_notebook.ipynb', JSON.stringify(data, null, 1));
console.log('Notebook updated successfully.');
