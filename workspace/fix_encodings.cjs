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

// fixing confidence vs strength WARN-14
if (fs.existsSync('prd_llm/ingestion/ingestion.py')) {
    let content = fs.readFileSync('prd_llm/ingestion/ingestion.py', 'utf8');
    content = content.replace("self.mure_engine.add_rule(rule['cause'], rule['effect'], rule['confidence'], rule['source'])", 
        "score = rule.get('strength', rule.get('confidence', 0.7))\n                self.mure_engine.add_rule(rule['cause'], rule['effect'], score, rule.get('source', 'unknown'))");
    fs.writeFileSync('prd_llm/ingestion/ingestion.py', content);
}

// FIX: except Exception: for WARN-9 and WARN-10
[
    'mure_agi/context_memory.py',
    'test.py', 'test11.py', 'test3.py', 'test_compile.py', 'test_distill.py'
].forEach(f => fixFile(f, [{match: /except:/g, replace: 'except Exception:'}]));

console.log('✅ Fixed encoding & excepts in python files');
