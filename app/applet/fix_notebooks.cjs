const fs = require('fs');

// Patch RUN_BACKEND_COLAB.ipynb instruction text to be clearer in Myanmar
let data1 = JSON.parse(fs.readFileSync('RUN_BACKEND_COLAB.ipynb', 'utf8'));
if (data1.cells[0].source[0] !== "# MURE + UI Backend Server (Colab)\n") {
    data1.cells.unshift({
    cell_type: 'markdown',
    metadata: {},
    source: [
        "# MURE + UI Backend Server (Colab)\n",
        "ဒီ Notebook ကို Ngrok Token ထည့်ပြီး Option 1 အနေနဲ့ Web UI နဲ့ ချိတ်ဆက်သုံးနိုင်ပါတယ်။"
    ]
    });
    fs.writeFileSync('RUN_BACKEND_COLAB.ipynb', JSON.stringify(data1, null, 2));
}

// For MURE_Colab_AutoRun.ipynb
let data2 = JSON.parse(fs.readFileSync('MURE_Colab_AutoRun.ipynb', 'utf8'));
data2.cells.splice(4, 1, {
  cell_type: 'code',
  execution_count: null,
  metadata: {},
  source: [
    "# 4. MURE + 3B LLM စနစ်ကို API (Ngrok) ခံပြီး run ခြင်း\n",
    "# React Web UI နဲ့ ချိတ်ဆက်ဖို့အတွက် Ngrok Auth Token ကို ဒီနေရာမှာ ထည့်ပါ။\n",
    "NGROK_TOKEN = 'YOUR_NGROK_AUTH_TOKEN_HERE'  # <--- ဒီနေရာမှာ Token ပြောင်းထည့်ပါ\n",
    "\n",
    "import os\n",
    "os.environ['NGROK_AUTH_TOKEN'] = NGROK_TOKEN\n",
    "\n",
    "# Install missing packages if needed\n",
    "!pip install fastapi uvicorn pydantic pyngrok nest-asyncio -q\n",
    "\n",
    "from pyngrok import ngrok\n",
    "import uvicorn\n",
    "import nest_asyncio\n",
    "from fastapi import FastAPI, HTTPException\n",
    "from fastapi.middleware.cors import CORSMiddleware\n",
    "from pydantic import BaseModel\n",
    "\n",
    "# We import the LLM architecture from run_mure_colab\n",
    "from run_mure_colab import mure, MURESentenceLLM\n",
    "\n",
    "if not NGROK_TOKEN or NGROK_TOKEN == 'YOUR_NGROK_AUTH_TOKEN_HERE':\n",
    "    print('❌ NGROK_TOKEN ကို ထည့်ပေးပါ။')\n",
    "else:\n",
    "    app = FastAPI(title='MURE API Backend (MURE + Sentence LLM)')\n",
    "    app.add_middleware(\n",
    "        CORSMiddleware,\n",
    "        allow_origins=['*'],\n",
    "        allow_credentials=True,\n",
    "        allow_methods=['*'],\n",
    "        allow_headers=['*'],\n",
    "    )\n",
    "\n",
    "    class ChatRequest(BaseModel):\n",
    "        message: str\n",
    "\n",
    "    llm = MURESentenceLLM(mure_reasoner=mure)\n",
    "\n",
    "    @app.get('/health')\n",
    "    def health_check():\n",
    "        return {'status': 'online', 'version': 'MURE + Sentence LLM'}\n",
    "\n",
    "    @app.get('/stats')\n",
    "    def get_stats():\n",
    "        return {'causalRules': len(mure.rules)}\n",
    "\n",
    "    @app.post('/chat')\n",
    "    def chat(req: ChatRequest):\n",
    "        try:\n",
    "            reply = llm.generate_response(req.message)\n",
    "            return {\n",
    "                'reply': reply,\n",
    "                'frame': {'effect': 'Sentence LLM generated'},\n",
    "                'learned': False,\n",
    "                'source': 'mure_3b_sentence_llm',\n",
    "                'stats': {'causalRules': len(mure.rules)}\n",
    "            }\n",
    "        except Exception as e:\n",
    "            raise HTTPException(status_code=500, detail=str(e))\n",
    "\n",
    "    ngrok.set_auth_token(NGROK_TOKEN)\n",
    "    public_url = ngrok.connect(8000)\n",
    "    print('==========================================================')\n",
    "    print(f'⭐ PUBLIC API URL: {public_url.public_url} ⭐')\n",
    "    print('ဒီ URL ကို copy ကူးပြီး React Web UI ရဲ့ Settings ထဲက Python Backend API URL နေရာမှာ ထည့်ပါ။')\n",
    "    print('==========================================================')\n",
    "\n",
    "    nest_asyncio.apply()\n",
    "    uvicorn.run(app, host='0.0.0.0', port=8000)\n"
  ],
  outputs: []
});
fs.writeFileSync('MURE_Colab_AutoRun.ipynb', JSON.stringify(data2, null, 2));


// Modify MURE_PRD_Merged_v3.ipynb to add FastAPI Cell at the very end
let data3 = JSON.parse(fs.readFileSync('MURE_PRD_Merged_v3.ipynb', 'utf8'));

// First make sure we remove any previously added Cells that might be broken
let lastCell = data3.cells[data3.cells.length - 1];
if (lastCell.source.join('').includes('API Server (Ngrok + FastAPI)')) {
    data3.cells.pop();
}

data3.cells.push({
  cell_type: 'code',
  execution_count: null,
  metadata: {},
  source: [
    "# @title 5. API Server (Ngrok + FastAPI)\n",
    "# React Web UI နဲ့ ချိတ်ဆက်ဖို့အတွက် Ngrok Auth Token ကို ဒီနေရာမှာ ထည့်ပါ။\n",
    "NGROK_TOKEN = 'YOUR_NGROK_AUTH_TOKEN_HERE'  # <--- ဒီနေရာမှာ Token ပြောင်းထည့်ပါ\n",
    "\n",
    "!pip install pyngrok nest-asyncio -q\n",
    "import nest_asyncio\n",
    "from pyngrok import ngrok\n",
    "import uvicorn\n",
    "from fastapi import FastAPI, HTTPException\n",
    "from fastapi.middleware.cors import CORSMiddleware\n",
    "from pydantic import BaseModel\n",
    "\n",
    "if not NGROK_TOKEN or NGROK_TOKEN == 'YOUR_NGROK_AUTH_TOKEN_HERE':\n",
    "    print('❌ NGROK_TOKEN ကို ထည့်ပေးပါ။')\n",
    "else:\n",
    "    app = FastAPI(title='MURE API Backend (PRD Merged)')\n",
    "    app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_credentials=True, allow_methods=['*'], allow_headers=['*'])\n",
    "\n",
    "    class ChatRequest(BaseModel):\n",
    "        message: str\n",
    "\n",
    "    @app.get('/health')\n",
    "    def health_check():\n",
    "        return {'status': 'online', 'version': 'PRD Merged 7B LLM'}\n",
    "\n",
    "    @app.get('/stats')\n",
    "    def get_stats():\n",
    "        return {'causalRules': len(mure_soul.causal_memory)}\n",
    "\n",
    "    @app.post('/chat')\n",
    "    def chat(req: ChatRequest):\n",
    "        try:\n",
    "            reply = merged_chat(req.message)\n",
    "            return {\n",
    "                'reply': reply,\n",
    "                'frame': {'effect': 'Generated via PRD Merged LLM'},\n",
    "                'learned': False,\n",
    "                'source': 'prd_7b_merged_llm',\n",
    "                'stats': {'causalRules': len(mure_soul.causal_memory)}\n",
    "            }\n",
    "        except Exception as e:\n",
    "            raise HTTPException(status_code=500, detail=str(e))\n",
    "\n",
    "    ngrok.set_auth_token(NGROK_TOKEN)\n",
    "    public_url = ngrok.connect(8000)\n",
    "    print('==========================================================')\n",
    "    print(f'⭐ PUBLIC API URL: {public_url.public_url} ⭐')\n",
    "    print('ဒီ URL ကို copy ကူးပြီး React Web UI ရဲ့ Settings ထဲက Python Backend API URL နေရာမှာ ထည့်ပါ။')\n",
    "    print('==========================================================')\n",
    "\n",
    "    nest_asyncio.apply()\n",
    "    uvicorn.run(app, host='0.0.0.0', port=8000)\n"
  ],
  outputs: []
});
fs.writeFileSync('MURE_PRD_Merged_v3.ipynb', JSON.stringify(data3, null, 2));

console.log('✅ Updated all notebooks with correctly formatted Python Api code.');
