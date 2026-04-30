const fs = require('fs');

if (fs.existsSync('run_mure_colab.py')) {
    let content = fs.readFileSync('run_mure_colab.py', 'utf8');
    content = "from sentence_llm_3b.models.graph_network import CompleteSentenceLLM\n" + content.replace(/\s*from sentence_llm_3b\.models\.graph_network import CompleteSentenceLLM\n/g, '\n');
    fs.writeFileSync('run_mure_colab.py', content);
}

if (fs.existsSync('sentence_llm_3b/data/loader.py')) {
    let content = fs.readFileSync('sentence_llm_3b/data/loader.py', 'utf8');
    content = "import random\n" + content.replace(/\s*import random\n/g, '\n');
    fs.writeFileSync('sentence_llm_3b/data/loader.py', content);
}

['test.py', 'test11.py', 'test3.py', 'test_compile.py', 'test_distill.py'].forEach(f => {
    if (fs.existsSync(f)) {
        let content = fs.readFileSync(f, 'utf8');
        content = "import torch\nfrom datasets import load_dataset\n" + content.replace(/\s*import torch\n/g, '\n').replace(/\s*from datasets import load_dataset\n/g, '\n');
        fs.writeFileSync(f, content);
    }
});
console.log('✅ Moved imports to top level.');
