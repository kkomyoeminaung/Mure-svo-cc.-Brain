const fs = require('fs');

function fixFile(path, regexes) {
    if (!fs.existsSync(path)) return;
    let content = fs.readFileSync(path, 'utf8');
    for (const {match, replace} of regexes) {
        content = content.replace(match, replace);
    }
    fs.writeFileSync(path, content);
}

const encRegex = [
    { match: /open\(([^,]+),\s*'r'\)/g, replace: "open($1, 'r', encoding='utf-8')" },
    { match: /open\(([^,]+),\s*'w'\)/g, replace: "open($1, 'w', encoding='utf-8')" }
];

fixFile('prd_llm/reasoner/mure_engine.py', encRegex);
fixFile('prd_llm/ingestion/ingestion.py', encRegex);
fixFile('prd_llm/storage/knowledge_db.py', encRegex);
fixFile('mure_python/reasoner.py', encRegex);
fixFile('generate_2m_dataset.py', encRegex);

if (fs.existsSync('prd_llm/ingestion/ingestion.py')) {
    let content = fs.readFileSync('prd_llm/ingestion/ingestion.py', 'utf8');
    content = content.replace("self.mure_engine.add_rule(rule['cause'], rule['effect'], rule['confidence'], rule['source'])", 
        "score = rule.get('strength', rule.get('confidence', 0.7))\n                self.mure_engine.add_rule(rule['cause'], rule['effect'], score, rule.get('source', 'unknown'))");
    fs.writeFileSync('prd_llm/ingestion/ingestion.py', content);
}

['mure_agi/context_memory.py', 'test.py', 'test11.py', 'test3.py', 'test_compile.py', 'test_distill.py'].forEach(f => fixFile(f, [{match: /except:/g, replace: 'except Exception:'}]));

if (fs.existsSync('prd_llm/storage/knowledge_db.py')) {
    let content = fs.readFileSync('prd_llm/storage/knowledge_db.py', 'utf8');
    content = "import os\nimport json\n" + content.replace(/\s*import os\n/g, "\n").replace(/\s*import json\n/g, "\n");
    fs.writeFileSync('prd_llm/storage/knowledge_db.py', content);
}

if (fs.existsSync('prd_llm/ingestion/ingestion.py')) {
    let content = fs.readFileSync('prd_llm/ingestion/ingestion.py', 'utf8');
    content = "import re\n" + content.replace(/\s*import re\n/g, "\n");
    fs.writeFileSync('prd_llm/ingestion/ingestion.py', content);
}

if (fs.existsSync('mure_agi/config.py')) {
    let content = fs.readFileSync('mure_agi/config.py', 'utf8');
    content = content.replace('DRIVE_MOUNT_POINT = "/content/drive"', "import os\n    DRIVE_MOUNT_POINT = os.environ.get('MURE_DRIVE_MOUNT', '/content/drive')");
    content = content.replace('BRAIN_BASE_PATH = "/content/drive/MyDrive/svo cc brain"', "BRAIN_BASE_PATH = os.environ.get('MURE_BRAIN_PATH', '/content/drive/MyDrive/svo cc brain')");
    fs.writeFileSync('mure_agi/config.py', content);
}

if (fs.existsSync('generate_2m_dataset.py')) {
    let content = fs.readFileSync('generate_2m_dataset.py', 'utf8');
    content = content.replace(/os\.path\.join\(os\.path\.dirname\(__file__\), "data\/brain\/rules\.json"\)/g, 'os.path.join(os.getcwd(), "data/brain/rules.json")');
    fs.writeFileSync('generate_2m_dataset.py', content);
}

if (fs.existsSync('src/services/mureApi.ts')) {
    let content = fs.readFileSync('src/services/mureApi.ts', 'utf8');
    content = content.replace("private backendUrl = 'http://localhost:8000';", "private backendUrl = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000';");
    fs.writeFileSync('src/services/mureApi.ts', content);
}

console.log('✅ Fixed encoding & excepts in python files');
