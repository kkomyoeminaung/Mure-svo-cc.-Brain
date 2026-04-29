const fs = require('fs');
let data = JSON.parse(fs.readFileSync('distillation_notebook.ipynb', 'utf8'));

data.cells.forEach(c => {
    if (c.cell_type === 'code') {
        c.source = c.source.map(line => {
            return line.replace(/load_dataset\('wikitext', 'wikitext-103-v1'/g, 
                                "load_dataset('allenai/c4', 'en'");
        });
        
        // Also let's add HF_HUB_DISABLE_AUTHENTICATION=1 to the first cell
        if (c.source.join('').includes('import os')) {
            if (!c.source.join('').includes('HF_HUB_DISABLE_AUTHENTICATION')) {
                c.source.unshift('os.environ["HF_HUB_DISABLE_AUTHENTICATION"] = "1"\n');
                c.source.unshift('import os\n');
            }
        }
    }
});

fs.writeFileSync('distillation_notebook.ipynb', JSON.stringify(data, null, 1));
console.log('Fixed dataset script error');
