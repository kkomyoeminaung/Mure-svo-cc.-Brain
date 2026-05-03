const fs = require('fs');
const path = 'MURE_AUTO_TRAIN_PIPELINE.ipynb';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

data.cells.forEach(cell => {
  if (cell.cell_type === 'code') {
    cell.source = cell.source.map(line => line.replace('lora_dropout=0', 'lora_dropout=0.05'));
  }
});

fs.writeFileSync(path, JSON.stringify(data, null, 2));
