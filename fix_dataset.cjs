const fs = require('fs');
let data = JSON.parse(fs.readFileSync('distillation_notebook.ipynb', 'utf8'));

data.cells.forEach(c => {
    if (c.cell_type === 'code') {
        c.source = c.source.map(line => {
            return line.replace(/load_dataset\('wikipedia', '20220301.en'/g, 
                                "load_dataset('wikimedia/wikipedia', '20231101.en'");
        });
    }
});

fs.writeFileSync('distillation_notebook.ipynb', JSON.stringify(data, null, 1));
console.log('Fixed dataset script error');
