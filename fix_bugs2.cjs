const fs = require('fs');
const path = require('path');

console.log('--- STARTING BUG FIXES ---');

// 1. Create missing init files
const dirsToInit = [
  'mure_python', 'prd_llm', 'prd_llm/brain', 'prd_llm/reasoner',
  'prd_llm/ingestion', 'prd_llm/storage', 'mure_agi', 'sentence_llm_3b', 'sentence_llm_3b/models', 'sentence_llm_3b/data'
];
dirsToInit.forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive: true});
  const initPath = path.join(dir, '__init__.py');
  if (!fs.existsSync(initPath)) fs.writeFileSync(initPath, '');
});
console.log('✅ Created __init__.py files');

// 2. Fix run_mure_colab.py
if (fs.existsSync('run_mure_colab.py')) {
  let content = fs.readFileSync('run_mure_colab.py', 'utf8');
  content = content.replace(
    /with open\(RULES_PATH, 'r'\) as f:\s*rules = json.load\(f\)/g,
    "with open(RULES_PATH, 'r', encoding='utf-8') as f:\n        data = json.load(f)\n    rules = data.get('causalMemory', []) if isinstance(data, dict) else data"
  );
  content = content.replace(
    /with open\(RULES_PATH, 'r'\) as f:\s*rules\s*=\s*json\.load\([^)]*\)/g,
    "with open(RULES_PATH, 'r', encoding='utf-8') as f:\n        data = json.load(f)\n    rules = data.get('causalMemory', []) if isinstance(data, dict) else data"
  );
  fs.writeFileSync('run_mure_colab.py', content);
}
console.log('✅ Fixed run_mure_colab.py');

// 3. Fix sentence_llm_3b/data/loader.py
const loaderPath = 'sentence_llm_3b/data/loader.py';
if (fs.existsSync(loaderPath)) {
  let content = fs.readFileSync(loaderPath, 'utf8');
  content = content.replace(
    /with open\(self\.rules_path, 'r', encoding='utf-8'\) as f:\s*all_rules = json.load\(f\)/g,
    "with open(self.rules_path, 'r', encoding='utf-8') as f:\n            data = json.load(f)\n        all_rules = data.get('causalMemory', []) if isinstance(data, dict) else data"
  );
  content = content.replace(
    /with open\(self\.rules_path, 'r'\) as f:\s*all_rules = json.load\(f\)/g,
    "with open(self.rules_path, 'r', encoding='utf-8') as f:\n            data = json.load(f)\n        all_rules = data.get('causalMemory', []) if isinstance(data, dict) else data"
  );
  fs.writeFileSync(loaderPath, content);
}
console.log('✅ Fixed sentence_llm_3b/data/loader.py');

// 4. Fix gen_notebook.py
if (fs.existsSync('gen_notebook.py')) {
    let content = fs.readFileSync('gen_notebook.py', 'utf8');
    content = content.replace(
        /"with open\(path, 'r'\) as f: self\.rules = json.load\(f\)\n"/g,
        "\"with open(path, 'r', encoding='utf-8') as f:\\n\",\n            \"    data = json.load(f)\\n\",\n            \"self.rules = data.get('causalMemory', []) if isinstance(data, dict) else data\\n\""
    );
    fs.writeFileSync('gen_notebook.py', content);
}
console.log('✅ Fixed gen_notebook.py');

// 5. Fix setup_colab_env.py
if (fs.existsSync('setup_colab_env.py')) {
    let content = fs.readFileSync('setup_colab_env.py', 'utf8');
    content = content.replace(
        /with open\(RULES_FILE, 'w'\) as f:\s*json\.dump\(\[\], f\)/g,
        "with open(RULES_FILE, 'w', encoding='utf-8') as f:\n        json.dump({\"causalMemory\": [], \"svoMemory\": [], \"knowledgeGraph\": []}, f, indent=2, ensure_ascii=False)"
    );
    fs.writeFileSync('setup_colab_env.py', content);
}
console.log('✅ Fixed setup_colab_env.py');

// 6. Fix test_compile.py
if (fs.existsSync('test_compile.py')) {
    let content = fs.readFileSync('test_compile.py', 'utf8');
    content = content.replace(
        /prompt = f"\"\"Extract cause-and-effect rules\.\.\.Text: \{chunk\}\\"\"/g,
        'prompt = f"Extract cause-and-effect rules. Output ONLY a valid JSON array with \'cause\' and \'effect\' keys.\nText: {chunk}"'
    );
    fs.writeFileSync('test_compile.py', content);
}
console.log('✅ Fixed test_compile.py');

// 7. Fix MURE_LLM_FINETUNE.ipynb
if (fs.existsSync('MURE_LLM_FINETUNE.ipynb')) {
    let data = JSON.parse(fs.readFileSync('MURE_LLM_FINETUNE.ipynb', 'utf8'));
    data.cells.forEach(c => {
        if (c.cell_type === 'code') {
            let str = c.source.join('');
            if (str.includes('%%capture') && !c.source[0].startsWith('%%capture')) {
                let idx = c.source.findIndex(l => l.includes('%%capture'));
                if (idx > 0) {
                    c.source.splice(idx, 1);
                    c.source.unshift('%%capture\n');
                }
            }
            if (str.includes('SFTTrainer') && str.includes('dataset_text_field')) {
                c.source = [ `import trl\n`,
`TRL_VER = tuple(int(x) for x in trl.__version__.split('.')[:2])\n`,
`if TRL_VER >= (0, 9):\n`,
`    from trl import SFTTrainer, SFTConfig\n`,
`    from transformers import TrainingArguments\n`,
`    sft_cfg = SFTConfig(\n`,
`        dataset_text_field='text',\n`,
`        max_seq_length=MAX_SEQ_LENGTH,\n`,
`        dataset_num_proc=2,\n`,
`        packing=True,\n`,
`        output_dir='/content/mure_ckpt',\n`,
`        per_device_train_batch_size=2,\n`,
`        gradient_accumulation_steps=4,\n`,
`        learning_rate=2e-4,\n`,
`        num_train_epochs=1,\n`,
`        fp16=not is_bfloat16_supported(),\n`,
`        bf16=is_bfloat16_supported(),\n`,
`        logging_steps=50,\n`,
`        optim='adamw_8bit',\n`,
`        lr_scheduler_type='cosine',\n`,
`        seed=3407,\n`,
`        report_to='none',\n`,
`    )\n`,
`    trainer = SFTTrainer(model=model, tokenizer=tokenizer, train_dataset=dataset, args=sft_cfg)\n`,
`else:\n`,
`    from trl import SFTTrainer\n`,
`    from transformers import TrainingArguments\n`,
`    trainer = SFTTrainer(\n`,
`        model=model,\n`,
`        tokenizer=tokenizer,\n`,
`        train_dataset=dataset,\n`,
`        dataset_text_field='text',\n`,
`        max_seq_length=MAX_SEQ_LENGTH,\n`,
`        dataset_num_proc=2,\n`,
`        packing=True,\n`,
`        args=TrainingArguments(\n`,
`            output_dir='/content/mure_ckpt',\n`,
`            per_device_train_batch_size=2,\n`,
`            gradient_accumulation_steps=4,\n`,
`            num_train_epochs=1,\n`,
`            learning_rate=2e-4,\n`,
`            fp16=not is_bfloat16_supported(),\n`,
`            bf16=is_bfloat16_supported(),\n`,
`            logging_steps=50,\n`,
`            optim='adamw_8bit',\n`,
`            weight_decay=0.01,\n`,
`            lr_scheduler_type='cosine',\n`,
`            seed=3407,\n`,
`            report_to='none',\n`,
`        )\n`,
`    )\n`];
            }
            if (str.includes('model.generate') && !str.includes('eos_token_id')) {
                c.source = c.source.map(line => line.includes('model.generate(') ? line.replace('model.generate(', 'model.generate(eos_token_id=tokenizer.eos_token_id, pad_token_id=tokenizer.eos_token_id, ') : line);
            }
        }
    });
    fs.writeFileSync('MURE_LLM_FINETUNE.ipynb', JSON.stringify(data, null, 1));
}
console.log('✅ Fixed MURE_LLM_FINETUNE.ipynb');

// 8. Fix MURE_OneClick_FineTune.ipynb
if (fs.existsSync('MURE_OneClick_FineTune.ipynb')) {
    let data = JSON.parse(fs.readFileSync('MURE_OneClick_FineTune.ipynb', 'utf8'));
    data.cells.forEach(c => {
        if (c.cell_type === 'code') {
            let str = c.source.join('');
            if (str.includes('json.load')) {
                c.source = c.source.map(line => {
                    if (line.includes('MURE_RULES = json.load(f)')) {
                        return "        data = json.load(f)\n        MURE_RULES = data.get('causalMemory', []) if isinstance(data, dict) else data\n";
                    }
                    if (line.includes('open(rules_path')) {
                        return line.replace(/open\(rules_path,\s*'r'\)/g, "open(rules_path, 'r', encoding='utf-8')");
                    }
                    return line;
                });
            }
        }
    });
    fs.writeFileSync('MURE_OneClick_FineTune.ipynb', JSON.stringify(data, null, 1));
}
console.log('✅ Fixed MURE_OneClick_FineTune.ipynb');

// 9. Fix MURE_PRD_Merged_v3.ipynb (warn about eos_token)
if (fs.existsSync('MURE_PRD_Merged_v3.ipynb')) {
    let data = JSON.parse(fs.readFileSync('MURE_PRD_Merged_v3.ipynb', 'utf8'));
    data.cells.forEach(c => {
        if (c.cell_type === 'code') {
            let str = c.source.join('');
            if (str.includes('model.generate') && !str.includes('eos_token_id')) {
                c.source = c.source.map(line => line.includes('model.generate(') ? line.replace('model.generate(', 'model.generate(eos_token_id=tokenizer.eos_token_id, pad_token_id=tokenizer.eos_token_id, ') : line);
            }
        }
    });
    fs.writeFileSync('MURE_PRD_Merged_v3.ipynb', JSON.stringify(data, null, 1));
}
console.log('✅ Fixed MURE_PRD_Merged_v3.ipynb');

console.log('✅ DONE.');
