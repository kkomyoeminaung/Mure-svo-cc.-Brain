const fs = require('fs');
let data = JSON.parse(fs.readFileSync('distillation_notebook.ipynb', 'utf8'));

data.cells.forEach(c => {
    if (c.cell_type === 'code') {
        c.source = c.source.map(line => {
            // Replace gemma-2 with Qwen2.5-1.5B-Instruct which is completely open and doesn't need login
            line = line.replace(/model_id = "google\/gemma-2-2b-it"/g, 'model_id = "Qwen/Qwen2.5-1.5B-Instruct"');
            line = line.replace(/Loading Teacher \(Gemma\)/g, 'Loading Teacher (Qwen 1.5B Open)');
            return line;
        });
    }
});

fs.writeFileSync('distillation_notebook.ipynb', JSON.stringify(data, null, 1));
console.log('Fixed model to use completely open model');
